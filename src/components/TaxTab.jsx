import React, { useState, useMemo } from 'react';
import { Field, PillSelect, ReportRow, inputStyle } from './Shared';
import { saveState } from '../storage';
import { downloadCSV, fmtMoney } from '../utils';
import {
  TREATMENTS, getTaxSettings, getTaxMeta, computeStock, computeTax, computeQpd, runChecks,
  buildRegisters, buildComputationRows, computationHeaders, isStockLossExpense, expenseTreatment,
  supplierForBatch, num,
} from '../tax-calcs';

const SECTIONS = ['Summary', 'Settings', 'Review', 'Assets', 'QPD', 'Export'];
const smallInput = { ...inputStyle, padding: '10px 12px', fontSize: 15 };
const card = { background: 'var(--bg-card)', border: '1px solid var(--line)', borderRadius: 12, padding: 14, marginBottom: 10 };
const btn = (primary) => ({
  width: '100%', padding: '14px', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 10,
  border: primary ? 'none' : '1px solid var(--line)',
  background: primary ? 'var(--accent)' : 'var(--bg-raised)', color: primary ? '#1c1b19' : 'var(--paper)',
});

export function TaxTab({ state, setState, toast }) {
  const [section, setSection] = useState('Summary');
  const settings = useMemo(() => getTaxSettings(state), [state.taxSettings]);
  const meta = useMemo(() => getTaxMeta(state), [state.taxMeta]);

  const stock = useMemo(
    () => computeStock(state, settings.yearStart, settings.yearEnd),
    [state.items, state.sales, state.batches, state.stockAdjustments, settings.yearStart, settings.yearEnd]
  );
  const result = useMemo(() => computeTax(state, settings, meta, stock),
    [state.sales, state.batches, state.stockAdjustments, state.expenses, state.fixedAssets, state.items, settings, meta, stock]);
  const checks = useMemo(() => stock ? runChecks(state, settings, meta, result, stock) : runChecks(state, settings, meta, result, null),
    [state.batches, state.expenses, state.ledger, settings, meta, result, stock]);

  function commit(next) { setState(next); saveState(next); }
  function setSetting(key, value) { commit({ ...state, taxSettings: { ...settings, [key]: value } }); }
  function setMeta(group, id, patch) {
    const cur = state.taxMeta || {};
    const grp = { ...(cur[group] || {}) };
    grp[id] = { ...(grp[id] || {}), ...patch };
    commit({ ...state, taxMeta: { ...cur, [group]: grp } });
  }

  return (
    <div style={{ padding: '0 20px 100px' }}>
      <div style={{ marginBottom: 16 }}>
        <PillSelect value={section} onChange={setSection} options={SECTIONS} />
      </div>
      {section === 'Summary' && <Summary settings={settings} result={result} checks={checks} />}
      {section === 'Settings' && <Settings settings={settings} setSetting={setSetting} />}
      {section === 'Review' && <Review state={state} settings={settings} meta={meta} setMeta={setMeta} />}
      {section === 'Assets' && <Assets state={state} commit={commit} />}
      {section === 'QPD' && <Qpd settings={settings} result={result} setSetting={setSetting} />}
      {section === 'Export' && <Export state={state} settings={settings} meta={meta} stock={stock} result={result} toast={toast} />}
    </div>
  );
}

