import formidable from 'formidable'
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

export const config = { api: { bodyParser: false } }

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return createClient(url, key)
}

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({ maxFileSize: 50 * 1024 * 1024, maxFiles: 15 })
    form.parse(req, (err, fields, files) => {
      if (err) reject(err)
      else resolve({ fields, files })
    })
  })
}

function readFileContent(file) {
  try {
    const content = fs.readFileSync(file.filepath)
    const ext = path.extname(file.originalFilename || '').toLowerCase()
    if (['.csv', '.txt'].includes(ext)) {
      return { type: 'text', name: file.originalFilename, content: content.toString('utf8').slice(0, 50000) }
    }
    return { type: 'base64', ext, name: file.originalFilename, content: content.toString('base64') }
  } catch(e) { return null }
}

function buildMessages(fields, fileContents) {
  const f = (key) => { const val = fields[key]; return Array.isArray(val) ? val[0] : (val || '—') }
  let owners = []; try { owners = JSON.parse(f('owners')) } catch(e) {}
  let taxData = []; try { taxData = JSON.parse(f('taxData')) } catch(e) {}
  let missing = []; try { missing = JSON.parse(f('missingFields')) } catch(e) {}

  const missingSection = missing.length > 0
    ? `\nMISSING DATA — ADD AS IMMEDIATE ACTION ITEMS IN GPVA INTERNAL TAB:\n${missing.map(m => '  • Collect from client: ' + m).join('\n')}\n`
    : '\nAll intake fields completed.\n'

  const ownerText = owners.map((o, i) =>
    `Owner ${i+1}: ${o.name||'—'} | Age: ${o.age||'—'} | Ownership: ${o.pct||'—'} | W-2: ${o.salary||'—'} | Role: ${o.role||'—'} | Spouse W-2: ${o.spouse||'—'}`
  ).join('\n')

  const taxText = owners.map((o, i) => {
    const t = taxData[i] || {}
    return `${o.name||'Owner '+(i+1)} — PTE: ${t.pte_q1||'—'}/${t.pte_q2||'—'}/${t.pte_q3||'—'}/${t.pte_q4||'—'} | Franchise: ${t.fran_q1||'—'}/${t.fran_q2||'—'}/${t.fran_q3||'—'}/${t.fran_q4||'—'} | Fed: ${t.fed_q1||'—'}/${t.fed_q2||'—'}/${t.fed_q3||'—'}/${t.fed_q4||'—'} | State: ${t.st_q1||'—'}/${t.st_q2||'—'}/${t.st_q3||'—'}/${t.st_q4||'—'}`
  }).join('\n')

  const content = [{
    type: 'text',
    text: `You are a senior financial analyst and CPA at Granite Peak Veterinary Advisors (GPVA).

Build a complete 9-tab branded HTML CFO dashboard using the attached financial documents. Every number must come from the uploaded files.

PRACTICE: ${f('bizName')} | ${f('entity')} | Practice State: ${f('statePractice')} | Residence: ${f('stateResidence')} | Filing: ${f('filingStatus')} | RE: ${f('realEstate')} | Retirement: ${f('retirement')} | Software: ${f('pms')} | Lab: ${f('labContract')} | Fee Schedule: ${f('feeSchedule')}
Business Events: ${f('bizEvents')}
Personal Events: ${f('personalEvents')}

OWNERS:
${ownerText}

OPERATIONS: DVMs: ${f('numDVM')} | Headcount: ${f('headcount')} | Debt: ${f('totalDebt')} | Distributions: ${f('distributions')} | Equipment: ${f('equipNeeds')} | Visits: ${f('visits')} | No-Show: ${f('noshow')} | ACT: ${f('atv')}

TAX (STATE ONLY — NO FEDERAL BUSINESS ESTIMATES):
${taxText}
Owner W-2 YTD: ${f('ownerW2')} | Fed W/H: ${f('ownerFedWH')} | State W/H: ${f('ownerStWH')}
Spouse W-2: ${f('spouseW2')} | Spouse Fed W/H: ${f('spouseFedWH')} | Rental: ${f('rentalIncome')}
${missingSection}

DASHBOARD — 9 TABS REQUIRED:

TAB 1 — FINANCIAL PERFORMANCE
5 KPI boxes: Gross Revenue (subtext: "Goal: 7–10% YoY growth") | COGS ($+%) | Rent ($+%, subtext: "Benchmark: 5–8%") | People Cost ($+%) | Adj. EBITDA ($+%)
Monthly P&L table: Revenue | COGS | Gross Profit | GM% | Labor & Benefits | L% | Rent | Net Op. Income
Charts: Monthly revenue trend (bar + line) | Revenue by service category (donut)
NO waterfall chart.

TAB 2 — REVENUE BY PROVIDER
Each provider gets a unique color bar — no bold names. Show: Revenue | % Total | Avg Client Transaction (NOT avg unit price).
Add Total Hospital Discounts as a KPI box and as a line below the provider totals table.
Prior year comparison. Flag providers with >15% change.

TAB 3 — STAFFING & PAYROLL
Full compensation breakdown by category. Overtime as a single KPI box (show TBD if not in data, target: <2% of payroll).
Monthly people cost % of revenue horizontal bar chart.
Benchmark: urgent care 48–55%, general practice 40–50%.

TAB 4 — BALANCE SHEET
Working capital section: calculate monthly fixed cost base = People Cost + Rent + Utilities ONLY (exclude COGS). Show 2-month minimum and 3-month target reserve thresholds.
A/R section: 4 simple KPI boxes (Total A/R, >30 days, >90 days, GPVA Standard). Show TBD if balance sheet not provided.
Fixed asset purchases >$2,500 tracker. Net to Owner (W-2 + distributions).

TAB 5 — VALUATION
3 KPI boxes ONLY: Adj. EBITDA | Private Sale 5x | Corporate Sale 10x.
EBITDA build-up with disclaimer: "Preliminary unaudited estimate. No normalization adjustments. Not a formal valuation opinion."
Labor improvement table showing EBITDA and enterprise value at different people cost %.
Valuation scenario bars for private (5x) and corporate (10x). No buyer commentary paragraphs.

TAB 6 — TAX PLANNING
Annual report filing reminder box at top.
Per owner: Business State PTE (Q1-Q4 paid/due) | Business State Franchise/Excise (Q1-Q4) | Personal Federal Estimated (Q1-Q4) | Personal State Estimated (Q1-Q4).
No business federal estimates.

TAB 7 — BEST PRACTICES
Compare to GPVA benchmarks:
Financial: DVM comp <25% | Staff comp <20% | COGS 20–25% | EBITDA 15–20% ideal/13–15% fair | YoY growth 7–10%
Revenue mix: Outpatient 24.5% | Lab 18% | Pharmacy 16% | Radiology 4% | Surgery 5% | Vaccines 9%
Efficiency: ACT $240 | Rev/FTE DVM $554K min | Support staff/DVM 3.8 | Active clients/DVM 2,200
Status labels: On Track | Review Recommended | Action Required

TAB 8 — BOOKKEEPING HEALTH
Month-over-month account fluctuation review. Flag: depreciation lump sum vs monthly | rent missing/doubled | sales tax not in period | overtime not separately coded | any variance >$5K unexplained.
Status labels: On Track | Review Recommended | Action Required — NEVER use "needs work" or negative language.

TAB 9 — GPVA INTERNAL (⚑ amber tab — DOES NOT PRINT)
Contains ALL action items: Immediate (red, <30 days with dollar impact) | 30-Day (amber) | 90-Day (blue).
Advisor notes with tone guidance. Delivery guidance for client call with suggested agenda.
This tab must be hidden from print/PDF export.

BRANDING (NON-NEGOTIABLE):
Primary blue: #42a6c4 | Charcoal: #3d4643
Fonts: EB Garamond (headings) | Outfit (body) | IBM Plex Mono (all numbers)
Header: charcoal2 (#2e3432) background | 3px blue bottom border
Tab nav: active tab has blue bottom border
All KPI cards: white background | blue top border
PDF export button in header → window.print()
Print CSS: hide tabs, show all panels except GPVA Internal, landscape layout
Footer: "Prepared by Granite Peak Veterinary Advisors | granitepeak.vet | Confidential — For ${f('bizName')} Use Only"

CRITICAL TAB FUNCTIONALITY: The tab switching JavaScript MUST work correctly. Use this exact pattern:
function showTab(n) {
  document.querySelectorAll('.panel').forEach((p,i) => p.style.display = i===n ? 'block' : 'none');
  document.querySelectorAll('.tab').forEach((t,i) => t.classList.toggle('active', i===n));
}
// Show first tab on load:
document.addEventListener('DOMContentLoaded', () => showTab(0));

OUTPUT: Return ONLY the complete HTML file. No text before or after. No markdown code fences.`
  }]

  for (const fc of fileContents) {
    if (!fc) continue
    if (fc.type === 'text') {
      content.push({ type: 'text', text: `\n--- FILE: ${fc.name} ---\n${fc.content}\n--- END FILE ---\n` })
    } else if (fc.ext === '.pdf') {
      content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fc.content } })
    } else {
      content.push({ type: 'text', text: `\n--- FILE: ${fc.name} (${fc.ext}, ${Math.round(fc.content.length*0.75/1024)}KB) — extract all financial data ---\n` })
    }
  }

  return content
}

