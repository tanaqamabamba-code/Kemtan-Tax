import React, { useState, useMemo } from 'react';
import { computeFifoForLoss, remainingStock, recomputeItemFifo } from '../fifo';
import { Field, AutocompleteInput, PillSelect, inputStyle } from './Shared';
import { saveState } from '../storage';

const LOSS_REASONS = ['Damage','Theft','Expired','Other'];

export function DamageLossTab({state,setState,toast}){
  const today = new Date().toISOString().slice(0,10);
  const [date,setDate] = useState(today);
  const [item,setItem] = useState('');
  const [qty,setQty] = useState('');
  const [reason,setReason] = useState('');
  const [notes,setNotes] = useState('');

  const itemNames = useMemo(()=>state.items.map(i=>i.name),[state.items]);
  const stockLeft = item ? remainingStock(state,item) : null;

  function reset(keepDate){
    setItem(''); setQty(''); setReason(''); setNotes('');
    if(!keepDate) setDate(today);
  }

  function submit(){
    if(!item){ toast('Choose an item.','bad'); return; }
    if(!state.items.some(i=>i.name===item)){ toast('That item isn’t in your stock list.','bad'); return; }
    if(!qty || Number(qty)<=0){ toast('Enter a quantity greater than 0.','bad'); return; }
    if(!reason){ toast('Choose a reason.','bad'); return; }

    const q = Number(qty);
    const seq = (state.stockAdjustments||[]).length;
    const fifo = computeFifoForLoss(state, item, date, q, null);
    const costValue = Math.round(fifo.price*q*100)/100;

    const adjustmentId = 'adj_'+Date.now();
    const newAdjustment = {
      id: adjustmentId, seq, date, item, qty:q, reason, notes:notes.trim(),
      fifoPrice: Math.round(fifo.price*100)/100, fifoLayer: fifo.layerLabel,
      costValue
    };

    const expenseId = 'exp_'+Date.now();
    const newExpense = {
      id: expenseId, date, description: `Stock loss — ${reason}: ${q}×${item}`,
      accountType:'Stock loss', amount: costValue, notes: notes.trim(),
      paymentStatus:'paid',
      linkedAdjustmentId: adjustmentId
    };

    const next = {
      ...state,
      stockAdjustments: [...(state.stockAdjustments||[]), newAdjustment],
      expenses: [...state.expenses, newExpense]
    };
    setState(next);
    saveState(next);
    toast(`Logged ${q} × ${item} lost to ${reason.toLowerCase()}`, 'good');
    reset(true);
  }

  const recentLosses = [...(state.stockAdjustments||[])].reverse().slice(0,10);

  return (
    <div style={{padding:'0 20px 100px'}}>
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)} />
      </Field>

      <Field label="Item">
        <AutocompleteInput value={item} onChange={setItem} options={itemNames} placeholder="Search items…" />
        {item && (
          <div style={{marginTop:8, fontSize:13, color: stockLeft<=0 ? 'var(--bad)':'var(--concrete-light)'}}>
            {stockLeft<=0 ? `No stock on hand (${stockLeft})` : `${stockLeft} currently in stock`}
          </div>
        )}
      </Field>

      <Field label="Quantity lost">
        <input type="number" inputMode="decimal" style={inputStyle} value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" />
      </Field>

      <Field label="Reason">
        <PillSelect value={reason} onChange={setReason} options={LOSS_REASONS} />
      </Field>

      <Field label="Notes (optional)">
        <input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. found damaged in storeroom" />
      </Field>

      <button onClick={submit} style={{
        width:'100%', padding:'16px', borderRadius:12, border:'none',
        background:'var(--accent)', color:'#1c1b19', fontSize:16, fontWeight:700,
        cursor:'pointer', fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"
      }}>Log loss</button>
      <div style={{fontSize:12,color:'var(--concrete)',marginTop:10,marginBottom:20}}>
        This reduces stock at its FIFO cost and logs a "Stock loss" expense, so your P&amp;L and inventory stay in sync.
      </div>

      <div style={{fontSize:12,color:'var(--concrete-light)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10,fontWeight:600}}>Recent losses</div>
      {recentLosses.length===0 && <div style={{fontSize:13,color:'var(--concrete-light)',textAlign:'center',padding:'20px 0'}}>None logged yet.</div>}
      {recentLosses.map(a=>(
        <div key={a.id} style={{background:'var(--bg-card)',borderRadius:12,padding:'14px 16px',marginBottom:8}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
            <span style={{fontWeight:600,fontSize:15}}>{a.item}</span>
            <span style={{fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",fontWeight:700,color:'var(--bad)'}}>-{a.costValue.toFixed(2)}</span>
          </div>
          <div style={{fontSize:12,color:'var(--concrete-light)',marginTop:4}}>
            {a.qty} units · {a.reason} · {a.date}
          </div>
          {a.notes && <div style={{fontSize:12,color:'var(--concrete)',marginTop:4}}>{a.notes}</div>}
        </div>
      ))}
    </div>
  );
}