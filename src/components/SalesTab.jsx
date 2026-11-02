import React, { useState, useMemo } from 'react';
import { computeFifoForSale, remainingStock, recomputeItemFifo, afterOpeningCutover } from '../fifo';
import { emptyRow } from '../utils';
import { Field, AutocompleteInput, PillSelect, inputStyle } from './Shared';
import { saveState } from '../storage';

export function SalesTab({state,setState,toast}){
  const today = new Date().toISOString().slice(0,10);
  const [date,setDate] = useState(today);
  const [rows,setRows] = useState([emptyRow()]);
  const [agent,setAgent] = useState('');
  const [manageAgents,setManageAgents] = useState(false);
  const [editingAgent,setEditingAgent] = useState(null);
  const [newAgentName,setNewAgentName] = useState('');
  const [addAgentName,setAddAgentName] = useState('');
  const [paymentStatus,setPaymentStatus] = useState('paid');
  const [customerName,setCustomerName] = useState('');

  const itemNames = useMemo(()=>state.items.map(i=>i.name),[state.items]);

  function reset(keepDate){
    setRows([emptyRow()]); setAgent(''); setPaymentStatus('paid'); setCustomerName('');
    if(!keepDate) setDate(today);
  }

  function updateRow(key, field, value){
    setRows(rows.map(r=> r.key===key ? {...r, [field]:value} : r));
  }
  function addRow(){
    setRows([...rows, emptyRow()]);
  }
  function removeRow(key){
    if(rows.length===1){ setRows([emptyRow()]); return; }
    setRows(rows.filter(r=>r.key!==key));
  }

  function submit(){
    for(const r of rows){
      if(!r.item){ toast('Every row needs an item.','bad'); return; }
      if(!state.items.some(i=>i.name===r.item)){ toast(`"${r.item}" isn’t in your stock list. Add it via Buy stock first.`,'bad'); return; }
      if(!r.qty || Number(r.qty)<=0){ toast('Every row needs a quantity greater than 0.','bad'); return; }
      if(!r.price || Number(r.price)<=0){ toast('Every row needs a price greater than 0.','bad'); return; }
    }
    if(!agent){ toast('Choose who made the sale.','bad'); return; }
    if(paymentStatus==='credit' && !customerName.trim()){ toast('Enter the customer’s name for a credit sale.','bad'); return; }

    let runningState = state;
    const newSales = [];
    for(const r of rows){
      const seq = runningState.sales.length;
      const tempId = 'sale_'+Date.now()+'_'+seq+'_'+Math.random().toString(36).slice(2,7);
      const q = Number(r.qty), p = Number(r.price);
      const fifo = computeFifoForSale(runningState, r.item, date, q, null);
      const grossProfit = (p - fifo.price) * q;
      const newSale = {
        id: tempId, seq, date, item:r.item, qty:q, price:p, agent,
        fifoPrice: Math.round(fifo.price*100)/100,
        fifoLayer: fifo.layerLabel,
        grossProfit: Math.round(grossProfit*100)/100,
        paymentStatus,
        ledgerId: null
      };
      newSales.push(newSale);
      runningState = {...runningState, sales:[...runningState.sales, newSale]};
    }

    let nextLedger = state.ledger || [];
    if(paymentStatus==='credit'){
      const totalAmount = newSales.reduce((a,s)=>a+s.qty*s.price,0);
      const ledgerId = 'ledger_'+Date.now();
      nextLedger = [...nextLedger, {
        id: ledgerId, date, type:'receivable', name:customerName.trim(),
        item: newSales.map(s=>`${s.qty}×${s.item}`).join(', '),
        amount: Math.round(totalAmount*100)/100, status:'open', settledDate:null,
        linkedSaleIds: newSales.map(s=>s.id)
      }];
      newSales.forEach(s=>{ s.ledgerId = ledgerId; });
    }

    const next = {...state, sales:[...state.sales, ...newSales], ledger:nextLedger};
    setState(next);
    saveState(next);
    const itemCount = rows.length;
    const paidNote = paymentStatus==='credit' ? ' (on credit)' : '';
    toast((itemCount===1 ? `Added ${rows[0].qty} × ${rows[0].item}` : `Added ${itemCount} items`)+paidNote, 'good');
    reset(true);
  }

  function startRenameAgent(name){
    setEditingAgent(name);
    setNewAgentName(name);
  }

  function confirmRenameAgent(){
    const trimmed = newAgentName.trim();
    if(!trimmed){ toast('Name can’t be empty.','bad'); return; }
    if(trimmed !== editingAgent && state.agents.includes(trimmed)){
      toast('That agent already exists.','bad'); return;
    }
    const next = {
      ...state,
      agents: state.agents.map(a=> a===editingAgent ? trimmed : a),
      sales: state.sales.map(s=> s.agent===editingAgent ? {...s, agent:trimmed} : s),
    };
    setState(next);
    saveState(next);
    if(agent===editingAgent) setAgent(trimmed);
    toast(`Renamed to "${trimmed}"`, 'good');
    setEditingAgent(null);
  }

  function removeAgent(name){
    const usedInSales = state.sales.some(s=>s.agent===name);
    if(usedInSales){
      toast('Can’t remove — this agent has past sales recorded. Rename instead.','bad');
      return;
    }
    const next = {...state, agents: state.agents.filter(a=>a!==name)};
    setState(next);
    saveState(next);
    toast(`Removed ${name}`, 'good');
  }

  function addAgent(){
    const trimmed = addAgentName.trim();
    if(!trimmed){ return; }
    if(state.agents.includes(trimmed)){ toast('That agent already exists.','bad'); return; }
    const next = {...state, agents:[...state.agents, trimmed]};
    setState(next);
    saveState(next);
    setAddAgentName('');
    toast(`Added ${trimmed}`, 'good');
  }

  return (
    <div style={{padding:'0 20px 100px'}}>
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)} />
      </Field>

      <div style={{fontSize:12,color:'var(--concrete-light)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10,fontWeight:600}}>Items</div>
      {rows.map((r,idx)=>{
        const stockLeft = r.item ? remainingStock(state,r.item) : null;
        return (
          <div key={r.key} style={{background:'var(--bg-card)',borderRadius:12,padding:14,marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <span style={{fontSize:12,color:'var(--concrete-light)',fontWeight:600}}>Item {idx+1}</span>
              {rows.length>1 && (
                <span onClick={()=>removeRow(r.key)} style={{fontSize:12,color:'var(--bad)',cursor:'pointer',textDecoration:'underline'}}>Remove</span>
              )}
            </div>
            <AutocompleteInput value={r.item} onChange={v=>updateRow(r.key,'item',v)} options={itemNames} placeholder="Search items…" />
            {r.item && (
              <div style={{marginTop:6, marginBottom:10, fontSize:12, color: stockLeft<=0 ? 'var(--bad)':'var(--concrete-light)'}}>
                {stockLeft<=0 ? `Out of stock (${stockLeft} on hand)` : `${stockLeft} left in stock`}
              </div>
            )}
            <div style={{display:'flex',gap:10,marginTop:10}}>
              <div style={{flex:1}}>
                <div style={{fontSize:11,color:'var(--concrete-light)',marginBottom:4}}>Quantity</div>
                <input type="number" inputMode="decimal" style={{...inputStyle,padding:'10px'}} value={r.qty} onChange={e=>updateRow(r.key,'qty',e.target.value)} placeholder="0" />
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:11,color:'var(--concrete-light)',marginBottom:4}}>Price (each)</div>
                <input type="number" inputMode="decimal" style={{...inputStyle,padding:'10px'}} value={r.price} onChange={e=>updateRow(r.key,'price',e.target.value)} placeholder="0.00" />
              </div>
            </div>
            {r.qty && r.price && (
              <div style={{marginTop:8,fontSize:12,color:'var(--concrete-light)'}}>
                Row total: <span style={{color:'var(--paper)',fontWeight:600}}>{(Number(r.qty)*Number(r.price)).toFixed(2)}</span>
              </div>
            )}
          </div>
        );
      })}

      <div onClick={addRow} style={{
        textAlign:'center', padding:'12px', borderRadius:10, border:'1px dashed var(--line)',
        color:'var(--accent)', fontSize:13, fontWeight:600, cursor:'pointer', marginBottom:20
      }}>+ Add another item</div>

      <Field label="Sales agent">
        <PillSelect value={agent} onChange={setAgent} options={state.agents} />
      </Field>

      <div onClick={()=>setManageAgents(!manageAgents)} style={{
        fontSize:12, color:'var(--concrete-light)', textDecoration:'underline', cursor:'pointer', marginBottom:16
      }}>{manageAgents ? 'Hide agent list' : 'Manage agents'}</div>

      {manageAgents && (
        <div style={{background:'var(--bg-card)',borderRadius:12,padding:14,marginBottom:16}}>
          {state.agents.map(a=>(
            <div key={a} style={{padding:'8px 0',borderBottom:'1px solid var(--line)'}}>
              {editingAgent===a ? (
                <div>
                  <input style={{...inputStyle, marginBottom:8, padding:'8px 10px'}} value={newAgentName} onChange={e=>setNewAgentName(e.target.value)} autoFocus />
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={confirmRenameAgent} style={{flex:1,padding:'8px',borderRadius:8,border:'none',background:'var(--accent)',color:'#1c1b19',fontWeight:700,fontSize:12,cursor:'pointer'}}>Save</button>
                    <button onClick={()=>setEditingAgent(null)} style={{flex:1,padding:'8px',borderRadius:8,border:'1px solid var(--line)',background:'none',color:'var(--concrete-light)',fontWeight:600,fontSize:12,cursor:'pointer'}}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:14}} onClick={()=>startRenameAgent(a)}>{a}</span>
                  <div style={{display:'flex',gap:14}}>
                    <span onClick={()=>startRenameAgent(a)} style={{fontSize:12,color:'var(--concrete-light)',cursor:'pointer',textDecoration:'underline'}}>Rename</span>
                    <span onClick={()=>removeAgent(a)} style={{fontSize:12,color:'var(--bad)',cursor:'pointer',textDecoration:'underline'}}>Remove</span>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div style={{display:'flex',gap:8,marginTop:12}}>
            <input style={{...inputStyle,padding:'8px 10px',fontSize:14}} value={addAgentName} onChange={e=>setAddAgentName(e.target.value)} placeholder="New agent name" />
            <button onClick={addAgent} style={{padding:'8px 16px',borderRadius:8,border:'none',background:'var(--accent)',color:'#1c1b19',fontWeight:700,fontSize:13,cursor:'pointer'}}>Add</button>
          </div>
        </div>
      )}

      <Field label="Payment">
        <PillSelect value={paymentStatus} onChange={setPaymentStatus} options={['paid','credit']} />
        <div style={{fontSize:12,color:'var(--concrete)',marginTop:6}}>
          {paymentStatus==='credit' ? 'Sale happens now, payment comes later — tracked in Owed.' : 'Cash received now.'}
        </div>
      </Field>

      {paymentStatus==='credit' && (
        <Field label="Customer name">
          <input style={inputStyle} value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="Who owes for this?" />
        </Field>
      )}

      {rows.some(r=>r.qty&&r.price) && (
        <div style={{background:'var(--bg-card)',borderRadius:12,padding:'14px 16px',marginBottom:16,fontSize:14,color:'var(--concrete-light)'}}>
          Total: <span style={{color:'var(--paper)',fontWeight:600}}>
            {rows.reduce((a,r)=> a + (Number(r.qty)||0)*(Number(r.price)||0), 0).toFixed(2)}
          </span>
        </div>
      )}

      <button onClick={submit} style={{
        width:'100%', padding:'16px', borderRadius:12, border:'none',
        background:'var(--accent)', color:'#1c1b19', fontSize:16, fontWeight:700,
        cursor:'pointer', fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"
      }}>Add sale</button>
    </div>
  );
}