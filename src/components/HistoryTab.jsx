import React, { useState, useMemo } from 'react';
import { computeFifoForSale, remainingStock, recomputeItemFifo } from '../fifo';
import { startOfWeek, addDays } from '../utils';
import { Field, AutocompleteInput, inputStyle } from './Shared';
import { saveState } from '../storage';

export function HistoryTab({state,setState,toast}){
  const today = new Date().toISOString().slice(0,10);
  const [mode,setMode] = useState('day');
  const [filterDate,setFilterDate] = useState(today);
  const [weekStart,setWeekStart] = useState(startOfWeek(today));
  const [editingSale,setEditingSale] = useState(null);
  const [editQty,setEditQty] = useState('');
  const [editPrice,setEditPrice] = useState('');
  const [confirmDelete,setConfirmDelete] = useState(null);

  const itemNames = useMemo(()=>state.items.map(i=>i.name),[state.items]);

  function startEdit(sale){
    setEditingSale(sale.id);
    setEditQty(String(sale.qty));
    setEditPrice(String(sale.price));
    setConfirmDelete(null);
  }

  function cancelEdit(){ setEditingSale(null); }

  function saveEdit(sale){
    const q = Number(editQty), p = Number(editPrice);
    if(!q || q<=0){ toast('Quantity must be greater than 0.','bad'); return; }
    if(!p || p<=0){ toast('Price must be greater than 0.','bad'); return; }

    let next = {
      ...state,
      sales: state.sales.map(s=> s.id===sale.id ? {...s, qty:q, price:p} : s)
    };
    next.sales = recomputeItemFifo(next, sale.item);
    setState(next);
    saveState(next);
    toast('Sale updated','good');
    setEditingSale(null);
  }

  function deleteSale(sale){
    let next = {
      ...state,
      sales: state.sales.filter(s=>s.id!==sale.id)
    };
    next.sales = recomputeItemFifo(next, sale.item);
    setState(next);
    saveState(next);
    toast('Sale deleted','good');
    setConfirmDelete(null);
  }

  const todaysSales = state.sales
    .filter(s=>s.date===filterDate)
    .sort((a,b)=>b.seq-a.seq);

  const totalSales = todaysSales.reduce((a,s)=>a+s.qty*s.price,0);
  const totalGP = todaysSales.reduce((a,s)=>a+s.grossProfit,0);

  const weekEnd = addDays(weekStart,6);
  const weekSales = state.sales.filter(s=> s.date>=weekStart && s.date<=weekEnd);
  const weekTotal = weekSales.reduce((a,s)=>a+s.qty*s.price,0);
  const weekGP = weekSales.reduce((a,s)=>a+s.grossProfit,0);

  const weeksWithData = useMemo(()=>{
    const set = new Set();
    state.sales.forEach(s=>set.add(startOfWeek(s.date)));
    set.add(startOfWeek(today));
    set.add(weekStart);
    return [...set].sort().reverse();
  },[state.sales,weekStart]);

  const byDay = useMemo(()=>{
    const days = [];
    for(let i=0;i<7;i++){
      const d = addDays(weekStart,i);
      const daySales = weekSales.filter(s=>s.date===d);
      days.push({ date:d, total: daySales.reduce((a,s)=>a+s.qty*s.price,0), count: daySales.length });
    }
    return days;
  },[weekStart,weekSales]);

  const byAgent = useMemo(()=>{
    const map = {};
    weekSales.forEach(s=>{
      if(!map[s.agent]) map[s.agent] = {total:0, gp:0, count:0};
      map[s.agent].total += s.qty*s.price;
      map[s.agent].gp += s.grossProfit;
      map[s.agent].count += 1;
    });
    return Object.entries(map).sort((a,b)=>b[1].total-a[1].total);
  },[weekSales]);

  if(mode==='week'){
    return (
      <div style={{padding:'0 20px 100px'}}>
        <div style={{display:'flex',gap:8,marginBottom:16}}>
          <button onClick={()=>setMode('day')} style={{flex:1,padding:'10px',borderRadius:8,border:'1px solid var(--line)',background:'none',color:'var(--concrete-light)',fontWeight:600,fontSize:13,cursor:'pointer'}}>Day</button>
          <button style={{flex:1,padding:'10px',borderRadius:8,border:'1px solid var(--accent)',background:'var(--accent)',color:'#1c1b19',fontWeight:700,fontSize:13,cursor:'pointer'}}>Week</button>
        </div>

        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:16}}>
          <button onClick={()=>setWeekStart(addDays(weekStart,-7))} style={{padding:'8px 12px',borderRadius:8,border:'1px solid var(--line)',background:'var(--bg-raised)',color:'var(--paper)',cursor:'pointer'}}>‹</button>
          <select
            style={{...inputStyle, flex:1, padding:'8px 10px', fontSize:13, appearance:'auto', textAlign:'center'}}
            value={weekStart}
            onChange={e=>setWeekStart(e.target.value)}
          >
            {weeksWithData.map(w=>(
              <option key={w} value={w}>{w} to {addDays(w,6)}</option>
            ))}
          </select>
          <button onClick={()=>setWeekStart(addDays(weekStart,7))} style={{padding:'8px 12px',borderRadius:8,border:'1px solid var(--line)',background:'var(--bg-raised)',color:'var(--paper)',cursor:'pointer'}}>›</button>
        </div>

        <div style={{display:'flex',gap:12,marginBottom:20}}>
          <div style={{flex:1,background:'var(--bg-card)',borderRadius:12,padding:'14px'}}>
            <div style={{fontSize:12,color:'var(--concrete-light)'}}>Week total</div>
            <div style={{fontSize:20,fontWeight:700,fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"}}>{weekTotal.toFixed(2)}</div>
          </div>
          <div style={{flex:1,background:'var(--bg-card)',borderRadius:12,padding:'14px'}}>
            <div style={{fontSize:12,color:'var(--concrete-light)'}}>Gross profit</div>
            <div style={{fontSize:20,fontWeight:700,fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",color:weekGP>=0?'var(--good)':'var(--bad)'}}>{weekGP.toFixed(2)}</div>
          </div>
        </div>

        <div style={{fontSize:12,color:'var(--concrete-light)',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600,marginBottom:10}}>By day</div>
        {byDay.map(d=>(
          <div key={d.date} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid var(--line)'}}>
            <span style={{fontSize:14,color:'var(--concrete-light)'}}>{d.date}{d.count>0 ? ` (${d.count})` : ''}</span>
            <span style={{fontSize:14,fontWeight:600}}>{d.total.toFixed(2)}</span>
          </div>
        ))}

        <div style={{fontSize:12,color:'var(--concrete-light)',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600,marginTop:20,marginBottom:10}}>By agent</div>
        {byAgent.length===0 && <div style={{fontSize:13,color:'var(--concrete-light)'}}>No sales this week.</div>}
        {byAgent.map(([name,d])=>(
          <div key={name} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid var(--line)'}}>
            <span style={{fontSize:14}}>{name} <span style={{color:'var(--concrete-light)'}}>({d.count})</span></span>
            <span style={{fontSize:14,fontWeight:600}}>{d.total.toFixed(2)}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{padding:'0 20px 100px'}}>
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        <button style={{flex:1,padding:'10px',borderRadius:8,border:'1px solid var(--accent)',background:'var(--accent)',color:'#1c1b19',fontWeight:700,fontSize:13,cursor:'pointer'}}>Day</button>
        <button onClick={()=>setMode('week')} style={{flex:1,padding:'10px',borderRadius:8,border:'1px solid var(--line)',background:'none',color:'var(--concrete-light)',fontWeight:600,fontSize:13,cursor:'pointer'}}>Week</button>
      </div>

      <Field label="Date">
        <input type="date" style={inputStyle} value={filterDate} onChange={e=>setFilterDate(e.target.value)} />
      </Field>

      {todaysSales.length>0 && (
        <div style={{display:'flex',gap:12,marginBottom:16}}>
          <div style={{flex:1,background:'var(--bg-card)',borderRadius:12,padding:'14px'}}>
            <div style={{fontSize:12,color:'var(--concrete-light)'}}>Total sales</div>
            <div style={{fontSize:20,fontWeight:700,fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"}}>{totalSales.toFixed(2)}</div>
          </div>
          <div style={{flex:1,background:'var(--bg-card)',borderRadius:12,padding:'14px'}}>
            <div style={{fontSize:12,color:'var(--concrete-light)'}}>Gross profit</div>
            <div style={{fontSize:20,fontWeight:700,fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",color:totalGP>=0?'var(--good)':'var(--bad)'}}>{totalGP.toFixed(2)}</div>
          </div>
        </div>
      )}

      {todaysSales.length===0 && (
        <div style={{textAlign:'center',color:'var(--concrete-light)',padding:'40px 0',fontSize:14}}>
          No sales logged for this date yet.
        </div>
      )}

      {todaysSales.map(s=>(
        <div key={s.id} style={{background:'var(--bg-card)',borderRadius:12,padding:'14px 16px',marginBottom:10}}>
          {editingSale===s.id ? (
            <div>
              <div style={{fontWeight:600,fontSize:15,marginBottom:10}}>{s.item}</div>
              <div style={{display:'flex',gap:10,marginBottom:10}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:'var(--concrete-light)',marginBottom:4}}>Quantity</div>
                  <input type="number" inputMode="decimal" style={{...inputStyle,padding:'10px'}} value={editQty} onChange={e=>setEditQty(e.target.value)} />
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:'var(--concrete-light)',marginBottom:4}}>Price</div>
                  <input type="number" inputMode="decimal" style={{...inputStyle,padding:'10px'}} value={editPrice} onChange={e=>setEditPrice(e.target.value)} />
                </div>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>saveEdit(s)} style={{flex:1,padding:'10px',borderRadius:8,border:'none',background:'var(--accent)',color:'#1c1b19',fontWeight:700,fontSize:13,cursor:'pointer'}}>Save</button>
                <button onClick={cancelEdit} style={{flex:1,padding:'10px',borderRadius:8,border:'1px solid var(--line)',background:'none',color:'var(--concrete-light)',fontWeight:600,fontSize:13,cursor:'pointer'}}>Cancel</button>
              </div>
            </div>
          ) : confirmDelete===s.id ? (
            <div>
              <div style={{fontSize:14,marginBottom:10}}>Delete this sale? This can’t be undone.</div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>deleteSale(s)} style={{flex:1,padding:'10px',borderRadius:8,border:'none',background:'var(--bad)',color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer'}}>Delete</button>
                <button onClick={()=>setConfirmDelete(null)} style={{flex:1,padding:'10px',borderRadius:8,border:'1px solid var(--line)',background:'none',color:'var(--concrete-light)',fontWeight:600,fontSize:13,cursor:'pointer'}}>Cancel</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                <span style={{fontWeight:600,fontSize:15}}>{s.item}</span>
                <span style={{fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",fontWeight:700}}>{(s.qty*s.price).toFixed(2)}</span>
              </div>
              <div style={{fontSize:13,color:'var(--concrete-light)',marginTop:4}}>
                {s.qty} × {s.price.toFixed(2)} &middot; {s.agent}
              </div>
              <div style={{fontSize:12,color:'var(--concrete)',marginTop:6,paddingTop:6,borderTop:'1px solid var(--line)'}}>
                Cost basis: {s.fifoPrice.toFixed(2)} <span style={{opacity:0.7}}>({s.fifoLayer})</span> &middot; GP {s.grossProfit>=0?'+':''}{s.grossProfit.toFixed(2)}
              </div>
              <div style={{display:'flex',gap:16,marginTop:8}}>
                <span onClick={()=>startEdit(s)} style={{fontSize:12,color:'var(--accent)',cursor:'pointer',textDecoration:'underline'}}>Edit</span>
                <span onClick={()=>setConfirmDelete(s.id)} style={{fontSize:12,color:'var(--bad)',cursor:'pointer',textDecoration:'underline'}}>Delete</span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}