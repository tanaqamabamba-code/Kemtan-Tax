import React, { useState, useMemo } from 'react';
import { Field, inputStyle } from './Shared';
import { fifoStockValue } from '../fifo';
import { monthKey, startOfWeek, downloadCSV, ledgerRemaining } from '../utils';
import { calculateRetainedEarnings, totalDrawings, computeClosingCash } from '../health-calcs';

export function DownloadsTab({state,toast}){
  const today = new Date().toISOString().slice(0,10);
  const thisMonth = today.slice(0,7);
  const [month,setMonth] = useState(thisMonth);
  const [stockDate,setStockDate] = useState(today);

  const monthsWithData = useMemo(()=>{
    const set = new Set();
    state.sales.forEach(s=>set.add(monthKey(s.date)));
    state.batches.forEach(b=>set.add(monthKey(b.date)));
    state.expenses.forEach(e=>set.add(monthKey(e.date)));
    (state.stockAdjustments||[]).forEach(a=>set.add(monthKey(a.date)));
    set.add(thisMonth);
    return [...set].sort().reverse();
  },[state]);

  function stamp(){ return new Date().toISOString().slice(0,10); }

  // A. Sales per month — every item, qty sold per week, gross profit per item, total per week
  function downloadSales(){
    const monthSales = state.sales.filter(s=>monthKey(s.date)===month);
    if(monthSales.length===0){ toast('No sales logged for that month.','bad'); return; }

    const headers = [
      {key:'week', label:'Week Starting'},
      {key:'item', label:'Item'},
      {key:'qtySold', label:'Qty Sold'},
      {key:'revenue', label:'Revenue'},
      {key:'grossProfit', label:'Gross Profit'},
    ];

    const byWeekItem = {};
    monthSales.forEach(s=>{
      const wk = startOfWeek(s.date);
      const key = wk+'|'+s.item;
      if(!byWeekItem[key]) byWeekItem[key] = { week:wk, item:s.item, qtySold:0, revenue:0, grossProfit:0 };
      byWeekItem[key].qtySold += s.qty;
      byWeekItem[key].revenue += s.qty*s.price;
      byWeekItem[key].grossProfit += s.grossProfit;
    });
    const rows = Object.values(byWeekItem)
      .sort((a,b)=> a.week===b.week ? a.item.localeCompare(b.item) : a.week.localeCompare(b.week))
      .map(r=>({ week:r.week, item:r.item, qtySold:r.qtySold, revenue:r.revenue.toFixed(2), grossProfit:r.grossProfit.toFixed(2) }));

    const weekTotals = {};
    Object.values(byWeekItem).forEach(r=>{
      if(!weekTotals[r.week]) weekTotals[r.week] = {revenue:0, grossProfit:0};
      weekTotals[r.week].revenue += r.revenue;
      weekTotals[r.week].grossProfit += r.grossProfit;
    });
    Object.keys(weekTotals).sort().forEach(wk=>{
      rows.push({ week:wk, item:'— WEEK TOTAL —', qtySold:'', revenue:weekTotals[wk].revenue.toFixed(2), grossProfit:weekTotals[wk].grossProfit.toFixed(2) });
    });

    downloadCSV(rows, headers, `sales-${month}-${stamp()}.csv`);
    toast('Sales report downloaded','good');
  }

  // B. Stock — snapshot as of a chosen date
  function downloadStockSnapshot(){
    const scopedState = {
      ...state,
      sales: state.sales.filter(s=>s.date<=stockDate),
      batches: state.batches.filter(b=>b.date<=stockDate),
      stockAdjustments: (state.stockAdjustments||[]).filter(a=>a.date<=stockDate),
    };
    const headers = [
      {key:'item', label:'Item'},
      {key:'qty', label:'Quantity On Hand'},
      {key:'value', label:'Stock Value (FIFO cost)'},
    ];
    const rows = state.items.map(i=>{
      const v = fifoStockValue(scopedState, i.name);
      return { item:i.name, qty:v.qty, value:v.value.toFixed(2) };
    }).sort((a,b)=>a.item.localeCompare(b.item));

    downloadCSV(rows, headers, `stock-snapshot-${stockDate}.csv`);
    toast('Stock snapshot downloaded','good');
  }

  // C. Expenses per month
  function downloadExpenses(){
    const monthExpenses = state.expenses.filter(e=>monthKey(e.date)===month);
    if(monthExpenses.length===0){ toast('No expenses logged for that month.','bad'); return; }
    const headers = [
      {key:'date', label:'Date'},
      {key:'reason', label:'Reason'},
      {key:'category', label:'Category'},
      {key:'amount', label:'Amount'},
      {key:'status', label:'Status'},
    ];
    const rows = [...monthExpenses]
      .sort((a,b)=> a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
      .map(e=>{
        const linked = (state.ledger||[]).find(l=>l.linkedExpenseId===e.id);
        const status = e.paymentStatus==='unpaid'
          ? (linked && linked.status==='settled' ? 'unpaid (now settled)' : 'unpaid (open)')
          : 'paid';
        return { date:e.date, reason:e.description, category:e.accountType, amount:e.amount.toFixed(2), status };
      });
    downloadCSV(rows, headers, `expenses-${month}-${stamp()}.csv`);
    toast('Expenses report downloaded','good');
  }

  // D. Loss per month
  function downloadLoss(){
    const monthLosses = (state.stockAdjustments||[]).filter(a=>monthKey(a.date)===month);
    if(monthLosses.length===0){ toast('No losses logged for that month.','bad'); return; }
    const headers = [
      {key:'date', label:'Date'},
      {key:'item', label:'Item'},
      {key:'qty', label:'Quantity Lost'},
      {key:'reason', label:'Reason'},
      {key:'costValue', label:'Cost Value'},
      {key:'notes', label:'Notes'},
    ];
    const rows = [...monthLosses]
      .sort((a,b)=> a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
      .map(a=>({ date:a.date, item:a.item, qty:a.qty, reason:a.reason, costValue:a.costValue.toFixed(2), notes:a.notes||'' }));
    downloadCSV(rows, headers, `loss-${month}-${stamp()}.csv`);
    toast('Loss report downloaded','good');
  }

  // E. Owed items (receivables + payables, current snapshot — not month-scoped since these are live balances)
  function downloadOwed(){
    const ledger = state.ledger || [];
    if(ledger.length===0){ toast('Nothing logged in Owed yet.','bad'); return; }
    const headers = [
      {key:'date', label:'Date'},
      {key:'type', label:'Type'},
      {key:'name', label:'Name'},
      {key:'item', label:'Item/Description'},
      {key:'amount', label:'Total Amount'},
      {key:'paid', label:'Paid So Far'},
      {key:'remaining', label:'Remaining'},
      {key:'status', label:'Status'},
    ];
    const rows = [...ledger]
      .sort((a,b)=> a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
      .map(l=>{
        const remaining = ledgerRemaining(l);
        const paid = Math.round((l.amount-remaining)*100)/100;
        return {
          date:l.date, type: l.type==='receivable' ? 'Owed to you' : 'You owe',
          name:l.name, item:l.item||'', amount:l.amount.toFixed(2),
          paid:paid.toFixed(2), remaining:remaining.toFixed(2), status:l.status
        };
      });
    downloadCSV(rows, headers, `owed-${stamp()}.csv`);
    toast('Owed items downloaded','good');
  }

  // Extra: Purchases per month
  function downloadPurchases(){
    const monthBatches = state.batches.filter(b=>monthKey(b.date)===month);
    if(monthBatches.length===0){ toast('No purchases logged for that month.','bad'); return; }
    const headers = [
      {key:'date', label:'Date'},
      {key:'item', label:'Item'},
      {key:'qty', label:'Quantity'},
      {key:'price', label:'Price Paid (each)'},
      {key:'total', label:'Total'},
      {key:'status', label:'Payment Status'},
      {key:'supplier', label:'Supplier'},
    ];
    const rows = [...monthBatches]
      .sort((a,b)=> a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
      .map(b=>{
        const linked = (state.ledger||[]).find(l=>l.linkedBatchId===b.id);
        return {
          date:b.date, item:b.item, qty:b.qty, price:b.price.toFixed(2), total:(b.qty*b.price).toFixed(2),
          status: b.paymentStatus==='credit' ? (linked && linked.status==='settled' ? 'credit (settled)' : 'credit (open)') : 'paid',
          supplier: linked ? linked.name : ''
        };
      });
    downloadCSV(rows, headers, `purchases-${month}-${stamp()}.csv`);
    toast('Purchases report downloaded','good');
  }

  // Extra: Staff/payroll per month
  function downloadPayroll(){
    const monthPayroll = state.payroll.filter(p=>monthKey(p.date)===month);
    if(monthPayroll.length===0){ toast('No wage payments logged for that month.','bad'); return; }
    const headers = [
      {key:'date', label:'Date'},
      {key:'staff', label:'Staff Member'},
      {key:'amount', label:'Amount'},
      {key:'notes', label:'Notes'},
    ];
    const rows = [...monthPayroll]
      .sort((a,b)=> a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
      .map(p=>({ date:p.date, staff:p.staffName, amount:p.amount.toFixed(2), notes:p.notes||'' }));
    downloadCSV(rows, headers, `payroll-${month}-${stamp()}.csv`);
    toast('Payroll report downloaded','good');
  }

  // Extra: P&L export
  function downloadPL(){
    const monthSales = state.sales.filter(s=>monthKey(s.date)===month);
    const monthExpenses = state.expenses.filter(e=>monthKey(e.date)===month);
    const totalSales = monthSales.reduce((a,s)=>a+s.qty*s.price,0);
    const cogs = monthSales.reduce((a,s)=>a+s.fifoPrice*s.qty,0);
    const grossProfit = totalSales - cogs;
    const expensesByType = {};
    monthExpenses.forEach(e=>{ expensesByType[e.accountType] = (expensesByType[e.accountType]||0) + e.amount; });
    const totalExpenses = monthExpenses.reduce((a,e)=>a+e.amount,0);
    const netProfit = grossProfit - totalExpenses;

    const headers = [{key:'line', label:'Line'},{key:'amount', label:'Amount'}];
    const rows = [
      {line:'Total sales', amount:totalSales.toFixed(2)},
      {line:'Cost of goods sold', amount:(-cogs).toFixed(2)},
      {line:'Gross profit', amount:grossProfit.toFixed(2)},
      ...Object.entries(expensesByType).map(([type,amt])=>({line:'Expense: '+type, amount:(-amt).toFixed(2)})),
      {line:'Total expenses', amount:(-totalExpenses).toFixed(2)},
      {line:'Net profit', amount:netProfit.toFixed(2)},
    ];
    downloadCSV(rows, headers, `pl-${month}-${stamp()}.csv`);
    toast('P&L downloaded','good');
  }

  // Extra: Balance Sheet export
  function downloadBalanceSheet(){
    const cash = computeClosingCash(state, month);
    const scopedState = { ...state, sales: state.sales.filter(s=>monthKey(s.date)<=month), batches: state.batches.filter(b=>monthKey(b.date)<=month) };
    const inventoryValue = state.items.reduce((sum,i)=> sum + fifoStockValue(scopedState,i.name).value, 0);
    const receivable = (state.ledger||[]).filter(l=>l.type==='receivable' && l.status==='open' && monthKey(l.date)<=month).reduce((a,l)=>a+ledgerRemaining(l),0);
    const payable = (state.ledger||[]).filter(l=>l.type==='payable' && l.status==='open' && monthKey(l.date)<=month).reduce((a,l)=>a+ledgerRemaining(l),0);
    const totalAssets = cash + inventoryValue + receivable;
    const capital = state.capital || 0;
    const retainedEarnings = calculateRetainedEarnings(state, month);
    const drawings = totalDrawings(state, month);
    const totalEquity = capital + retainedEarnings - drawings;

    const headers = [{key:'line', label:'Line'},{key:'amount', label:'Amount'}];
    const rows = [
      {line:'Cash', amount:cash.toFixed(2)},
      {line:'Accounts receivable', amount:receivable.toFixed(2)},
      {line:'Inventory (FIFO cost)', amount:inventoryValue.toFixed(2)},
      {line:'Total assets', amount:totalAssets.toFixed(2)},
      {line:'Accounts payable', amount:payable.toFixed(2)},
      {line:'Capital', amount:capital.toFixed(2)},
      {line:'Retained earnings', amount:retainedEarnings.toFixed(2)},
      {line:'Owner drawings', amount:(-drawings).toFixed(2)},
      {line:'Total equity', amount:totalEquity.toFixed(2)},
    ];
    downloadCSV(rows, headers, `balance-sheet-${month}-${stamp()}.csv`);
    toast('Balance sheet downloaded','good');
  }

  // Extra: Top items (top 30 sellers + top 30 slow movers, both revenue and gross profit)
  function downloadTopItems(){
    const monthSales = state.sales.filter(s=>monthKey(s.date)===month);
    if(monthSales.length===0){ toast('No sales logged for that month.','bad'); return; }
    const byItem = {};
    monthSales.forEach(s=>{
      if(!byItem[s.item]) byItem[s.item] = { item:s.item, qty:0, revenue:0, grossProfit:0 };
      byItem[s.item].qty += s.qty;
      byItem[s.item].revenue += s.qty*s.price;
      byItem[s.item].grossProfit += s.grossProfit;
    });
    const all = Object.values(byItem);
    const headers = [
      {key:'rank', label:'Rank'},
      {key:'item', label:'Item'},
      {key:'qty', label:'Qty Sold'},
      {key:'revenue', label:'Revenue'},
      {key:'grossProfit', label:'Gross Profit'},
      {key:'group', label:'Group'},
    ];
    const topByRevenue = [...all].sort((a,b)=>b.revenue-a.revenue).slice(0,30)
      .map((r,i)=>({ rank:i+1, item:r.item, qty:r.qty, revenue:r.revenue.toFixed(2), grossProfit:r.grossProfit.toFixed(2), group:'Top 30 by revenue' }));
    const slowByRevenue = [...all].sort((a,b)=>a.revenue-b.revenue).slice(0,30)
      .map((r,i)=>({ rank:i+1, item:r.item, qty:r.qty, revenue:r.revenue.toFixed(2), grossProfit:r.grossProfit.toFixed(2), group:'Slowest 30 by revenue' }));
    const topByGP = [...all].sort((a,b)=>b.grossProfit-a.grossProfit).slice(0,30)
      .map((r,i)=>({ rank:i+1, item:r.item, qty:r.qty, revenue:r.revenue.toFixed(2), grossProfit:r.grossProfit.toFixed(2), group:'Top 30 by gross profit' }));
    const slowByGP = [...all].sort((a,b)=>a.grossProfit-b.grossProfit).slice(0,30)
      .map((r,i)=>({ rank:i+1, item:r.item, qty:r.qty, revenue:r.revenue.toFixed(2), grossProfit:r.grossProfit.toFixed(2), group:'Slowest 30 by gross profit' }));

    downloadCSV([...topByRevenue, ...slowByRevenue, ...topByGP, ...slowByGP], headers, `top-items-${month}-${stamp()}.csv`);
    toast('Top items report downloaded','good');
  }

  // Combined: everything for this month in one go
  function downloadEverything(){
    downloadSales();
    downloadPurchases();
    downloadExpenses();
    downloadLoss();
    downloadPayroll();
    downloadOwed();
    downloadPL();
    downloadBalanceSheet();
    downloadTopItems();
    downloadStockSnapshot();
    toast('All reports downloaded for '+month, 'good');
  }

  const reportButtonStyle = {
    width:'100%', textAlign:'left', padding:'14px 16px', borderRadius:12, border:'1px solid var(--line)',
    background:'var(--bg-card)', color:'var(--paper)', fontSize:14, fontWeight:600, cursor:'pointer',
    marginBottom:10, display:'flex', justifyContent:'space-between', alignItems:'center'
  };
  const arrowStyle = { color:'var(--accent)', fontSize:13, fontWeight:700 };

  return (
    <div style={{padding:'0 20px 100px'}}>
      <Field label="Month">
        <select style={{...inputStyle, appearance:'auto'}} value={month} onChange={e=>setMonth(e.target.value)}>
          {monthsWithData.map(m=>(<option key={m} value={m}>{m}</option>))}
        </select>
      </Field>

      <button onClick={downloadEverything} style={{
        width:'100%', padding:'16px', borderRadius:12, border:'none', marginBottom:24,
        background:'var(--accent)', color:'#1c1b19', fontSize:15, fontWeight:700, cursor:'pointer'
      }}>Download everything for {month}</button>

      <div style={{fontSize:12,color:'var(--concrete-light)',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600,marginBottom:10}}>Monthly reports</div>

      <button onClick={downloadSales} style={reportButtonStyle}>
        <span>Sales — by item, weekly totals & gross profit</span><span style={arrowStyle}>↓</span>
      </button>
      <button onClick={downloadPurchases} style={reportButtonStyle}>
        <span>Purchases — items bought, price, supplier</span><span style={arrowStyle}>↓</span>
      </button>
      <button onClick={downloadExpenses} style={reportButtonStyle}>
        <span>Expenses — reason, category, amount, status</span><span style={arrowStyle}>↓</span>
      </button>
      <button onClick={downloadLoss} style={reportButtonStyle}>
        <span>Damage & loss</span><span style={arrowStyle}>↓</span>
      </button>
      <button onClick={downloadPayroll} style={reportButtonStyle}>
        <span>Staff wages paid</span><span style={arrowStyle}>↓</span>
      </button>
      <button onClick={downloadTopItems} style={reportButtonStyle}>
        <span>Top 30 sellers & slow movers</span><span style={arrowStyle}>↓</span>
      </button>
      <button onClick={downloadPL} style={reportButtonStyle}>
        <span>Profit & Loss statement</span><span style={arrowStyle}>↓</span>
      </button>
      <button onClick={downloadBalanceSheet} style={reportButtonStyle}>
        <span>Balance Sheet</span><span style={arrowStyle}>↓</span>
      </button>

      <div style={{fontSize:12,color:'var(--concrete-light)',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600,marginTop:20,marginBottom:10}}>Live snapshots</div>

      <Field label="Stock as of">
        <input type="date" style={inputStyle} value={stockDate} onChange={e=>setStockDate(e.target.value)} />
      </Field>
      <button onClick={downloadStockSnapshot} style={reportButtonStyle}>
        <span>Stock snapshot for {stockDate}</span><span style={arrowStyle}>↓</span>
      </button>
      <button onClick={downloadOwed} style={reportButtonStyle}>
        <span>Owed — money owed to you & by you (current)</span><span style={arrowStyle}>↓</span>
      </button>

      <div style={{fontSize:12,color:'var(--concrete)',marginTop:16}}>
        Reports download as CSV files that open directly in Excel. For a full raw data backup (everything the app stores, in one file), use the Backup option at the top of the app instead.
      </div>
    </div>
  );
}