import formidable from 'formidable'
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

export const config = { api: { bodyParser: false } }

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

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
      return { type: 'text', content: content.toString('utf8').slice(0, 50000) }
    }
    return {
      type: 'base64',
      ext: ext,
      content: content.toString('base64'),
      name: file.originalFilename
    }
  } catch(e) {
    return null
  }
}

function buildMessages(fields, fileContents) {
  const f = (key) => {
    const val = fields[key]
    return Array.isArray(val) ? val[0] : (val || '—')
  }

  let owners = []
  try { owners = JSON.parse(f('owners')) } catch(e) {}

  let taxData = []
  try { taxData = JSON.parse(f('taxData')) } catch(e) {}

  let missing = []
  try { missing = JSON.parse(f('missingFields')) } catch(e) {}

  const missingSection = missing.length > 0
    ? `\nMISSING DATA — ADD EACH AS IMMEDIATE ACTION ITEM IN GPVA INTERNAL TAB:\n${missing.map(m => '  • Collect from client: ' + m).join('\n')}\n`
    : '\nAll intake fields completed.\n'

  const ownerText = owners.map((o, i) =>
    `Owner ${i+1}: ${o.name||'—'} | Age: ${o.age||'—'} | Ownership: ${o.pct||'—'} | W-2 Salary: ${o.salary||'—'} | Role: ${o.role||'—'} | Spouse W-2: ${o.spouse||'—'}`
  ).join('\n')

  const taxText = owners.map((o, i) => {
    const t = taxData[i] || {}
    return `${o.name||'Owner '+(i+1)} — State PTE Q1-Q4: ${t.pte_q1||'—'}/${t.pte_q2||'—'}/${t.pte_q3||'—'}/${t.pte_q4||'—'} | Franchise Q1-Q4: ${t.fran_q1||'—'}/${t.fran_q2||'—'}/${t.fran_q3||'—'}/${t.fran_q4||'—'} | Personal Fed Q1-Q4: ${t.fed_q1||'—'}/${t.fed_q2||'—'}/${t.fed_q3||'—'}/${t.fed_q4||'—'} | Personal State Q1-Q4: ${t.st_q1||'—'}/${t.st_q2||'—'}/${t.st_q3||'—'}/${t.st_q4||'—'}`
  }).join('\n')

  const content = []

  content.push({
    type: 'text',
    text: `You are a senior financial analyst and CPA at Granite Peak Veterinary Advisors (GPVA).

Build a complete 9-tab branded HTML CFO dashboard using the financial documents attached.

PRACTICE: ${f('bizName')} | ${f('entity')} | Practice: ${f('statePractice')} | Residence: ${f('stateResidence')} | Filing: ${f('filingStatus')} | RE: ${f('realEstate')} | Retirement: ${f('retirement')} | Software: ${f('pms')} | Lab: ${f('labContract')} | Fee Schedule: ${f('feeSchedule')}
Business Events: ${f('bizEvents')}
Personal Events: ${f('personalEvents')}

OWNERS:
${ownerText}

OPERATIONS: DVMs: ${f('numDVM')} | Headcount: ${f('headcount')} | Debt: ${f('totalDebt')} | Distributions: ${f('distributions')} | Equipment: ${f('equipNeeds')} | Visits: ${f('visits')} | No-Show: ${f('noshow')} | ACT: ${f('atv')}

TAX (STATE ONLY — NO FEDERAL BUSINESS ESTIMATES):
${taxText}
Owner W-2 YTD: ${f('ownerW2')} | Fed W/H: ${f('ownerFedWH')} | State W/H: ${f('ownerStWH')}
Spouse W-2: ${f('spouseW2')} | Fed W/H: ${f('spouseFedWH')} | Rental: ${f('rentalIncome')}
${missingSection}

DASHBOARD REQUIREMENTS — 9 TABS:
1. Financial Performance: 5 KPIs (Gross Revenue + "Goal: 7-10% YoY", COGS $+%, Rent $+% "Benchmark: 5-8%", People Cost $+%, EBITDA $+%). Monthly P&L table. Revenue trend chart. Service category donut. NO waterfall chart.
2. Revenue by Provider: Each provider unique color. Avg Client Transaction (not avg unit price). Total Hospital Discounts as KPI and table line. No bold names.
3. Staffing & Payroll: Full comp breakdown. Overtime as simple KPI box only (TBD if not provided, target <2%). Monthly people cost % bar chart.
4. Balance Sheet: Working capital (People Cost + Rent + Utilities ONLY — no COGS). A/R as 4 simple TBD boxes. Fixed asset tracker. Net to Owner.
5. Valuation: 3 KPI boxes only (EBITDA, Private 5x, Corporate 10x). EBITDA build-up + disclaimer. Labor improvement table. Scenario bars. No buyer commentary.
6. Tax Planning: Annual report reminder. State PTE + Franchise/Excise + Personal Federal + Personal State per owner by quarter.
7. Best Practices: GPVA benchmarks — DVM comp <25%, Staff comp <20%, COGS 20-25%, EBITDA 15-20%, YoY 7-10%, ACT $240, Rev/DVM $554K min. Status: On Track / Review Recommended / Action Required.
8. Bookkeeping Health: Use "On Track" / "Review Recommended" / "Action Required" — never negative language.
9. GPVA Internal (⚑ amber tab, does not print): ALL action items (Immediate/30-day/90-day) + advisor notes + delivery guidance.

BRANDING: Blue #42a6c4 | Charcoal #3d4643 | EB Garamond headings | Outfit body | IBM Plex Mono numbers | PDF button → window.print() | Footer: "Granite Peak Veterinary Advisors | granitepeak.vet | Confidential"

Return ONLY the complete HTML. Nothing before or after it.`
  })

  for (const fc of fileContents) {
    if (!fc) continue
    if (fc.type === 'text') {
      content.push({
        type: 'text',
        text: `\n--- FILE: ${fc.name || 'document'} ---\n${fc.content}\n--- END FILE ---\n`
      })
    } else if (fc.type === 'base64') {
      if (fc.ext === '.pdf') {
        content.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: fc.content }
        })
      } else {
        content.push({
          type: 'text',
          text: `\n--- ATTACHED FILE: ${fc.name} (${fc.ext}) — ${Math.round(fc.content.length * 0.75 / 1024)}KB ---\n[Extract all financial data from this file]\n`
        })
      }
    }
  }

  return content
}

