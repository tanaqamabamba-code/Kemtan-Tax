// Tax calculations + register builders for the Kemtan tax-compliance workbook.
// Everything here is a pure function of the app state. All amounts are USD
// (the app records USD only). Rates are never hard-coded: the user enters the
// confirmed corporate tax rate and VAT rate in Tax > Settings.
import { fifoStockValue, afterOpeningCutover } from './fifo';

export const TREATMENTS = ['Deductible', 'Private', 'Capital', 'Non-deductible'];

// Instalment percentages mirror the workbook defaults. Confirm against the
// current ZIMRA QPD notice before paying (editable in Tax > QPD).
export const DEFAULT_QPD = [
  { no: 1, dueDate: '', pct: 10, paid: '', paidDate: '', ref: '' },
  { no: 2, dueDate: '', pct: 25, paid: '', paidDate: '', ref: '' },
  { no: 3, dueDate: '', pct: 30, paid: '', paidDate: '', ref: '' },
  { no: 4, dueDate: '', pct: 35, paid: '', paidDate: '', ref: '' },
];

export const DEFAULT_TAX_SETTINGS = {
  legalName: 'Kemtan (Private) Limited',
  tradingName1: 'Tanbuild Hardware',
  tradingName2: 'Mabamba Timbers',
  defaultDivision: 'Tanbuild Hardware',
  tin: '',
  vatNumber: '',
  payeNumber: '',
  yearStart: '2026-01-01',
  yearEnd: '2026-12-31',
  vatRegistered: false,
  vatRate: '',          // % — only used when vatRegistered is true
  taxRate: '',          // % — enter the confirmed rate; blank = not computed
  exchangeMethod: 'USD only — no ZiG transactions recorded',
  otherIncome: '',      // other business income for the year
  nonTaxableIncome: '', // income that is legally non-taxable
  otherAdjustments: '', // +/- other tax adjustments (attach a schedule)
  withholdingCredits: '', // WHT credits supported by certificates
  preparedBy: '',
  reviewedBy: '',
  qpd: DEFAULT_QPD,
};

export function getTaxSettings(state){
  return { ...DEFAULT_TAX_SETTINGS, ...(state.taxSettings || {}) };
}
export function getTaxMeta(state){
  const m = state.taxMeta || {};
  return { expenses: m.expenses || {}, purchases: m.purchases || {}, suppliers: m.suppliers || {} };
}

export function num(v){ const n = Number(v); return isFinite(n) ? n : 0; }
export function r2(n){ return Math.round(n * 100) / 100; }
function sum(arr, fn){ return arr.reduce((a, x) => a + fn(x), 0); }