async function saveToSupabase(fields, dashboardHtml) {
  const supabase = getSupabase()
  const f = (key) => { const val = fields[key]; return Array.isArray(val) ? val[0] : (val || null) }
  const bizName = f('bizName')
  if (!bizName) return

  try {
    const { data: existing, error: e1 } = await supabase.from('clients').select('id').eq('business_name', bizName)
    if (e1) { console.error('SELECT ERROR:', e1); return }

    let clientId
    if (existing?.length > 0) {
      clientId = existing[0].id
      await supabase.from('clients').update({
        entity_type:f('entity'), state_practice:f('statePractice'), state_residence:f('stateResidence'),
        updated_at: new Date().toISOString()
      }).eq('id', clientId)
    } else {
      const { data: nc, error: e2 } = await supabase.from('clients').insert({
        business_name:bizName, entity_type:f('entity'), state_practice:f('statePractice'),
        state_residence:f('stateResidence'), filing_status:f('filingStatus'), real_estate:f('realEstate'),
        retirement_plan:f('retirement'), practice_software:f('pms'), lab_contract:f('labContract'),
        num_dvms:parseFloat(f('numDVM'))||null, headcount:parseInt(f('headcount'))||null
      }).select()
      if (e2) { console.error('INSERT CLIENT ERROR:', e2); return }
      clientId = nc?.[0]?.id
    }

    if (!clientId) { console.error('No clientId'); return }

    let owners = []; try { owners = JSON.parse(f('owners')) } catch(e) {}
    if (owners.length > 0) {
      await supabase.from('owners').delete().eq('client_id', clientId)
      await supabase.from('owners').insert(owners.map((o,i) => ({
        client_id:clientId, name:o.name, age:parseInt(o.age)||null,
        ownership_pct:o.pct, w2_salary:o.salary, role:o.role, spouse_w2:o.spouse, sort_order:i
      })))
    }

    const { error: e3 } = await supabase.from('quarterly_submissions').insert({
      client_id:clientId, quarter:f('quarter')||'Q2', year:parseInt(f('year'))||2026,
      submitted_by:'Staff', status:'dashboard_generated',
      biz_events:f('bizEvents'), personal_events:f('personalEvents'),
      total_debt:f('totalDebt'), distributions:f('distributions'), equip_needs:f('equipNeeds'),
      visits:f('visits'), noshow_rate:f('noshow'), atv:f('atv'),
      owner_w2_ytd:f('ownerW2'), owner_fed_wh:f('ownerFedWH'), owner_state_wh:f('ownerStWH'),
      spouse_w2_ytd:f('spouseW2'), spouse_fed_wh:f('spouseFedWH'), rental_income:f('rentalIncome'),
      dashboard_html:dashboardHtml, dashboard_generated_at:new Date().toISOString()
    })
    if (e3) console.error('INSERT SUBMISSION ERROR:', e3)
    else console.log('SAVE SUCCESS for:', bizName)
  } catch(e) { console.error('SAVE EXCEPTION:', e) }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const { fields, files } = await parseForm(req)
    const fileContents = []
    for (const [, fileArr] of Object.entries(files)) {
      const fileList = Array.isArray(fileArr) ? fileArr : [fileArr]
      for (const file of fileList) {
        const content = readFileContent(file)
        if (content) fileContents.push(content)
      }
    }

    const messageContent = buildMessages(fields, fileContents)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 16000,
        messages: [{ role: 'user', content: messageContent }]
      })
    })

    if (!response.ok) {
      const err = await response.text()
      return res.status(500).json({ error: `Anthropic API error: ${err}` })
    }

    const data = await response.json()
    let html = data.content.find(c => c.type === 'text')?.text || ''
    const htmlMatch = html.match(/<!DOCTYPE html>[\s\S]*<\/html>/i)
    if (htmlMatch) html = htmlMatch[0]

    saveToSupabase(fields, html).catch(e => console.error('Background save failed:', e))

    return res.status(200).json({ html, success: true })
  } catch(e) {
    console.error('Handler error:', e)
    return res.status(500).json({ error: e.message })
  }
}