function Summary({ settings, result, checks }) {
  const colors = { bad: 'var(--bad)', warn: 'var(--accent)', ok: 'var(--good)' };
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--concrete-light)', marginBottom: 12 }}>
        {settings.legalName} · {settings.yearStart} to {settings.yearEnd} · USD
      </div>
      {checks.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, color: 'var(--concrete-light)', marginBottom: 8 }}>Checks</div>
          {checks.map((c, i) => (
            <div key={i} style={{ fontSize: 13, color: colors[c.level], padding: '4px 0' }}>
              {c.level === 'ok' ? '✓' : '•'} {c.text}
            </div>
          ))}
        </div>
      )}
      {result.valid && (
        <div style={card}>
          <ReportRow label="Sales / turnover" value={result.turnover} />
          {result.otherIncome !== 0 && <ReportRow label="Other business income" value={result.otherIncome} />}
          <ReportRow label="Opening stock" value={result.openingStock} />
          <ReportRow label="+ Purchases" value={result.purchases} />
          <ReportRow label="− Closing stock" value={result.closingStock} />
          <ReportRow label="Cost of sales" value={result.costOfSales} />
          <ReportRow label="Gross profit" value={result.grossProfit} bold accent />
          <ReportRow label="Operating expenses" value={result.opex} />
          <ReportRow label="Accounting depreciation" value={result.accDep} />
          <ReportRow label="Accounting profit before tax" value={result.profitBeforeTax} bold accent />
          <ReportRow label="+ Non-deductible & depreciation" value={result.addBacks} />
          <ReportRow label="− Non-taxable income" value={result.nonTaxableIncome} />
          <ReportRow label="− Capital allowances" value={result.allowances} />
          <ReportRow label="± Other adjustments" value={result.otherAdj} />
          <ReportRow label="Taxable income (working)" value={result.taxableIncome} bold accent />
          {result.estimatedTax == null ? (
            <div style={{ padding: '12px 0', fontSize: 13, color: 'var(--accent)' }}>Enter the tax rate in Settings to see estimated tax.</div>
          ) : (
            <React.Fragment>
              <ReportRow label={`Estimated tax @ ${result.rate}%`} value={result.estimatedTax} bold />
              <ReportRow label="− QPDs paid" value={result.qpdPaid} />
              <ReportRow label="− WHT credits" value={result.whtCredits} />
              <ReportRow label="Balance / (overpayment)" value={result.balance} bold />
            </React.Fragment>
          )}
        </div>
      )}
      <div style={{ fontSize: 12, color: 'var(--concrete)', lineHeight: 1.5 }}>
        Working paper only — not a filed return. Check the figures with a Zimbabwe tax practitioner and reconcile to your TaRMS statements before filing.
      </div>
    </div>
  );
}

function Settings({ settings, setSetting }) {
  const text = (key, label, placeholder, type) => (
    <Field label={label}>
      <input type={type || 'text'} inputMode={type === 'number' ? 'decimal' : undefined} style={inputStyle}
        value={settings[key] == null ? '' : settings[key]} placeholder={placeholder || ''}
        onChange={e => setSetting(key, e.target.value)} />
    </Field>
  );
  return (
    <div>
      {text('legalName', 'Company name')}
      {text('tradingName1', 'Trading name 1')}
      {text('tradingName2', 'Trading name 2')}
      {text('defaultDivision', 'Division shown on registers', 'e.g. Tanbuild Hardware')}
      {text('tin', 'BP number / TIN')}
      {text('payeNumber', 'PAYE / employer number')}
      {text('yearStart', 'Financial year start', '', 'date')}
      {text('yearEnd', 'Financial year end', '', 'date')}
      <Field label="VAT registered?">
        <PillSelect value={settings.vatRegistered ? 'Yes' : 'No'} onChange={v => setSetting('vatRegistered', v === 'Yes')} options={['No', 'Yes']} />
        <div style={{ fontSize: 12, color: 'var(--concrete)', marginTop: 6 }}>
          While “No”, all VAT is shown as 0%. When you register, switch to Yes and enter the confirmed rate. Recorded prices are treated as VAT-exclusive.
        </div>
      </Field>
      {settings.vatRegistered && text('vatNumber', 'VAT number')}
      {settings.vatRegistered && text('vatRate', 'VAT rate (%)', 'enter confirmed rate', 'number')}
      {text('taxRate', 'Corporate tax rate (%)', 'enter confirmed rate', 'number')}
      {text('otherIncome', 'Other business income (USD)', '0', 'number')}
      {text('nonTaxableIncome', 'Non-taxable income (USD)', '0', 'number')}
      {text('otherAdjustments', 'Other tax adjustments, +/− (USD)', '0', 'number')}
      {text('withholdingCredits', 'Withholding tax credits (USD)', '0', 'number')}
      {text('preparedBy', 'Prepared by')}
      {text('reviewedBy', 'Reviewed by')}
    </div>
  );
}