export function shiftDate(dateStr, n){
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// Stock valued at FIFO cost as at the END of the given date.
export function stockAsAt(state, date){
  const scoped = {
    ...state,
    sales: state.sales.filter(s => s.date <= date),
    batches: state.batches.filter(b => b.date <= date),
    stockAdjustments: (state.stockAdjustments || []).filter(a => a.date <= date),
  };
  let qty = 0, value = 0;
  const perItem = {};
  state.items.forEach(i => {
    const v = fifoStockValue(scoped, i.name);
    perItem[i.name] = v;
    qty += v.qty; value += v.value;
  });
  return { qty, value: r2(value), perItem };
}

export function computeStock(state, yearStart, yearEnd){
  if(!yearStart || !yearEnd || yearStart > yearEnd) return null;
  return {
    opening: stockAsAt(state, shiftDate(yearStart, -1)),
    closing: stockAsAt(state, yearEnd),
  };
}

// Stock-loss expenses are created by the Loss tab alongside a stock adjustment.
// Their cost is already inside cost of sales (via closing stock), so they must
// not be counted again as operating expenses.
export function isStockLossExpense(e){
  if(e.linkedAdjustmentId) return true;
  return e.accountType === 'Stock loss' && String(e.description || '').startsWith('Stock loss —');
}

export function expenseTreatment(meta, e){
  return (meta.expenses[e.id] || {}).treatment || 'Deductible';
}

export function supplierForBatch(state, meta, b){
  const linked = (state.ledger || []).find(l => l.linkedBatchId === b.id);
  if(linked && linked.name) return linked.name;
  return ((meta.purchases[b.id] || {}).supplier || '').trim();
}

export function computeTax(state, settings, meta, stock){
  const { yearStart, yearEnd } = settings;
  const valid = !!stock;
  const inYear = d => d >= yearStart && d <= yearEnd;

  const sales = valid ? state.sales.filter(s => inYear(s.date)) : [];
  const batches = valid ? state.batches.filter(b => inYear(b.date) && afterOpeningCutover(state, b.item, b.date)) : [];
  const adjustments = valid ? (state.stockAdjustments || []).filter(a => inYear(a.date)) : [];
  const exps = valid ? state.expenses.filter(e => inYear(e.date)) : [];
  const assets = state.fixedAssets || [];

  const turnover = r2(sum(sales, s => s.qty * s.price));
  const otherIncome = r2(num(settings.otherIncome));
  const openingStock = valid ? stock.opening.value : 0;
  const closingStock = valid ? stock.closing.value : 0;
  const purchases = r2(sum(batches, b => b.qty * b.price));
  const costOfSales = r2(openingStock + purchases - closingStock);
  const grossProfit = r2(turnover + otherIncome - costOfSales);

  // Cross-check: FIFO cost recorded on each sale + cost of stock lost
  const fifoCogs = r2(sum(sales, s => (s.fifoPrice || 0) * s.qty));
  const lossValue = r2(sum(adjustments, a => a.costValue || 0));
  const reconDiff = r2(costOfSales - (fifoCogs + lossValue));

  const opexRows = exps.filter(e => !isStockLossExpense(e));
  const opex = r2(sum(opexRows, e => e.amount));
  const accDep = r2(sum(assets, a => num(a.accDep)));
  const profitBeforeTax = r2(grossProfit - opex - accDep);

  const nonDeductible = r2(sum(opexRows.filter(e => expenseTreatment(meta, e) !== 'Deductible'), e => e.amount));
  const addBacks = r2(nonDeductible + accDep);
  const nonTaxableIncome = r2(num(settings.nonTaxableIncome));
  const allowances = r2(sum(assets, a => num(a.taxAllowance)));
  const otherAdj = r2(num(settings.otherAdjustments));
  const taxableIncome = r2(profitBeforeTax + addBacks - nonTaxableIncome - allowances + otherAdj);

  const rate = (settings.taxRate === '' || settings.taxRate == null) ? null : Number(settings.taxRate);
  const estimatedTax = (rate == null || !isFinite(rate)) ? null : r2(Math.max(0, taxableIncome * rate / 100));
  const qpdPaid = r2(sum(settings.qpd || [], q => num(q.paid)));
  const whtCredits = r2(num(settings.withholdingCredits));
  const balance = estimatedTax == null ? null : r2(estimatedTax - qpdPaid - whtCredits);

  return {
    valid, turnover, otherIncome, openingStock, purchases, closingStock, costOfSales, grossProfit,
    fifoCogs, lossValue, reconDiff, opex, accDep, profitBeforeTax, nonDeductible, addBacks,
    nonTaxableIncome, allowances, otherAdj, taxableIncome, rate, estimatedTax, qpdPaid, whtCredits, balance,
    counts: { sales: sales.length, batches: batches.length, expenses: exps.length, opexRows: opexRows.length },
  };
}

export function computeQpd(estimatedTax, qpd){
  let cumPct = 0, paidBefore = 0;
  return (qpd || []).map(q => {
    cumPct += num(q.pct);
    const cumDue = estimatedTax == null ? null : r2(estimatedTax * cumPct / 100);
    const due = cumDue == null ? null : Math.max(0, r2(cumDue - paidBefore));
    paidBefore += num(q.paid);
    return { ...q, cumPct, cumDue, due };
  });
}

// Things the user should fix before relying on the numbers.
export function runChecks(state, settings, meta, result, stock){
  const out = [];
  const add = (level, text) => out.push({ level, text });
  if(!result.valid){ add('bad', 'Financial year dates are missing or the start is after the end (Settings).'); return out; }
  if(!settings.tin.trim()) add('warn', 'BP number / TIN is not entered (Settings).');
  if(result.rate == null) add('bad', 'Corporate tax rate not entered, so tax is not calculated (Settings).');
  if(settings.vatRegistered && num(settings.vatRate) <= 0) add('warn', 'VAT registered is Yes but the VAT rate is 0.');
  if(Math.abs(result.reconDiff) > 0.05){
    add('warn', `Cost of sales differs from FIFO sales cost + stock losses by ${result.reconDiff.toFixed(2)}. Usually because a sale spans two stock batches (each sale line is costed at one batch price) or a stock recount. The tax computation uses the exact stock-based figure.`);
  }
  const inYear = d => d >= settings.yearStart && d <= settings.yearEnd;
  const noSupplier = state.batches.filter(b => inYear(b.date) && !supplierForBatch(state, meta, b)).length;
  if(noSupplier > 0) add('warn', `${noSupplier} purchase${noSupplier === 1 ? '' : 's'} with no supplier recorded (Review > Purchases).`);
  const noEvidence = state.expenses.filter(e => inYear(e.date) && !isStockLossExpense(e) && !((meta.expenses[e.id] || {}).evidence || '').trim()).length;
  if(noEvidence > 0) add('warn', `${noEvidence} expense${noEvidence === 1 ? '' : 's'} with no evidence reference (Review > Expenses).`);
  const negative = Object.keys(stock.closing.perItem).filter(k => stock.closing.perItem[k].qty < 0);
  if(negative.length > 0) add('warn', `${negative.length} item${negative.length === 1 ? ' has' : 's have'} negative closing stock (e.g. ${negative[0]}). Check purchases and opening stock.`);
  if(out.length === 0) add('ok', 'No issues found by the automatic checks.');
  return out;
}

// ---------- Register builders (columns match the Kemtan workbook tabs) ----------
const h = (key, label) => ({ key, label });
const f2 = n => (n === '' || n == null) ? '' : Number(n).toFixed(2);

export function buildRegisters(state, settings, meta, stock){
  const { yearStart, yearEnd } = settings;
  const inYear = d => d >= yearStart && d <= yearEnd;
  const vatRate = settings.vatRegistered ? num(settings.vatRate) : 0;
  const ledger = state.ledger || [];

  // Sales register — one row per sale line
  const salesRows = state.sales
    .filter(s => inYear(s.date))
    .slice()
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.seq || 0) - (b.seq || 0))
    .map(s => {
      const net = r2(s.qty * s.price);
      const vat = r2(net * vatRate / 100);
      const credit = (s.paymentStatus || 'paid') === 'credit';
      const entry = credit ? ledger.find(l => l.id === s.ledgerId) : null;
      return {
        date: s.date,
        docNo: 'S-' + String((s.seq || 0) + 1).padStart(5, '0'),
        customer: entry ? entry.name : 'Cash customer',
        division: settings.defaultDivision,
        description: `${s.qty} × ${s.item}`,
        currency: 'USD',
        net: f2(net), vatRate: vatRate + '%', vat: f2(vat), gross: f2(net + vat),
        payment: credit ? 'Credit' : 'Paid (cash/bank)',
        fiscalRef: '', creditNote: 'No',
        notes: s.agent ? 'Sold by ' + s.agent : '',
      };
    });
  const salesHeaders = [
    h('date', 'Date'), h('docNo', 'Document No.'), h('customer', 'Customer'), h('division', 'Trading Division'),
    h('description', 'Description'), h('currency', 'Currency'), h('net', 'Net Sales'), h('vatRate', 'VAT Rate'),
    h('vat', 'VAT Amount'), h('gross', 'Gross Total'), h('payment', 'Payment Method'), h('fiscalRef', 'Fiscal Invoice Ref'),
    h('creditNote', 'Credit Note?'), h('notes', 'Notes'),
  ];

  // Purchases register — one row per stock purchase batch
  const purchaseRows = state.batches
    .filter(b => inYear(b.date))
    .slice()
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
    .map(b => {
      const net = r2(b.qty * b.price);
      const pm = meta.purchases[b.id] || {};
      const supplier = supplierForBatch(state, meta, b);
      const sup = meta.suppliers[supplier] || {};
      return {
        date: b.date, supplier, tin: sup.tin || '', invoiceNo: '',
        description: `${b.qty} × ${b.item}`, category: 'Goods for resale', currency: 'USD',
        net: f2(net), vat: f2(0), gross: f2(net),
        payment: (b.paymentStatus || 'paid') === 'credit' ? 'Credit' : 'Paid (cash/bank)',
        grn: '', fiscalValid: pm.fiscalValid || '', informal: sup.informal || '',
        evidence: pm.evidence || '', notes: '',
      };
    });
  const purchaseHeaders = [
    h('date', 'Date'), h('supplier', 'Supplier'), h('tin', 'Supplier BP/TIN'), h('invoiceNo', 'Invoice/Receipt No.'),
    h('description', 'Description'), h('category', 'Category'), h('currency', 'Currency'), h('net', 'Net Amount'),
    h('vat', 'VAT Amount'), h('gross', 'Gross Amount'), h('payment', 'Payment Method'), h('grn', 'Goods Received Ref'),
    h('fiscalValid', 'Fiscal Invoice Valid?'), h('informal', 'Informal Supplier?'), h('evidence', 'Supporting Evidence'), h('notes', 'Notes'),
  ];

  // Expenses register
  const expenseRows = state.expenses
    .filter(e => inYear(e.date))
    .slice()
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
    .map(e => {
      const em = meta.expenses[e.id] || {};
      const stockLoss = isStockLossExpense(e);
      const owed = ledger.find(l => l.linkedExpenseId === e.id);
      return {
        date: e.date, payee: owed ? owed.name : '', docNo: '', description: e.description || '',
        category: e.accountType || '', currency: 'USD',
        net: f2(e.amount), vat: f2(0), gross: f2(e.amount),
        purpose: '', treatment: stockLoss ? 'In cost of sales (stock loss)' : expenseTreatment(meta, e),
        payment: (e.paymentStatus || 'paid') === 'unpaid' ? 'Unpaid (owed)' : 'Paid (cash/bank)',
        evidence: em.evidence || '', notes: e.notes || '',
      };
    });
  const expenseHeaders = [
    h('date', 'Date'), h('payee', 'Supplier/Payee'), h('docNo', 'Document No.'), h('description', 'Description'),
    h('category', 'Expense Category'), h('currency', 'Currency'), h('net', 'Net Amount'), h('vat', 'VAT Amount'),
    h('gross', 'Gross Amount'), h('purpose', 'Business Purpose'), h('treatment', 'Tax Treatment'),
    h('payment', 'Payment Method'), h('evidence', 'Evidence Ref'), h('notes', 'Notes'),
  ];

  // Stock valuation (year opening / purchases / closing / losses, per item)
  const stockRows = stock ? state.items.map(i => {
    const o = stock.opening.perItem[i.name] || { qty: 0, value: 0 };
    const c = stock.closing.perItem[i.name] || { qty: 0, value: 0 };
    const pb = state.batches.filter(b => b.item === i.name && inYear(b.date) && afterOpeningCutover(state, i.name, b.date));
    const ad = (state.stockAdjustments || []).filter(a => a.item === i.name && inYear(a.date));
    return {
      code: '', name: i.name, division: settings.defaultDivision, unit: '',
      oq: o.qty, ov: f2(o.value),
      pq: sum(pb, b => b.qty), pv: f2(sum(pb, b => b.qty * b.price)),
      cq: c.qty, cv: f2(c.value),
      date: '', method: 'FIFO',
      lq: sum(ad, a => a.qty), lv: f2(sum(ad, a => a.costValue || 0)),
      notes: 'System closing stock — confirm against physical count',
    };
  }) : [];
  const stockHeaders = [
    h('code', 'Item Code'), h('name', 'Item Description'), h('division', 'Division'), h('unit', 'Unit'),
    h('oq', 'Opening Qty'), h('ov', 'Opening Value'), h('pq', 'Purchases Qty'), h('pv', 'Purchases Value'),
    h('cq', 'Closing Qty'), h('cv', 'Closing Value'), h('date', 'Stocktake Date'), h('method', 'Valuation Method'),
    h('lq', 'Damaged/Lost Qty'), h('lv', 'Adjustment Value'), h('notes', 'Notes'),
  ];

  // Fixed assets
  const assetRows = (state.fixedAssets || []).map(a => ({
    id: a.id, description: a.description || '', purchaseDate: a.purchaseDate || '', supplier: a.supplier || '',
    invoiceNo: a.invoiceNo || '', currency: 'USD', cost: f2(num(a.cost)), location: a.location || '',
    businessUse: a.businessUse === '' || a.businessUse == null ? '100' : a.businessUse,
    disposalDate: a.disposalDate || '', disposalProceeds: a.disposalProceeds === '' ? '' : f2(num(a.disposalProceeds)),
    accDep: f2(num(a.accDep)), nbv: f2(num(a.cost) - num(a.accDep)),
    allowanceType: a.allowanceType || '', allowance: f2(num(a.taxAllowance)), notes: a.notes || '',
  }));
  const assetHeaders = [
    h('id', 'Asset ID'), h('description', 'Description'), h('purchaseDate', 'Purchase Date'), h('supplier', 'Supplier'),
    h('invoiceNo', 'Invoice No.'), h('currency', 'Currency'), h('cost', 'Cost'), h('location', 'Location'),
    h('businessUse', 'Business Use %'), h('disposalDate', 'Disposal Date'), h('disposalProceeds', 'Disposal Proceeds'),
    h('accDep', 'Accounting Depreciation'), h('nbv', 'Net Book Value'), h('allowanceType', 'Tax Allowance Type'),
    h('allowance', 'Tax Allowance Amount'), h('notes', 'Evidence/Notes'),
  ];

  // Payroll summary — totals paid per month. PAYE / NSSA are NOT calculated here.
  const byMonth = {};
  (state.payroll || []).filter(p => inYear(p.date)).forEach(p => {
    const m = p.date.slice(0, 7);
    if(!byMonth[m]) byMonth[m] = { staff: new Set(), gross: 0 };
    byMonth[m].staff.add(p.staffId || p.staffName);
    byMonth[m].gross += p.amount;
  });
  const payrollRows = Object.keys(byMonth).sort().map(m => ({
    month: m, count: byMonth[m].staff.size, gross: f2(byMonth[m].gross), allowances: '', benefits: '',
    paye: '', nssaEr: '', nssaEe: '', other: '', net: f2(byMonth[m].gross), payeDate: '', payeRef: '', p2: '',
    notes: 'Total wages paid per Staff tab. Enter PAYE/NSSA from the payroll calculation.',
  }));
  const payrollHeaders = [
    h('month', 'Month'), h('count', 'Employee Count'), h('gross', 'Gross Salaries'), h('allowances', 'Allowances'),
    h('benefits', 'Taxable Benefits'), h('paye', 'PAYE Withheld'), h('nssaEr', 'NSSA Employer'), h('nssaEe', 'NSSA Employee'),
    h('other', 'Other Deductions'), h('net', 'Net Pay'), h('payeDate', 'PAYE Paid Date'), h('payeRef', 'PAYE Payment Ref'),
    h('p2', 'P2 Submitted?'), h('notes', 'Notes'),
  ];

  return {
    sales: { headers: salesHeaders, rows: salesRows },
    purchases: { headers: purchaseHeaders, rows: purchaseRows },
    expenses: { headers: expenseHeaders, rows: expenseRows },
    stock: { headers: stockHeaders, rows: stockRows },
    assets: { headers: assetHeaders, rows: assetRows },
    payroll: { headers: payrollHeaders, rows: payrollRows },
  };
}

