import formidable from 'formidable'
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

export const config = { api: { bodyParser: false } }

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  console.log('Supabase URL:', url ? 'SET' : 'MISSING')
  console.log('Supabase KEY:', key ? 'SET' : 'MISSING')
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

// Inject working tab JS if Claude left it empty
function fixTabJS(html) {
  const tabJS = `
function showTab(n){
  document.querySelectorAll('.tab-panel').forEach(function(p,i){p.style.display=i===n?'block':'none';});
  document.querySelectorAll('.tab-btn').forEach(function(t,i){t.classList.toggle('active',i===n);});
}
document.addEventListener('DOMContentLoaded',function(){
  document.querySelectorAll('.tab-panel').forEach(function(p,i){p.style.display=i===0?'block':'none';});
  document.querySelectorAll('.tab-btn').forEach(function(t,i){t.classList.toggle('active',i===0);});
});`

  // If script tag is empty or missing showTab, inject it
  if (!html.includes('showTab') && !html.includes('switchTab')) {
    html = html.replace(/<script([^>]*)>\s*<\/script>/, `<script$1>${tabJS}</script>`)
    if (!html.includes('showTab')) {
      html = html.replace('</body>', `<script>${tabJS}</script></body>`)
    }
  }

  // Also ensure tab panels have correct initial display
  if (html.includes('tab-panel')) {
    let panelCount = 0
    html = html.replace(/(<div[^>]+class="tab-panel[^"]*"[^>]*)(style="[^"]*")?>/g, (match, before, existingStyle) => {
      const display = panelCount === 0 ? 'block' : 'none'
      panelCount++
      return `${before} style="display:${display}">`
    })
  }

  return html
}

