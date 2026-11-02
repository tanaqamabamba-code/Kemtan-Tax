import React, { useState, useMemo } from 'react';
import { fifoStockValue, remainingStock } from '../fifo';
import { Field, inputStyle } from './Shared';
import { saveState } from '../storage';

export function StockTab({state,setState,toast}){
  const [query,setQuery] = useState('');
  const [editingItem,setEditingItem] = useState(null);
  const [newName,setNewName] = useState('');
  const [editQty,setEditQty] = useState('');
  const [editPrice,setEditPrice] = useState('');
  const [editAsOf,setEditAsOf] = useState('');

  const rows = useMemo(()=>{
    return state.items
      .map(i=>{
        const stockVal = fifoStockValue(state, i.name);
        return { name:i.name, left: stockVal.qty, value: stockVal.value };
      })
      .filter(r=> query ? r.name.toLowerCase().includes(query.toLowerCase()) : true)
      .sort((a,b)=> a.left - b.left);
  },[state,query]);

  const totalValue = useMemo(()=>{
    return state.items.reduce((sum,i)=> sum + fifoStockValue(state,i.name).value, 0);
  },[state]);

  function startEdit(name){
    setEditingItem(name);
    setNewName(name);
    const item = state.items.find(i=>i.name===name);
    setEditQty(item ? String(item.openingQty) : '0');
    setEditPrice(item ? String(item.openingPrice) : '0');
    setEditAsOf(item && item.openingAsOf ? item.openingAsOf : new Date().toISOString().slice(0,10));
  }

  async function confirmEdit(){
    const trimmedName = newName.trim();
    if(!trimmedName){ toast('Name can’t be empty.','bad'); return; }
    if(trimmedName !== editingItem && state.items.some(i=>i.name===trimmedName)){
      toast('An item with that name already exists.','bad');
      return;
    }
    const qty = editQty===''? 0 : Number(editQty);
    const price = editPrice===''? 0 : Number(editPrice);
    if(isNaN(qty) || qty<0){ toast('Quantity must be 0 or more.','bad'); return; }
    if(isNaN(price) || price<0){ toast('Price must be 0 or more.','bad'); return; }
    if(!editAsOf){ toast('Please choose a date for this count.','bad'); return; }

    const asOfDate = editAsOf;
    const next = {
      ...state,
      items: state.items.map(i=> i.name===editingItem ? {...i, name:trimmedName, openingQty:qty, openingPrice:price, openingAsOf:asOfDate} : i),
      batches: state.batches.map(b=> b.item===editingItem ? {...b, item:trimmedName} : b),
      sales: state.sales.map(s=> s.item===editingItem ? {...s, item:trimmedName} : s),
    };
    setState(next);
    const ok = await saveState(next);
    if(!ok){ toast('Saved on screen, but couldn’t save to storage — try again or check your connection.','bad'); return; }
    toast(`Updated — counted as of ${asOfDate}, earlier purchases won’t be added on top`, 'good');
    setEditingItem(null);
  }

  function resetToZero(){
    setEditQty('0'); setEditPrice('0');
  }

  const [confirmBulkFix,setConfirmBulkFix] = useState(false);
  const [bulkFixDate,setBulkFixDate] = useState(new Date().toISOString().slice(0,10));
  async function fixAllOpeningDates(){
    if(!bulkFixDate){ toast('Please choose a date.','bad'); return; }
    const next = {
      ...state,
      items: state.items.map(i=> ({...i, openingAsOf: bulkFixDate}))
    };
    setState(next);
    const ok = await saveState(next);
    if(!ok){ toast('Saved on screen, but couldn’t save to storage — try again.','bad'); return; }
    toast(`All items now counted as of ${bulkFixDate} — earlier Buy/Sale/Loss records won’t be added on top`, 'good');
    setConfirmBulkFix(false);
  }

  return (
    <div style={{padding:'0 20px 100px'}}>
      <div style={{background:'var(--bg-card)',borderRadius:12,padding:'14px 16px',marginBottom:16}}>
        <div style={{fontSize:12,color:'var(--concrete-light)'}}>Total stock value (FIFO cost)</div>
        <div style={{fontSize:22,fontWeight:700,fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"}}>{totalValue.toFixed(2)}</div>
      </div>

      <Field label="Search">
        <input style={inputStyle} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Filter items…" />
      </Field>
      <div style={{fontSize:12,color:'var(--concrete)',marginTop:-10,marginBottom:14}}>Tap an item to rename or edit its stock values.</div>

      {confirmBulkFix ? (
        <div style={{background:'var(--bg-card)',borderRadius:12,padding:14,marginBottom:16}}>
          <div style={{fontSize:13,marginBottom:10}}>
            This marks every item as counted on the date you choose, so old Buy/Sale/Loss records stop being added on top of the quantities you already corrected. This can’t be undone automatically.
          </div>
          <div style={{fontSize:11,color:'var(--concrete-light)',marginBottom:4}}>Counted as of</div>
          <input type="date" style={{...inputStyle, marginBottom:12}} value={bulkFixDate} onChange={e=>setBulkFixDate(e.target.value)} />
          <div style={{display:'flex',gap:8}}>
            <button onClick={fixAllOpeningDates} style={{flex:1,padding:'10px',borderRadius:8,border:'none',background:'var(--accent)',color:'#1c1b19',fontWeight:700,fontSize:13,cursor:'pointer'}}>Yes, fix all items</button>
            <button onClick={()=>setConfirmBulkFix(false)} style={{flex:1,padding:'10px',borderRadius:8,border:'1px solid var(--line)',background:'none',color:'var(--concrete-light)',fontWeight:600,fontSize:13,cursor:'pointer'}}>Cancel</button>
          </div>
        </div>
      ) : (
        <div onClick={()=>setConfirmBulkFix(true)} style={{
          fontSize:12, color:'var(--accent)', textDecoration:'underline', cursor:'pointer', marginBottom:20
        }}>Already recounted all your items? Fix stock totals now</div>
      )}

      {rows.map(r=>(
        <div key={r.name} style={{
          padding:'13px 16px', background:'var(--bg-card)', borderRadius:10, marginBottom:8
        }}>
          {editingItem===r.name ? (
            <div>
              <div style={{fontSize:11,color:'var(--concrete-light)',marginBottom:4}}>Name</div>
              <input style={{...inputStyle, marginBottom:10}} value={newName} onChange={e=>setNewName(e.target.value)} autoFocus />

              <div style={{background:'var(--bg-raised)',borderRadius:8,padding:'10px 12px',marginBottom:12,fontSize:12,color:'var(--concrete-light)'}}>
                Currently in stock: <span style={{color:'var(--paper)',fontWeight:700}}>{r.left}</span>
                {(() => {
                  const item = state.items.find(i=>i.name===r.name);
                  return item && item.openingAsOf
                    ? <span> (opening quantity below, counted as of {item.openingAsOf}, plus any Buy/Sale/Loss after that date)</span>
                    : <span> (opening quantity below, plus every Buy since, minus every Sale and Loss)</span>;
                })()}
              </div>

              <div style={{display:'flex',gap:10,marginBottom:6}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:'var(--concrete-light)',marginBottom:4}}>Opening quantity</div>
                  <input type="number" inputMode="decimal" style={{...inputStyle,padding:'10px'}} value={editQty} onChange={e=>setEditQty(e.target.value)} />
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:'var(--concrete-light)',marginBottom:4}}>Opening cost price</div>
                  <input type="number" inputMode="decimal" style={{...inputStyle,padding:'10px'}} value={editPrice} onChange={e=>setEditPrice(e.target.value)} />
                </div>
              </div>
              <div onClick={resetToZero} style={{fontSize:12,color:'var(--accent)',cursor:'pointer',textDecoration:'underline',marginBottom:12}}>Reset both to 0</div>

              <div style={{fontSize:11,color:'var(--concrete-light)',marginBottom:4}}>Counted as of</div>
              <input type="date" style={{...inputStyle, marginBottom:12}} value={editAsOf} onChange={e=>setEditAsOf(e.target.value)} />

              <div style={{fontSize:11,color:'var(--concrete)',marginBottom:12}}>
                Saving this sets the count as of the date above. Purchases, sales, and losses logged before that date won’t be added on top — only ones from that date onward will.
              </div>

              <div style={{display:'flex',gap:8}}>
                <button onClick={confirmEdit} style={{
                  flex:1, padding:'10px', borderRadius:8, border:'none', background:'var(--accent)',
                  color:'#1c1b19', fontWeight:700, fontSize:13, cursor:'pointer'
                }}>Save</button>
                <button onClick={()=>setEditingItem(null)} style={{
                  flex:1, padding:'10px', borderRadius:8, border:'1px solid var(--line)', background:'none',
                  color:'var(--concrete-light)', fontWeight:600, fontSize:13, cursor:'pointer'
                }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div onClick={()=>startEdit(r.name)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer'}}>
              <span style={{fontSize:14}}>{r.name}</span>
              <div style={{textAlign:'right'}}>
                <div style={{
                  fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif", fontWeight:700, fontSize:15,
                  color: r.left<=0 ? 'var(--bad)' : r.left<5 ? 'var(--accent)' : 'var(--paper)'
                }}>{r.left}</div>
                <div style={{fontSize:11,color:'var(--concrete-light)'}}>{r.value.toFixed(2)}</div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}