export function buildComputationRows(result){
  const L = (line, desc, usd, work) => ({ line, desc, usd: usd == null ? '' : f2(usd), zig: '0.00', work });
  return [
    L('A', 'Sales / turnover', result.turnover, 'Net sales in the financial year; excludes VAT'),
    L('B', 'Other business income', result.otherIncome, 'Entered in Settings'),
    L('C', 'Opening stock', result.openingStock, 'FIFO value at day before year start'),
    L('D', 'Purchases / direct costs', result.purchases, 'Stock purchases in the year'),
    L('E', 'Closing stock', result.closingStock, 'FIFO value at year end'),
    L('F', 'Cost of sales', result.costOfSales, 'Opening stock + purchases - closing stock (includes stock losses)'),
    L('G', 'Gross profit', result.grossProfit, 'Sales + other income - cost of sales'),
    L('H', 'Operating expenses', result.opex, 'Expenses excluding stock-loss entries (already in cost of sales)'),
    L('I', 'Accounting depreciation', result.accDep, 'From fixed asset register'),
    L('J', 'Accounting profit before tax', result.profitBeforeTax, 'Before tax adjustments'),
    L('K', 'Add: non-deductible expenses and accounting depreciation', result.addBacks, 'Expenses marked Private/Capital/Non-deductible + accounting depreciation'),
    L('L', 'Less: non-taxable income', result.nonTaxableIncome, 'Entered in Settings'),
    L('M', 'Less: capital allowances', result.allowances, 'From fixed asset register'),
    L('N', 'Other tax adjustments (+/-)', result.otherAdj, 'Entered in Settings'),
    L('O', 'Taxable income (working)', result.taxableIncome, 'Before any special currency allocation / ring-fencing rules'),
    { line: 'P', desc: 'Tax rate (%)', usd: result.rate == null ? '' : String(result.rate), zig: '', work: 'Confirmed rate entered in Settings' },
    L('Q', 'Estimated annual tax', result.estimatedTax, 'Illustrative; verify credits and special rules'),
    L('R', 'QPDs / tax prepayments paid', result.qpdPaid, 'From QPD tab'),
    L('S', 'Withholding tax credits', result.whtCredits, 'Only credits supported by certificates'),
    L('T', 'Estimated balance / (overpayment)', result.balance, 'Reconcile with TaRMS statement'),
  ];
}
export const computationHeaders = [h('line', 'Line'), h('desc', 'Description'), h('usd', 'USD Amount'), h('zig', 'ZiG Amount'), h('work', 'Working / source')];
