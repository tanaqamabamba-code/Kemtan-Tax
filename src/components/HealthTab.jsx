import React, { useState, useMemo } from 'react';
import { monthKey } from '../utils';
import { Field, inputStyle } from './Shared';
import { PLPanel } from './PLPanel';
import { BalanceSheetPanel } from './BalanceSheetPanel';
import { CashFlowPanel } from './CashFlowPanel';
import { TopItemsPanel } from './TopItemsPanel';

export function HealthTab({state,setState,toast}){
  const thisMonth = new Date().toISOString().slice(0,7);
  const thisYear = thisMonth.slice(0,4);
  const [periodType,setPeriodType] = useState('month');
  const [month,setMonth] = useState(thisMonth);
  const [year,setYear] = useState(thisYear);
  const [report,setReport] = useState('pl');

  const monthsWithData = useMemo(()=>{
    const set = new Set();
    state.sales.forEach(s=>set.add(monthKey(s.date)));
    state.batches.forEach(b=>set.add(monthKey(b.date)));
    state.expenses.forEach(e=>set.add(monthKey(e.date)));
    set.add(thisMonth);
    return [...set].sort();
  },[state]);

  const yearsWithData = useMemo(()=>{
    const set = new Set();
    monthsWithData.forEach(m=>set.add(m.slice(0,4)));
    return [...set].sort();
  },[monthsWithData]);

  const effectiveMonth = periodType==='ytd'
    ? (monthsWithData.filter(m=>m.startsWith(year)).sort().slice(-1)[0] || `${year}-12`)
    : month;

  function printReport(){ window.print(); }

  return (
    <div style={{padding:'0 20px 100px'}}>
      <div className="no-print" style={{display:'flex',gap:6,marginBottom:14}}>
        {[{k:'month',l:'By month'},{k:'ytd',l:'Year to date'}].map(t=>(
          <button key={t.k} onClick={()=>setPeriodType(t.k)} style={{
            flex:1, padding:'9px 4px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer',
            border: periodType===t.k ? '1px solid var(--accent)' : '1px solid var(--line)',
            background: periodType===t.k ? 'var(--accent)' : 'none',
            color: periodType===t.k ? '#1c1b19' : 'var(--concrete-light)'
          }}>{t.l}</button>
        ))}
      </div>

      {periodType==='month' ? (
        <div className="no-print">
          <Field label="Month">
            <select style={{...inputStyle, appearance:'auto'}} value={month} onChange={e=>setMonth(e.target.value)}>
              {monthsWithData.map(m=>(<option key={m} value={m}>{m}</option>))}
            </select>
          </Field>
        </div>
      ) : (
        <div className="no-print">
          <Field label="Year">
            <select style={{...inputStyle, appearance:'auto'}} value={year} onChange={e=>setYear(e.target.value)}>
              {yearsWithData.map(y=>(<option key={y} value={y}>{y}</option>))}
            </select>
          </Field>
        </div>
      )}

      <div className="no-print" style={{display:'flex',gap:6,marginBottom:20,flexWrap:'wrap'}}>
        {[{k:'pl',l:'P&L'},{k:'bs',l:'Balance Sheet'},{k:'cf',l:'Cash Flow'},{k:'top',l:'Top items'}].map(t=>(
          <button key={t.k} onClick={()=>setReport(t.k)} style={{
            flex:'1 0 45%', padding:'10px 4px', borderRadius:8, fontSize:12.5, fontWeight:700, cursor:'pointer',
            border: report===t.k ? '1px solid var(--accent)' : '1px solid var(--line)',
            background: report===t.k ? 'var(--accent)' : 'none',
            color: report===t.k ? '#1c1b19' : 'var(--concrete-light)'
          }}>{t.l}</button>
        ))}
      </div>

      <div className="print-title" style={{display:'none'}}>
        Kemtan — {report==='pl'?'Profit & Loss':report==='bs'?'Balance Sheet':report==='cf'?'Cash Flow':'Top Items'}
        {' — '}{periodType==='ytd' ? `Year to date ${year}` : effectiveMonth}
      </div>

      {report==='pl' && (periodType==='ytd'
        ? <PLPanel state={state} month={null} yearPrefix={year} />
        : <PLPanel state={state} month={month} />)}
      {report==='bs' && <BalanceSheetPanel state={state} setState={setState} month={effectiveMonth} />}
      {report==='cf' && <CashFlowPanel state={state} setState={setState} month={effectiveMonth} />}
      {report==='top' && (periodType==='ytd'
        ? <TopItemsPanel state={state} yearPrefix={year} />
        : <TopItemsPanel state={state} month={month} />)}

      <div onClick={printReport} className="no-print" style={{
        marginTop:20, textAlign:'center', padding:'12px', borderRadius:10, border:'1px solid var(--line)',
        color:'var(--concrete-light)', fontSize:13, fontWeight:600, cursor:'pointer'
      }}>Print / Share this report</div>
    </div>
  );
}