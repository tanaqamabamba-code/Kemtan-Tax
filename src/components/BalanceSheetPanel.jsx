import React, { useState, useMemo } from 'react';
import { fifoStockValue } from '../fifo';
import { monthKey, fmtMoney, openReceivablesTotal, openPayablesTotal } from '../utils';
import { calculateRetainedEarnings, totalDrawings, computeClosingCash } from '../health-calcs';
import { saveState } from '../storage';
import { Field, ReportRow, inputStyle } from './Shared';

export function BalanceSheetPanel({state,setState,month}){
  const cash = computeClosingCash(state, month);

  const inventoryValue = useMemo(()=>{
    const cutoff = month + '-32';
    const scopedState = {
      ...state,
      sales: state.sales.filter(s=>monthKey(s.date)<=month),
      batches: state.batches.filter(b=>monthKey(b.date)<=month),
    };
    return state.items.reduce((sum,i)=> sum + fifoStockValue(scopedState,i.name).value, 0);
  },[state,month]);

  const accountsReceivable = useMemo(()=>openReceivablesTotal(state, month),[state,month]);
  const accountsPayable = useMemo(()=>openPayablesTotal(state, month),[state,month]);

  const totalAssets = cash + inventoryValue + accountsReceivable;

  const capital = state.capital || 0;
  const retainedEarnings = useMemo(()=>calculateRetainedEarnings(state, month),[state,month]);
  const drawings = useMemo(()=>totalDrawings(state, month),[state,month]);

  const totalEquity = capital + retainedEarnings - drawings;
  const totalLiabilities = accountsPayable;
  const balanceCheck = totalAssets - (totalLiabilities + totalEquity);

  function setCapital(v){
    const next = {...state, capital: Number(v)||0};
    setState(next);
    saveState(next);
  }

  const [drawDate,setDrawDate] = useState(new Date().toISOString().slice(0,10));
  const [drawAmount,setDrawAmount] = useState('');
  const [drawNotes,setDrawNotes] = useState('');
  const [showDrawForm,setShowDrawForm] = useState(false);

  function submitDrawing(){
    if(!drawAmount || Number(drawAmount)<=0) return;
    const next = {...state, drawings:[...(state.drawings||[]), {
      id:'draw_'+Date.now(), date:drawDate, amount:Number(drawAmount), notes:drawNotes.trim()
    }]};
    setState(next);
    saveState(next);
    setDrawAmount(''); setDrawNotes(''); setShowDrawForm(false);
  }

  const recentDrawings = [...(state.drawings||[])].filter(d=>monthKey(d.date)<=month).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);

  return (
    <div>
      <div style={{background:'var(--bg-card)',borderRadius:12,padding:'16px',marginBottom:16}}>
        <div style={{fontSize:12,color:'var(--concrete-light)',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600,marginBottom:6}}>Assets</div>
        <ReportRow label="Cash" value={cash} />
        <ReportRow label="Accounts receivable" value={accountsReceivable} />
        <ReportRow label="Inventory (FIFO cost)" value={inventoryValue} />
        <ReportRow label="Total assets" value={totalAssets} bold />
      </div>

      <div style={{background:'var(--bg-card)',borderRadius:12,padding:'16px',marginBottom:16}}>
        <div style={{fontSize:12,color:'var(--concrete-light)',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600,marginBottom:6}}>Liabilities</div>
        <ReportRow label="Accounts payable" value={accountsPayable} />
        <ReportRow label="Total liabilities" value={totalLiabilities} bold />
      </div>

      <Field label="Owner's capital">
        <input type="number" inputMode="decimal" style={inputStyle} value={capital} onChange={e=>setCapital(e.target.value)} placeholder="0.00" />
      </Field>

      <div style={{background:'var(--bg-card)',borderRadius:12,padding:'16px',marginBottom:16}}>
        <div style={{fontSize:12,color:'var(--concrete-light)',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600,marginBottom:6}}>Equity</div>
        <ReportRow label="Capital" value={capital} />
        <ReportRow label="Retained earnings" value={retainedEarnings} />
        <ReportRow label="Owner drawings" value={-drawings} />
        <ReportRow label="Total equity" value={totalEquity} bold />
      </div>

      <div className="no-print" style={{marginBottom:16}}>
        {!showDrawForm ? (
          <div onClick={()=>setShowDrawForm(true)} style={{
            textAlign:'center', padding:'12px', borderRadius:10, border:'1px dashed var(--line)',
            color:'var(--accent)', fontSize:13, fontWeight:600, cursor:'pointer'
          }}>+ Log an owner drawing</div>
        ) : (
          <div style={{background:'var(--bg-card)',borderRadius:12,padding:14}}>
            <div style={{fontSize:12,color:'var(--concrete-light)',fontWeight:600,marginBottom:10}}>Log a drawing</div>
            <input type="date" style={{...inputStyle,marginBottom:8}} value={drawDate} onChange={e=>setDrawDate(e.target.value)} />
            <input type="number" inputMode="decimal" style={{...inputStyle,marginBottom:8}} value={drawAmount} onChange={e=>setDrawAmount(e.target.value)} placeholder="Amount taken out" />
            <input style={{...inputStyle,marginBottom:10}} value={drawNotes} onChange={e=>setDrawNotes(e.target.value)} placeholder="Notes (optional)" />
            <div style={{display:'flex',gap:8}}>
              <button onClick={submitDrawing} style={{flex:1,padding:'10px',borderRadius:8,border:'none',background:'var(--accent)',color:'#1c1b19',fontWeight:700,fontSize:13,cursor:'pointer'}}>Save</button>
              <button onClick={()=>setShowDrawForm(false)} style={{flex:1,padding:'10px',borderRadius:8,border:'1px solid var(--line)',background:'none',color:'var(--concrete-light)',fontWeight:600,fontSize:13,cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        )}
        {recentDrawings.length>0 && (
          <div style={{marginTop:12}}>
            {recentDrawings.map(d=>(
              <div key={d.id} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--line)',fontSize:13}}>
                <span style={{color:'var(--concrete-light)'}}>{d.date}{d.notes ? ' · '+d.notes : ''}</span>
                <span style={{fontWeight:600}}>{d.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{background:'var(--bg-card)',borderRadius:12,padding:'16px'}}>
        <ReportRow label="Balance check" value={balanceCheck} bold accent />
        <div style={{fontSize:11,color:'var(--concrete)',marginTop:6}}>
          Should be 0. A non-zero number usually means liabilities aren’t fully tracked yet (e.g. unpaid supplier bills) — not necessarily an error.
        </div>
      </div>
    </div>
  );
}