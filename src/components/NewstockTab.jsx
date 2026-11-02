import React, { useState, useMemo } from 'react';
import { Field, AutocompleteInput, PillSelect, inputStyle } from './Shared';
import { saveState } from '../storage';
import { downloadCSV } from '../utils';

function emptyBuyRow(){
  return { key: 'buyrow_'+Date.now()+'_'+Math.random(), item:'', qty:'', price:'', paymentStatus:'paid', supplierName:'' };
}

export function NewstockTab({state,setState,toast}){
  const today = new Date().toISOString().slice(0,10);
  const [date,setDate] = useState(today);
  const [rows,setRows] = useState([emptyBuyRow()]);

  const itemNames = useMemo(()=>state.items.map(i=>i.name),[state.items]);

  function reset(keepDate){
    setRows([emptyBuyRow()]);
    if(!keepDate) setDate(today);
  }

  function updateRow(key, field, value){
    setRows(rows.map(r=> r.key===key ? {...r, [field]:value} : r));
  }
  function addRow(){
    setRows([...rows, emptyBuyRow()]);
  }
  function removeRow(key){
    if(rows.length===1){ setRows([emptyBuyRow()]); return; }
    setRows(rows.filter(r=>r.key!==key));
  }

  function submit(){
    for(const r of rows){
      if(!r.item){ toast('Every row needs an item.','bad'); return; }
      if(!r.qty || Number(r.qty)<=0){ toast('Every row needs a quantity greater than 0.','bad'); return; }
      if(!r.price || Number(r.price)<0){ toast('Every row needs a valid price.','bad'); return; }
      if(r.paymentStatus==='credit' && !r.supplierName.trim()){ toast(`Enter the supplier for "${r.item}" (on credit) or switch it to paid.`,'bad'); return; }
    }

    let nextItems = state.items;
    let nextBatches = [...state.batches];
    let nextLedger = state.ledger || [];

    for(const r of rows){
      const q = Number(r.qty), p = Number(r.price);
      const isNewItem = !nextItems.some(i=>i.name===r.item);
      if(isNewItem){
        nextItems = [...nextItems, { name:r.item, openingQty:0, openingPrice:p }];
      }
      const batchId = 'batch_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
      nextBatches = [...nextBatches, { id:batchId, date, item:r.item, qty:q, price:p, paymentStatus:r.paymentStatus }];

      if(r.paymentStatus==='credit'){
        const total = Math.round(q*p*100)/100;
        nextLedger = [...nextLedger, {
          id:'ledger_'+Date.now()+'_'+Math.random().toString(36).slice(2,7), date, type:'payable', name:r.supplierName.trim(),
          item: `${q}×${r.item}`, amount: total, status:'open', settledDate:null,
          linkedBatchId: batchId
        }];
      }
    }

    const next = {...state, items:nextItems, batches:nextBatches, ledger:nextLedger};
    setState(next);
    saveState(next);
    const itemCount = rows.length;
    toast(itemCount===1 ? `Added ${rows[0].qty} × ${rows[0].item} to stock` : `Added ${itemCount} items to stock`, 'good');
    reset(true);
  }

  function downloadPurchaseHistory(){
    const headers = [
      {key:'date', label:'Date'},
      {key:'item', label:'Item'},
      {key:'qty', label:'Quantity'},
      {key:'price', label:'Price Paid (each)'},
      {key:'total', label:'Total'},
      {key:'status', label:'Payment Status'},
      {key:'supplier', label:'Supplier'},
    ];
    const rows2 = [...state.batches]
      .sort((a,b)=> a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
      .map(b=>{
        const linkedLedger = (state.ledger||[]).find(l=>l.linkedBatchId===b.id);
        return {
          date: b.date,
          item: b.item,
          qty: b.qty,
          price: b.price.toFixed(2),
          total: (b.qty*b.price).toFixed(2),
          status: b.paymentStatus==='credit' ? (linkedLedger && linkedLedger.status==='settled' ? 'credit (settled)' : 'credit (open)') : 'paid',
          supplier: linkedLedger ? linkedLedger.name : '',
        };
      });
    if(rows2.length===0){ toast('No purchases to download yet.','bad'); return; }
    downloadCSV(rows2, headers, `purchase-history-${new Date().toISOString().slice(0,10)}.csv`);
  }

  return (
    <div style={{padding:'0 20px 100px'}}>
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)} />
      </Field>

      <div style={{fontSize:12,color:'var(--concrete-light)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10,fontWeight:600}}>Items</div>
      {rows.map((r,idx)=>{
        const isNewItem = r.item && !state.items.some(i=>i.name===r.item);
        return (
          <div key={r.key} style={{background:'var(--bg-card)',borderRadius:12,padding:14,marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <span style={{fontSize:12,color:'var(--concrete-light)',fontWeight:600}}>Item {idx+1}</span>
              {rows.length>1 && (
                <span onClick={()=>removeRow(r.key)} style={{fontSize:12,color:'var(--bad)',cursor:'pointer',textDecoration:'underline'}}>Remove</span>
              )}
            </div>
            <AutocompleteInput value={r.item} onChange={v=>updateRow(r.key,'item',v)} options={itemNames} placeholder="Search or type a new item…" />
            {isNewItem && (
              <div style={{marginTop:6, marginBottom:2, fontSize:12, color:'var(--accent)'}}>
                New item — will be added to your item list
              </div>
            )}
            <div style={{display:'flex',gap:10,marginTop:10}}>
              <div style={{flex:1}}>
                <div style={{fontSize:11,color:'var(--concrete-light)',marginBottom:4}}>Quantity bought</div>
                <input type="number" inputMode="decimal" style={{...inputStyle,padding:'10px'}} value={r.qty} onChange={e=>updateRow(r.key,'qty',e.target.value)} placeholder="0" />
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:11,color:'var(--concrete-light)',marginBottom:4}}>Price paid (each)</div>
                <input type="number" inputMode="decimal" style={{...inputStyle,padding:'10px'}} value={r.price} onChange={e=>updateRow(r.key,'price',e.target.value)} placeholder="0.00" />
              </div>
            </div>
            {r.qty && r.price && (
              <div style={{marginTop:8,fontSize:12,color:'var(--concrete-light)'}}>
                Row total: <span style={{color:'var(--paper)',fontWeight:600}}>{(Number(r.qty)*Number(r.price)).toFixed(2)}</span>
              </div>
            )}

            <div style={{marginTop:12}}>
              <div style={{fontSize:11,color:'var(--concrete-light)',marginBottom:6}}>Payment</div>
              <PillSelect value={r.paymentStatus} onChange={v=>updateRow(r.key,'paymentStatus',v)} options={['paid','credit']} />
            </div>
            {r.paymentStatus==='credit' && (
              <div style={{marginTop:10}}>
                <div style={{fontSize:11,color:'var(--concrete-light)',marginBottom:4}}>Supplier (optional per item)</div>
                <input style={{...inputStyle,padding:'10px'}} value={r.supplierName} onChange={e=>updateRow(r.key,'supplierName',e.target.value)} placeholder="Who do you owe for this item?" />
              </div>
            )}
          </div>
        );
      })}

      <div onClick={addRow} style={{
        textAlign:'center', padding:'12px', borderRadius:10, border:'1px dashed var(--line)',
        color:'var(--accent)', fontSize:13, fontWeight:600, cursor:'pointer', marginBottom:20
      }}>+ Add another item</div>

      {rows.some(r=>r.qty&&r.price) && (
        <div style={{background:'var(--bg-card)',borderRadius:12,padding:'14px 16px',marginBottom:16,fontSize:14,color:'var(--concrete-light)'}}>
          Total cost: <span style={{color:'var(--paper)',fontWeight:600}}>
            {rows.reduce((a,r)=> a + (Number(r.qty)||0)*(Number(r.price)||0), 0).toFixed(2)}
          </span>
        </div>
      )}

      <button onClick={submit} style={{
        width:'100%', padding:'16px', borderRadius:12, border:'none',
        background:'var(--accent)', color:'#1c1b19', fontSize:16, fontWeight:700,
        cursor:'pointer', fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"
      }}>Add stock</button>

      <div style={{marginTop:28}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <div style={{fontSize:12,color:'var(--concrete-light)',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600}}>Recent purchases</div>
          <div onClick={downloadPurchaseHistory} style={{fontSize:12,color:'var(--accent)',cursor:'pointer',textDecoration:'underline'}}>Download all (CSV)</div>
        </div>
        {[...state.batches].reverse().slice(0,8).map((b,idx)=>(
          <div key={idx} style={{padding:'10px 0',borderBottom:'1px solid var(--line)',fontSize:14}}>
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <span>{b.item}</span>
              <span style={{color:'var(--concrete-light)'}}>{b.qty} @ {b.price.toFixed(2)}</span>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',marginTop:2,fontSize:11,color:'var(--concrete)'}}>
              <span>{b.date}</span>
              <span style={{color: b.paymentStatus==='credit' ? 'var(--accent)' : 'var(--good)'}}>{b.paymentStatus==='credit' ? 'On credit' : 'Paid'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}