function Review({ state, settings, meta, setMeta }) {
  const [kind, setKind] = useState('Expenses');
  const [openId, setOpenId] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const inYear = d => d >= settings.yearStart && d <= settings.yearEnd;

  const supplierNames = useMemo(() => {
    const set = new Set();
    (state.ledger || []).filter(l => l.type === 'payable').forEach(l => l.name && set.add(l.name));
    Object.keys(meta.suppliers).forEach(n => set.add(n));
    return [...set].sort();
  }, [state.ledger, meta.suppliers]);

  const expenses = state.expenses.filter(e => inYear(e.date) && !isStockLossExpense(e)).slice().sort((a, b) => b.date.localeCompare(a.date));
  const purchases = state.batches.filter(b => inYear(b.date)).slice().sort((a, b) => b.date.localeCompare(a.date));
  const list = kind === 'Expenses' ? expenses : purchases;
  const shown = showAll ? list : list.slice(0, 25);

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <PillSelect value={kind} onChange={v => { setKind(v); setOpenId(null); setShowAll(false); }} options={['Expenses', 'Purchases']} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--concrete)', marginBottom: 10 }}>
        {kind === 'Expenses'
          ? 'Tap an expense to set its tax treatment and evidence reference. Default is Deductible. Stock-loss entries are not listed (they are inside cost of sales).'
          : 'Tap a purchase to add the supplier, supplier TIN and invoice details needed for the purchases register.'}
      </div>
      {list.length === 0 && <div style={{ color: 'var(--concrete)', fontSize: 14 }}>Nothing recorded in this financial year.</div>}
      {shown.map(r => {
        const open = openId === r.id;
        const isExp = kind === 'Expenses';
        const em = meta.expenses[r.id] || {};
        const pm = meta.purchases[r.id] || {};
        const supplier = isExp ? '' : supplierForBatch(state, meta, r);
        const sup = meta.suppliers[supplier] || {};
        const label = isExp ? (r.description || r.accountType) : `${r.qty} × ${r.item}`;
        const amount = isExp ? r.amount : r.qty * r.price;
        const status = isExp ? `${expenseTreatment(meta, r)}${em.evidence ? ' · ' + em.evidence : ' · no evidence ref'}`
          : `${supplier || 'no supplier'}${sup.tin ? ' · ' + sup.tin : ''}`;
        return (
          <div key={r.id} style={card}>
            <div onClick={() => setOpenId(open ? null : r.id)} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 14 }}>{fmtMoney(amount)}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--concrete)', marginTop: 2 }}>{r.date} · {status}</div>
            </div>
            {open && isExp && (
              <div style={{ marginTop: 12 }}>
                <Field label="Tax treatment">
                  <PillSelect value={expenseTreatment(meta, r)} onChange={v => setMeta('expenses', r.id, { treatment: v })} options={TREATMENTS} />
                </Field>
                <Field label="Evidence reference">
                  <input style={smallInput} value={em.evidence || ''} placeholder="Receipt / invoice no."
                    onChange={e => setMeta('expenses', r.id, { evidence: e.target.value })} />
                </Field>
              </div>
            )}
            {open && !isExp && (
              <div style={{ marginTop: 12 }}>
                <Field label="Supplier">
                  <input style={smallInput} list="kt-suppliers" value={(state.ledger || []).some(l => l.linkedBatchId === r.id) ? supplier : (pm.supplier || '')}
                    disabled={(state.ledger || []).some(l => l.linkedBatchId === r.id)}
                    placeholder="Supplier name" onChange={e => setMeta('purchases', r.id, { supplier: e.target.value })} />
                  <datalist id="kt-suppliers">{supplierNames.map(n => <option key={n} value={n} />)}</datalist>
                </Field>
                {supplier && (
                  <React.Fragment>
                    <Field label="Supplier BP / TIN (applies to this supplier)">
                      <input style={smallInput} value={sup.tin || ''} onChange={e => setMeta('suppliers', supplier, { tin: e.target.value })} />
                    </Field>
                    <Field label="Informal supplier?">
                      <PillSelect value={sup.informal || ''} onChange={v => setMeta('suppliers', supplier, { informal: v })} options={['Yes', 'No']} />
                    </Field>
                  </React.Fragment>
                )}
                <Field label="Valid fiscal invoice?">
                  <PillSelect value={pm.fiscalValid || ''} onChange={v => setMeta('purchases', r.id, { fiscalValid: v })} options={['Yes', 'No']} />
                </Field>
                <Field label="Supporting evidence">
                  <input style={smallInput} value={pm.evidence || ''} placeholder="Invoice no. / delivery note"
                    onChange={e => setMeta('purchases', r.id, { evidence: e.target.value })} />
                </Field>
              </div>
            )}
          </div>
        );
      })}
      {list.length > 25 && (
        <button style={btn(false)} onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer' : `Show all ${list.length}`}</button>
      )}
    </div>
  );
}