async function saveToSupabase(fields, dashboardHtml) {
  try {
    const f = (key) => {
      const val = fields[key]
      return Array.isArray(val) ? val[0] : (val || null)
    }
    const bizName = f('bizName')
    if (!bizName) return

    const { data: existing } = await supabase.from('clients').select('id').eq('business_name', bizName)
    let clientId
    if (existing?.length > 0) {
      clientId = existing[0].id
      await supabase.from('clients').update({
        entity_type:f('entity'), state_practice:f('statePractice'),
        state_residence:f('stateResidence'), updated_at:new Date().toISOString()
      }).eq('id', clientId)
    } else {
      const { data: nc } = await supabase.from('clients').insert({
        business_name:bizName, entity_type:f('entity'), state_practice:f('statePractice'),
        state_residence:f('stateResidence'), filing_status:f('filingStatus'), real_estate:f('realEstate'),
        retirement_plan:f('retirement'), practice_software:f('pms'), lab_contract:f('labContract'),
        num_dvms:parseFloat(f('numDVM'))||null, headcount:parseInt(f('headcount'))||null
      }).select()
      clientId = nc?.[0]?.id
    }

    if (clientId) {
      let owners = []
      try { owners = JSON.parse(f('owners')) } catch(e) {}
      if (owners.length > 0) {
        await supabase.from('owners').delete().eq('client_id', clientId)
        await supabase.from('owners').insert(owners.map((o,i) => ({
          client_id:clientId, name:o.name, age:parseInt(o.age)||null,
          ownership_pct:o.pct, w2_salary:o.salary, role:o.role, spouse_w2:o.spouse, sort_order:i
        })))
      }

      await supabase.from('quarterly_submissions').insert({
        client_id:clientId, quarter:f('quarter')||'Q2', year:parseInt(f('year'))||2026,
        submitted_by:'Staff', status:'dashboard_generated',
        biz_events:f('bizEvents'), personal_events:f('personalEvents'),
        total_debt:f('totalDebt'), distributions:f('distributions'), equip_needs:f('equipNeeds'),
        visits:f('visits'), noshow_rate:f('noshow'), atv:f('atv'),
        owner_w2_ytd:f('ownerW2'), owner_fed_wh:f('ownerFedWH'), owner_state_wh:f('ownerStWH'),
        spouse_w2_ytd:f('spouseW2'), spouse_fed_wh:f('spouseFedWH'), rental_income:f('rentalIncome'),
        dashboard_html:dashboardHtml, dashboard_generated_at:new Date().toISOString()
      })
    }
  } catch(e) {
    console.error('Supabase save error:', e)
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { fields, files } = await parseForm(req)

    const fileContents = []
    for (const [key, fileArr] of Object.entries(files)) {
      const fileList = Array.isArray(fileArr) ? fileArr : [fileArr]
      for (const file of fileList) {
        const content = readFileContent(file)
        if (content) {
          content.name = file.originalFilename
          fileContents.push(content)
        }
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
      return res.status(500).json({ error: `API error: ${err}` })
    }

    const data = await response.json()
    let html = data.content.find(c => c.type === 'text')?.text || ''

    const htmlMatch = html.match(/<!DOCTYPE html>[\s\S]*<\/html>/i)
    if (htmlMatch) html = htmlMatch[0]

    saveToSupabase(fields, html).catch(console.error)

    return res.status(200).json({ html, success: true })

  } catch(e) {
    console.error('Generate error:', e)
    return res.status(500).json({ error: e.message })
  }
}
