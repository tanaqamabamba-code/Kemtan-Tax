import React, { useState, useMemo } from 'react';
import { fmtMoney, monthKey } from '../utils';

export function TopItemsPanel({state,month,yearPrefix}){
  const [rankBy,setRankBy] = useState('revenue');

  const periodSales = useMemo(()=>{
    return state.sales.filter(s=> yearPrefix ? s.date.startsWith(yearPrefix) : monthKey(s.date)===month);
  },[state.sales,month,yearPrefix]);

  const byItem = useMemo(()=>{
    const map = {};
    periodSales.forEach(s=>{
      if(!map[s.item]) map[s.item] = { item:s.item, revenue:0, grossProfit:0, qty:0 };
      map[s.item].revenue += s.qty*s.price;
      map[s.item].grossProfit += s.grossProfit;
      map[s.item].qty += s.qty;
    });
    return Object.values(map);
  },[periodSales]);

  const ranked = useMemo(()=>{
    return [...byItem].sort((a,b)=> b[rankBy]-a[rankBy]);
  },[byItem,rankBy]);

  const topFive = ranked.slice(0,5);
  const bottomFive = [...ranked].reverse().slice(0,5).filter(r=>!topFive.includes(r));

  return (
    <div>
      {ranked.length===0 && (
        <div style={{fontSize:12,color:'var(--concrete)',marginBottom:14,padding:'10px 12px',background:'var(--bg-raised)',borderRadius:8}}>
          No sales logged in the app for this period yet.
        </div>
      )}

      {ranked.length>0 && (
        <div>
          <div className="no-print" style={{display:'flex',gap:6,marginBottom:16}}>
            {[{k:'revenue',l:'By revenue'},{k:'grossProfit',l:'By gross profit'}].map(t=>(
              <button key={t.k} onClick={()=>setRankBy(t.k)} style={{
                flex:1, padding:'9px 4px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer',
                border: rankBy===t.k ? '1px solid var(--accent)' : '1px solid var(--line)',
                background: rankBy===t.k ? 'var(--accent)' : 'none',
                color: rankBy===t.k ? '#1c1b19' : 'var(--concrete-light)'
              }}>{t.l}</button>
            ))}
          </div>

          <div style={{fontSize:12,color:'var(--concrete-light)',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600,marginBottom:10}}>Top sellers</div>
          {topFive.map((r,idx)=>(
            <div key={r.item} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid var(--line)'}}>
              <span style={{fontSize:14}}>{idx+1}. {r.item} <span style={{color:'var(--concrete-light)'}}>({r.qty})</span></span>
              <span style={{fontSize:14,fontWeight:600,color:'var(--good)'}}>{(rankBy==='revenue'?r.revenue:r.grossProfit).toFixed(2)}</span>
            </div>
          ))}

          {ranked.length>5 && (
            <div>
              <div style={{fontSize:12,color:'var(--concrete-light)',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600,marginTop:20,marginBottom:10}}>Slow movers</div>
              {bottomFive.map((r,idx)=>(
                <div key={r.item} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid var(--line)'}}>
                  <span style={{fontSize:14}}>{r.item} <span style={{color:'var(--concrete-light)'}}>({r.qty})</span></span>
                  <span style={{fontSize:14,fontWeight:600,color:'var(--concrete-light)'}}>{(rankBy==='revenue'?r.revenue:r.grossProfit).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}