const ASSET_FIELDS = [
  ['description', 'Description', 'text'], ['purchaseDate', 'Purchase date', 'date'], ['supplier', 'Supplier', 'text'],
  ['invoiceNo', 'Invoice no.', 'text'], ['cost', 'Cost (USD)', 'number'], ['location', 'Location', 'text'],
  ['businessUse', 'Business use %', 'number'], ['accDep', 'Accounting depreciation this year (USD)', 'number'],
  ['allowanceType', 'Tax allowance type', 'text'], ['taxAllowance', 'Tax allowance this year (USD)', 'number'],
  ['disposalDate', 'Disposal date', 'date'], ['disposalProceeds', 'Disposal proceeds (USD)', 'number'], ['notes', 'Evidence / notes', 'text'],
];

function Assets({ state, commit }) {
  const assets = state.fixedAssets || [];
  const [openId, setOpenId] = useState(null);

  function add() {
    const id = 'A-' + String(assets.length + 1).padStart(3, '0') + '-' + Date.now().toString(36).slice(-3);
    const blank = { id, description: '', purchaseDate: '', supplier: '', invoiceNo: '', cost: '', location: '', businessUse: '100', accDep: '', allowanceType: '', taxAllowance: '', disposalDate: '', disposalProceeds: '', notes: '' };
    commit({ ...state, fixedAssets: [...assets, blank] });
    setOpenId(id);
  }
  function update(id, key, value) {
    commit({ ...state, fixedAssets: assets.map(a => a.id === id ? { ...a, [key]: value } : a) });
  }
  function remove(id) {
    if (!window.confirm('Delete this asset?')) return;
    commit({ ...state, fixedAssets: assets.filter(a => a.id !== id) });
    setOpenId(null);
  }
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--concrete)', marginBottom: 10 }}>
        Record machinery, vehicles and equipment. Accounting depreciation is added back and the tax allowance is deducted in the tax working. Enter allowances as confirmed by your tax practitioner. If you also logged the purchase as an expense, mark that expense “Capital” in Review.
      </div>
      <button style={btn(true)} onClick={add}>+ Add asset</button>
      {assets.map(a => {
        const open = openId === a.id;
        return (
          <div key={a.id} style={card}>
            <div onClick={() => setOpenId(open ? null : a.id)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{a.description || '(new asset)'}</span>
              <span style={{ fontSize: 14 }}>{fmtMoney(num(a.cost))}</span>
            </div>
            {open && (
              <div style={{ marginTop: 12 }}>
                {ASSET_FIELDS.map(([key, label, type]) => (
                  <Field key={key} label={label}>
                    <input type={type} inputMode={type === 'number' ? 'decimal' : undefined} style={smallInput}
                      value={a[key] == null ? '' : a[key]} onChange={e => update(a.id, key, e.target.value)} />
                  </Field>
                ))}
                <button style={{ ...btn(false), color: 'var(--bad)' }} onClick={() => remove(a.id)}>Delete asset</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Qpd({ settings, result, setSetting }) {
  const rows = computeQpd(result.estimatedTax, settings.qpd);
  function upd(i, key, value) {
    setSetting('qpd', settings.qpd.map((q, idx) => idx === i ? { ...q, [key]: value } : q));
  }
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--concrete)', marginBottom: 10 }}>
        Instalments are a share of the estimated annual tax. The percentages and due dates below are editable — confirm them against the current ZIMRA notice before paying.
        {result.estimatedTax == null && <span style={{ color: 'var(--accent)' }}> Enter the tax rate in Settings to calculate amounts due.</span>}
      </div>
      {rows.map((q, i) => (
        <div key={i} style={card}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>QPD {q.no}{q.dueDate ? ` — due ${q.dueDate}` : ''}</div>
          <div style={{ fontSize: 13, color: 'var(--concrete-light)', marginBottom: 10 }}>
            Cumulative {q.cumPct}% · amount due now: <b style={{ color: 'var(--paper)' }}>{q.due == null ? '—' : fmtMoney(q.due)}</b>
          </div>
          <Field label="Due date"><input type="date" style={smallInput} value={q.dueDate} onChange={e => upd(i, 'dueDate', e.target.value)} /></Field>
          <Field label="Share of annual tax (%)"><input type="number" inputMode="decimal" style={smallInput} value={q.pct} onChange={e => upd(i, 'pct', e.target.value)} /></Field>
          <Field label="Amount paid (USD)"><input type="number" inputMode="decimal" style={smallInput} value={q.paid} onChange={e => upd(i, 'paid', e.target.value)} /></Field>
          <Field label="Date paid"><input type="date" style={smallInput} value={q.paidDate} onChange={e => upd(i, 'paidDate', e.target.value)} /></Field>
          <Field label="Payment reference"><input style={smallInput} value={q.ref} onChange={e => upd(i, 'ref', e.target.value)} /></Field>
        </div>
      ))}
    </div>
  );
}

function Export({ state, settings, meta, stock, result, toast }) {
  const regs = useMemo(() => buildRegisters(state, settings, meta, stock), [state, settings, meta, stock]);
  const tag = `${settings.yearStart}_to_${settings.yearEnd}`;

  function dl(reg, file) {
    if (!result.valid) { toast('Fix the financial year dates in Settings first.', 'bad'); return; }
    if (reg.rows.length === 0) { toast('Nothing to export for this financial year.', 'bad'); return; }
    downloadCSV(reg.rows, reg.headers, `${file}-${tag}.csv`);
    toast('Downloaded', 'good');
  }
  function dlComputation() {
    if (!result.valid) { toast('Fix the financial year dates in Settings first.', 'bad'); return; }
    downloadCSV(buildComputationRows(result), computationHeaders, `tax-computation-${tag}.csv`);
    toast('Downloaded', 'good');
  }
  const items = [
    ['Sales register', regs.sales, 'sales-register'],
    ['Purchases register', regs.purchases, 'purchases-register'],
    ['Expenses register', regs.expenses, 'expenses-register'],
    ['Stock valuation', regs.stock, 'stock-valuation'],
    ['Fixed assets register', regs.assets, 'fixed-assets'],
    ['Payroll summary', regs.payroll, 'payroll-summary'],
  ];
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--concrete)', marginBottom: 12 }}>
        Each file uses the same columns as the matching tab in the Kemtan Tax Compliance workbook. Open the CSV and paste its rows into that tab. Financial year: {settings.yearStart} to {settings.yearEnd}.
      </div>
      <button style={btn(true)} onClick={dlComputation}>Tax computation (CSV)</button>
      {items.map(([label, reg, file]) => (
        <button key={file} style={btn(false)} onClick={() => dl(reg, file)}>{label} ({reg.rows.length} rows)</button>
      ))}
      <div style={{ fontSize: 12, color: 'var(--concrete)', lineHeight: 1.5 }}>
        Payroll summary shows total wages paid per month. PAYE and NSSA amounts are not calculated by the app — enter them from your payroll calculation.
      </div>
    </div>
  );
}
