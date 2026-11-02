import React, { useState, useMemo } from 'react';
import { Field, AutocompleteInput, PillSelect, inputStyle } from './Shared';
import { fmtMoney, openReceivablesTotal, openPayablesTotal, ledgerPaidTotal, ledgerRemaining } from '../utils';
import { saveState } from '../storage';

export function LedgerTab({state,setState,toast}){
  const today = new Date().toISOString().slice(0,10);
  const [type,setType] = useState('receivable');
  const [date,setDate] = useState(today);
  const [name,setName] = useState('');
  const [itemDesc,setItemDesc] = useState('');
  const [amount,setAmount] = useState('');
  const [filter,setFilter] = useState('open');
  const [payingId,setPayingId] = useState(null);
  const [payAmount,setPayAmount] = useState('');
  const [payDate,setPayDate] = useState(today);

  function reset(){ setName(''); setItemDesc(''); setAmount(''); }

  function submit(){
    if(!name.trim()){ toast('Enter a customer or supplier name.','bad'); return; }
    if(!amount || Number(amount)<=0){ toast('Enter an amount greater than 0.','bad'); return; }
    const entry = {
      id:'ledger_'+Date.now(), date, type, name:name.trim(), item:itemDesc.trim(),
      amount:Number(amount), status:'open', settledDate:null, payments:[]
    };
    const next = {...state, ledger:[...(state.ledger||[]), entry]};
    setState(next);
    saveState(next);
    toast(`Logged ${type==='payable'?'amount owed to':'amount owed by'} ${entry.name}`, 'good');
    reset();
  }

  function markSettled(id){
    const next = {
      ...state,
      ledger: state.ledger.map(l=> l.id===id ? {...l, status:'settled', settledDate: today} : l)
    };
    setState(next);
    saveState(next);
    toast('Marked as settled', 'good');
  }

  function reopen(id){
    const next = {
      ...state,
      ledger: state.ledger.map(l=> l.id===id ? {...l, status:'open', settledDate:null} : l)
    };
    setState(next);
    saveState(next);
  }

  function startPayment(id){
    setPayingId(id);
    setPayAmount('');
    setPayDate(today);
  }

  function submitPayment(entry){
    const amt = Number(payAmount);
    if(!payAmount || amt<=0){ toast('Enter a payment amount greater than 0.','bad'); return; }
    const remaining = ledgerRemaining(entry);
    if(amt > remaining + 0.005){ toast(`That’s more than the ${fmtMoney(remaining)} still owing — enter ${fmtMoney(remaining)} or less.`,'bad'); return; }
    const newPayments = [...(entry.payments||[]), { date: payDate, amount: amt }];
    const paidTotal = newPayments.reduce((a,p)=>a+p.amount,0);
    const fullySettled = paidTotal >= entry.amount - 0.005;
    const next = {
      ...state,
      ledger: state.ledger.map(l=> l.id===entry.id ? {
        ...l, payments:newPayments,
        status: fullySettled ? 'settled' : 'open',
        settledDate: fullySettled ? payDate : null
      } : l)
    };
    setState(next);
    saveState(next);
    toast(fullySettled ? 'Payment logged — fully settled' : `Payment logged — ${fmtMoney(ledgerRemaining({...entry, payments:newPayments}))} still owing`, 'good');
    setPayingId(null);
  }

  const rows = (state.ledger||[])
    .filter(l=> filter==='all' ? true : l.status===filter)
    .sort((a,b)=> b.date.localeCompare(a.date));

  const totalReceivable = openReceivablesTotal(state);
  const totalPayable = openPayablesTotal(state);

  return (
    <div style={{padding:'0 20px 100px'}}>
      <div style={{display:'flex',gap:12,marginBottom:16}}>
        <div style={{flex:1,background:'var(--bg-card)',borderRadius:12,padding:'14px'}}>
          <div style={{fontSize:12,color:'var(--concrete-light)'}}>Owed to you</div>
          <div style={{fontSize:18,fontWeight:700,fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",color:'var(--good)'}}>{totalReceivable.toFixed(2)}</div>
        </div>
        <div style={{flex:1,background:'var(--bg-card)',borderRadius:12,padding:'14px'}}>
          <div style={{fontSize:12,color:'var(--concrete-light)'}}>You owe</div>
          <div style={{fontSize:18,fontWeight:700,fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",color:'var(--bad)'}}>{totalPayable.toFixed(2)}</div>
        </div>
      </div>

      <Field label="Type">
        <PillSelect value={type} onChange={setType} options={['receivable','payable']} />
        <div style={{fontSize:12,color:'var(--concrete)',marginTop:6}}>
          {type==='receivable' ? 'Someone owes you money (e.g. sold on credit)' : 'You owe someone money (e.g. unpaid supplier bill)'}
        </div>
      </Field>

      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)} />
      </Field>

      <Field label={type==='receivable' ? 'Customer name' : 'Supplier name'}>
        <input style={inputStyle} value={name} onChange={e=>setName(e.target.value)} placeholder="Name" />
      </Field>

      <Field label="Item (optional)">
        <input style={inputStyle} value={itemDesc} onChange={e=>setItemDesc(e.target.value)} placeholder="e.g. 10 bags Cement 42.5" />
      </Field>

      <Field label="Amount">
        <input type="number" inputMode="decimal" style={inputStyle} value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" />
      </Field>

      <button onClick={submit} style={{
        width:'100%', padding:'16px', borderRadius:12, border:'none',
        background:'var(--accent)', color:'#1c1b19', fontSize:16, fontWeight:700,
        cursor:'pointer', fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"
      }}>Log entry</button>

      <div style={{display:'flex',gap:6,marginTop:24,marginBottom:14}}>
        {[{k:'open',l:'Open'},{k:'settled',l:'Settled'},{k:'all',l:'All'}].map(f=>(
          <button key={f.k} onClick={()=>setFilter(f.k)} style={{
            flex:1, padding:'8px 4px', borderRadius:8, fontSize:12.5, fontWeight:700, cursor:'pointer',
            border: filter===f.k ? '1px solid var(--accent)' : '1px solid var(--line)',
            background: filter===f.k ? 'var(--accent)' : 'none',
            color: filter===f.k ? '#1c1b19' : 'var(--concrete-light)'
          }}>{f.l}</button>
        ))}
      </div>

      {rows.length===0 && <div style={{fontSize:13,color:'var(--concrete-light)',textAlign:'center',padding:'20px 0'}}>Nothing here.</div>}
      {rows.map(l=>{
        const paid = ledgerPaidTotal(l);
        const remaining = ledgerRemaining(l);
        const hasPayments = (l.payments||[]).length > 0;
        return (
        <div key={l.id} style={{background:'var(--bg-card)',borderRadius:12,padding:'14px 16px',marginBottom:8}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
            <span style={{fontWeight:600,fontSize:15}}>{l.name}</span>
            <span style={{
              fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif", fontWeight:700,
              color: l.type==='receivable' ? 'var(--good)' : 'var(--bad)'
            }}>{l.amount.toFixed(2)}</span>
          </div>
          <div style={{fontSize:12,color:'var(--concrete-light)',marginTop:4}}>
            {l.type==='receivable' ? 'Owed to you' : 'You owe'} &middot; {l.date}
            {l.status==='settled' && ` · settled ${l.settledDate}`}
          </div>
          {l.item && (
            <div style={{fontSize:12,color:'var(--concrete)',marginTop:4}}>{l.item}</div>
          )}

          {hasPayments && (
            <div style={{marginTop:8,background:'var(--bg-raised)',borderRadius:8,padding:'8px 10px'}}>
              <div style={{fontSize:11,color:'var(--concrete-light)',marginBottom:4}}>Payments received</div>
              {l.payments.map((p,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--concrete-light)',padding:'2px 0'}}>
                  <span>{p.date}</span>
                  <span style={{color:'var(--paper)'}}>{p.amount.toFixed(2)}</span>
                </div>
              ))}
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,fontWeight:700,marginTop:4,paddingTop:4,borderTop:'1px solid var(--line)'}}>
                <span>Still owing</span>
                <span>{remaining.toFixed(2)}</span>
              </div>
            </div>
          )}

          {l.status==='open' && payingId===l.id ? (
            <div style={{marginTop:10,background:'var(--bg-raised)',borderRadius:8,padding:10}}>
              <div style={{fontSize:11,color:'var(--concrete-light)',marginBottom:4}}>Payment amount (of {fmtMoney(remaining)} owing)</div>
              <input type="number" inputMode="decimal" style={{...inputStyle,padding:'10px',marginBottom:8}} value={payAmount} onChange={e=>setPayAmount(e.target.value)} placeholder="0.00" autoFocus />
              <div style={{fontSize:11,color:'var(--concrete-light)',marginBottom:4}}>Date</div>
              <input type="date" style={{...inputStyle,padding:'10px',marginBottom:10}} value={payDate} onChange={e=>setPayDate(e.target.value)} />
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>submitPayment(l)} style={{flex:1,padding:'10px',borderRadius:8,border:'none',background:'var(--accent)',color:'#1c1b19',fontWeight:700,fontSize:13,cursor:'pointer'}}>Log payment</button>
                <button onClick={()=>setPayingId(null)} style={{flex:1,padding:'10px',borderRadius:8,border:'1px solid var(--line)',background:'none',color:'var(--concrete-light)',fontWeight:600,fontSize:13,cursor:'pointer'}}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{marginTop:8,display:'flex',gap:14}}>
              {l.status==='open' ? (
                <React.Fragment>
                  <span onClick={()=>startPayment(l.id)} style={{fontSize:12,color:'var(--accent)',cursor:'pointer',textDecoration:'underline'}}>Log a payment</span>
                  <span onClick={()=>markSettled(l.id)} style={{fontSize:12,color:'var(--concrete-light)',cursor:'pointer',textDecoration:'underline'}}>Mark fully settled</span>
                </React.Fragment>
              ) : (
                <span onClick={()=>reopen(l.id)} style={{fontSize:12,color:'var(--concrete-light)',cursor:'pointer',textDecoration:'underline'}}>Reopen</span>
              )}
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
}