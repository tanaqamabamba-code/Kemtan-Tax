import React, { useMemo } from 'react';
import { monthKey, fmtMoney } from '../utils';
import { ReportRow } from './Shared';

export function PLPanel({state,month,yearPrefix}){
  const monthSales = state.sales.filter(s=> yearPrefix ? s.date.startsWith(yearPrefix) : monthKey(s.date)===month);
  const totalSales = monthSales.reduce((a,s)=>a+s.qty*s.price,0);
  const cogs = monthSales.reduce((a,s)=>a+(s.fifoPrice*s.qty),0);
  const grossProfit = totalSales - cogs;
  const monthExpenses = state.expenses.filter(e=> yearPrefix ? e.date.startsWith(yearPrefix) : monthKey(e.date)===month);
  const totalExpenses = monthExpenses.reduce((a,e)=>a+e.amount,0);
  const netProfit = grossProfit - totalExpenses;

  const expensesByType = useMemo(()=>{
    const map = {};
    monthExpenses.forEach(e=>{ map[e.accountType] = (map[e.accountType]||0) + e.amount; });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]);
  },[monthExpenses]);

  return (
    <div>
      {monthSales.length===0 && monthExpenses.length===0 && (
        <div style={{fontSize:12,color:'var(--concrete)',marginBottom:14,padding:'10px 12px',background:'var(--bg-raised)',borderRadius:8}}>
          No sales or expenses logged in the app for this period yet.
        </div>
      )}
      <div style={{background:'var(--bg-card)',borderRadius:12,padding:'16px',marginBottom:16}}>
        <ReportRow label="Total sales" value={totalSales} />
        <ReportRow label="Cost of goods sold" value={-cogs} />
        <ReportRow label="Gross profit" value={grossProfit} bold accent />
      </div>

      <div style={{background:'var(--bg-card)',borderRadius:12,padding:'16px',marginBottom:16}}>
        <div style={{fontSize:12,color:'var(--concrete-light)',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600,marginBottom:6}}>Expenses</div>
        {expensesByType.length===0 && <div style={{fontSize:13,color:'var(--concrete-light)',padding:'6px 0'}}>None logged this month.</div>}
        {expensesByType.map(([type,amt])=>(<ReportRow key={type} label={type} value={-amt} />))}
        <ReportRow label="Total expenses" value={-totalExpenses} bold />
      </div>

      <div style={{background:'var(--bg-card)',borderRadius:12,padding:'16px'}}>
        <ReportRow label="Net profit" value={netProfit} bold accent />
      </div>
    </div>
  );
}