function buildMessages(fields, fileContents) {
  const f = (key) => { const val = fields[key]; return Array.isArray(val) ? val[0] : (val || '—') }
  let owners = []; try { owners = JSON.parse(f('owners')) } catch(e) {}
  let taxData = []; try { taxData = JSON.parse(f('taxData')) } catch(e) {}
  let missing = []; try { missing = JSON.parse(f('missingFields')) } catch(e) {}

  const missingSection = missing.length > 0
    ? `\nMISSING DATA — ADD AS IMMEDIATE ACTION ITEMS:\n${missing.map(m => '  • Collect from client: ' + m).join('\n')}\n`
    : '\nAll intake fields completed.\n'

  const ownerText = owners.map((o, i) =>
    `Owner ${i+1}: ${o.name||'—'} | Age: ${o.age||'—'} | Ownership: ${o.pct||'—'} | W-2: ${o.salary||'—'} | Role: ${o.role||'—'} | Spouse: ${o.spouse||'—'}`
  ).join('\n')

  const taxText = owners.map((o, i) => {
    const t = taxData[i] || {}
    return `${o.name||'Owner '+(i+1)}: PTE ${t.pte_q1||'—'}/${t.pte_q2||'—'}/${t.pte_q3||'—'}/${t.pte_q4||'—'} | Franchise ${t.fran_q1||'—'}/${t.fran_q2||'—'}/${t.fran_q3||'—'}/${t.fran_q4||'—'} | FedPersonal ${t.fed_q1||'—'}/${t.fed_q2||'—'}/${t.fed_q3||'—'}/${t.fed_q4||'—'} | StatePersonal ${t.st_q1||'—'}/${t.st_q2||'—'}/${t.st_q3||'—'}/${t.st_q4||'—'}`
  }).join('\n')

  const content = [{
    type: 'text',
    text: `You are a senior CPA at Granite Peak Veterinary Advisors (GPVA). Build a 9-tab HTML CFO dashboard from the attached financial documents.

CRITICAL: Return ONLY raw HTML starting with <!DOCTYPE html>. No markdown fences. No backticks. No explanation. The very first character must be < and the file must end with </html>.

PRACTICE: ${f('bizName')} | ${f('entity')} | Practice: ${f('statePractice')} | Residence: ${f('stateResidence')} | Filing: ${f('filingStatus')} | Retirement: ${f('retirement')} | Software: ${f('pms')} | Lab: ${f('labContract')}
Business Events: ${f('bizEvents')}
Personal Events: ${f('personalEvents')}
OWNERS: ${ownerText}
OPERATIONS: DVMs: ${f('numDVM')} | Headcount: ${f('headcount')} | Debt: ${f('totalDebt')} | Distributions: ${f('distributions')} | ACT: ${f('atv')}
TAX: ${taxText}
Owner W-2: ${f('ownerW2')} | Fed W/H: ${f('ownerFedWH')} | State W/H: ${f('ownerStWH')}
${missingSection}

9 TABS — use exactly this structure:
- Tab buttons: <button class="tab-btn" onclick="showTab(N)">Tab Name</button>
- Tab panels: <div class="tab-panel">...</div>
- CSS: .tab-panel { display: none; } — first panel visible by default
- JavaScript — include this EXACT function in your <script> tag:

function showTab(n){
  document.querySelectorAll('.tab-panel').forEach(function(p,i){p.style.display=i===n?'block':'none';});
  document.querySelectorAll('.tab-btn').forEach(function(t,i){t.classList.toggle('active',i===n);});
}
document.addEventListener('DOMContentLoaded',function(){showTab(0);});

TAB CONTENT:
1. Financial Performance - KPIs: Gross Revenue (Goal: 7-10% YoY), COGS, Rent (Benchmark: 5-8%), People Cost, EBITDA. Monthly P&L table. Revenue trend chart. Service category donut. NO waterfall.
2. Revenue by Provider - unique color per provider, Avg Client Transaction (NOT avg unit price), Hospital Discounts KPI
3. Staffing & Payroll - comp breakdown, OT KPI box only (TBD if not provided, target <2%), monthly labor % bar chart
4. Balance Sheet - working capital (People+Rent+Utilities only), A/R 4 simple boxes (TBD), fixed assets, Net to Owner
5. Valuation - 3 KPIs only (EBITDA, Private 5x, Corporate 10x), EBITDA build-up, labor improvement table
6. Tax Planning - annual report reminder, per-owner: State PTE, Franchise/Excise, Personal Federal, Personal State by quarter
7. Best Practices - vs GPVA benchmarks, On Track / Review Recommended / Action Required
8. Bookkeeping Health - On Track / Review Recommended / Action Required, never negative language
9. GPVA Internal (amber tab, @media print { display:none }) - all action items + advisor notes + call agenda

BRANDING: #42a6c4 blue | #3d4643 charcoal | EB Garamond headings | Outfit body | IBM Plex Mono numbers
Footer: "Granite Peak Veterinary Advisors | granitepeak.vet | Confidential — For ${f('bizName')} Use Only"`
  }]

  for (const fc of fileContents) {
    if (!fc) continue
    if (fc.type === 'text') {
      content.push({ type: 'text', text: `\n--- FILE: ${fc.name} ---\n${fc.content}\n---\n` })
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
  if (!bizName) { console.log('No bizName — skipping save'); return }
  console.log('Saving to Supabase:', bizName)

  try {
    const { data: existing, error: e0 } = await supabase
      .from('clients').select('id').eq('business_name', bizName)
    
    if (e0) { console.error('SELECT ERROR:', JSON.stringify(e0)); return }

    let clientId
    if (existing?.length > 0) {
      clientId = existing[0].id
      const { error: e1 } = await supabase.from('clients').update({
        entity_type: f('entity'), state_practice: f('statePractice'),
        state_residence: f('stateResidence'), updated_at: new Date().toISOString()
      }).eq('id', clientId)
      if (e1) console.error('UPDATE ERROR:', JSON.stringify(e1))
    } else {
      const { data: nc, error: e2 } = await supabase.from('clients').insert({
        business_name: bizName, entity_type: f('entity'),
        state_practice: f('statePractice'), state_residence: f('stateResidence'),
        filing_status: f('filingStatus'), real_estate: f('realEstate'),
        retirement_plan: f('retirement'), practice_software: f('pms'),
        lab_contract: f('labContract'), num_dvms: parseFloat(f('numDVM'))||null,
        headcount: parseInt(f('headcount'))||null
      }).select()
      if (e2) { console.error('INSERT CLIENT ERROR:', JSON.stringify(e2)); return }
      clientId = nc?.[0]?.id
    }

    if (!clientId) { console.error('No clientId after upsert'); return }

    let owners = []; try { owners = JSON.parse(f('owners')) } catch(e) {}
    if (owners.length > 0) {
      await supabase.from('owners').delete().eq('client_id', clientId)
      const { error: e3 } = await supabase.from('owners').insert(
        owners.map((o,i) => ({
          client_id: clientId, name: o.name, age: parseInt(o.age)||null,
          ownership_pct: o.pct, w2_salary: o.salary, role: o.role,
          spouse_w2: o.spouse, sort_order: i
        }))
      )
      if (e3) console.error('INSERT OWNERS ERROR:', JSON.stringify(e3))
    }

    const { error: e4 } = await supabase.from('quarterly_submissions').insert({
      client_id: clientId, quarter: f('quarter')||'Q2', year: parseInt(f('year'))||2026,
      submitted_by: 'Staff', status: 'dashboard_generated',
      biz_events: f('bizEvents'), personal_events: f('personalEvents'),
      total_debt: f('totalDebt'), distributions: f('distributions'),
      equip_needs: f('equipNeeds'), visits: f('visits'), noshow_rate: f('noshow'), atv: f('atv'),
      owner_w2_ytd: f('ownerW2'), owner_fed_wh: f('ownerFedWH'), owner_state_wh: f('ownerStWH'),
      spouse_w2_ytd: f('spouseW2'), spouse_fed_wh: f('spouseFedWH'), rental_income: f('rentalIncome'),
      dashboard_html: dashboardHtml, dashboard_generated_at: new Date().toISOString()
    })

    if (e4) console.error('INSERT SUBMISSION ERROR:', JSON.stringify(e4))
    else console.log('SAVE SUCCESS:', bizName)

  } catch(e) { console.error('SAVE EXCEPTION:', e.message) }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { fields, files } = await parseForm(req)
    const fileContents = []
    for (const [, fileArr] of Object.entries(files)) {
      const fileList = Array.isArray(fileArr) ? fileArr : [fileArr]
      for (const file of fileList) {
        const c = readFileContent(file)
        if (c) fileContents.push(c)
      }
    }

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
        messages: [{ role: 'user', content: buildMessages(fields, fileContents) }]
      })
    })

    if (!response.ok) {
      const err = await response.text()
      return res.status(500).json({ error: `API error: ${err}` })
    }

    const data = await response.json()
    let html = data.content.find(c => c.type === 'text')?.text || ''

    // Strip markdown fences
    html = html.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```\s*$/i, '').trim()

    // Extract HTML document
    const m = html.match(/<!DOCTYPE html>[\s\S]*<\/html>/i)
    if (m) html = m[0]

    if (!html.startsWith('<!DOCTYPE')) {
      return res.status(500).json({ error: 'Invalid HTML returned. Please try again.' })
    }

    // Fix tabs if Claude left script empty
    html = fixTabJS(html)

    // Save to Supabase
    await saveToSupabase(fields, html)

    return res.status(200).json({ html, success: true })

  } catch(e) {
    console.error('Handler error:', e)
    return res.status(500).json({ error: e.message })
  }
}
