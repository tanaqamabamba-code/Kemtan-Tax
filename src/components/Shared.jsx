import React, { useState, useMemo, useRef, useEffect } from 'react';
import { waitForFirebase } from '../storage';
import { fmtMoney } from '../utils';

export function TopBar({tab,onBackupClick,shopName,onShopClick}){
const titles = {sales:'Add a sale', history:"Today's sales", stock:'Stock levels', newstock:'Add stock', expenses:'Log an expense', loss:'Damage & loss', ledger:'Money owed', hr:'Staff & wages', health:'Business health', tax:'Tax compliance', downloads:'Downloads'};
  const [synced,setSynced] = useState(null);
  useEffect(()=>{
    let cancelled = false;
    waitForFirebase(4000).then(()=>{
      if(!cancelled) setSynced(!!(window.__firebase && window.__firebase.ready));
    });
    return ()=>{ cancelled = true; };
  },[]);
 return (
      <React.Fragment>
      <div style={{padding:'22px 20px 14px', background:'var(--bg)'}}>
     <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'nowrap',gap:8}}>
  <div style={{display:'flex',alignItems:'center',gap:8,minWidth:0,overflow:'hidden'}}>
    <span onClick={onShopClick} style={{fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",fontWeight:700,fontSize:22,letterSpacing:'-0.02em',cursor: onShopClick ? 'pointer' : 'default',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{shopName||'Kemtan'}</span>
    <span style={{width:6,height:6,borderRadius:99,background:'var(--accent)',display:'inline-block',flexShrink:0}}></span>
    {onShopClick && <span onClick={onShopClick} style={{fontSize:11,color:'var(--concrete-light)',cursor:'pointer',flexShrink:0}}>▾</span>}
  </div>
  <div style={{display:'flex',alignItems:'center',gap:14,flexShrink:0}}>
    <span style={{fontSize:11,color: synced===null?'var(--concrete)':synced?'var(--good)':'var(--concrete-light)'}}>
      {synced===null ? 'Checking…' : synced ? '✓ Synced' : 'Local only'}
    </span>
    <span onClick={onBackupClick} style={{fontSize:12,color:'var(--concrete-light)',cursor:'pointer',textDecoration:'underline'}}>Backup</span>
  </div>
  </div>
      </div>
      <div style={{color:'var(--concrete-light)',fontSize:14,marginTop:2}}>{titles[tab]}</div>
      </React.Fragment>
    );
}

export function ReportRow({label,value,bold,accent}){
  return (
    <div style={{display:'flex',justifyContent:'space-between',padding:'10px 0', borderBottom: bold?'none':'1px solid var(--line)'}}>
      <span style={{fontSize:14, fontWeight: bold?700:400, color: bold?'var(--paper)':'var(--concrete-light)'}}>{label}</span>
      <span style={{
        fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif", fontWeight: bold?700:600, fontSize: bold?16:14,
        color: accent ? (value>=0?'var(--good)':'var(--bad)') : 'var(--paper)'
      }}>{fmtMoney(value)}</span>
    </div>
  );
}

export function Field({label, children}){
  return (
    <div style={{marginBottom:16}}>
      <div style={{fontSize:12,color:'var(--concrete-light)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6,fontWeight:600}}>{label}</div>
      {children}
    </div>
  );
}

export const inputStyle = {
  width:'100%', padding:'14px 14px', borderRadius:10, border:'1px solid var(--line)',
  background:'var(--bg-raised)', color:'var(--paper)', fontSize:16, fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",
  outline:'none'
};

export function AutocompleteInput({value, onChange, options, placeholder}){
  const [open,setOpen] = useState(false);
  const [query,setQuery] = useState(value||'');
  const wrapRef = useRef(null);

  useEffect(()=>{ setQuery(value||''); },[value]);

  const filtered = useMemo(()=>{
    const sorted = [...options].sort((a,b)=>a.localeCompare(b));
    if(!query) return sorted;
    const q = query.toLowerCase();
    return sorted.filter(o=>o.toLowerCase().includes(q));
  },[query,options]);

  useEffect(()=>{
    function handleClick(e){
      if(wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown',handleClick);
    document.addEventListener('touchstart',handleClick);
    return ()=>{
      document.removeEventListener('mousedown',handleClick);
      document.removeEventListener('touchstart',handleClick);
    };
  },[]);

  return (
    <div ref={wrapRef} style={{position:'relative'}}>
      <input
        style={inputStyle}
        value={query}
        placeholder={placeholder}
        onFocus={()=>setOpen(true)}
        onChange={e=>{ setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
      />
      {open && filtered.length>0 && (
        <div style={{
          position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:20,
          background:'var(--bg-card)', border:'1px solid var(--line)', borderRadius:10,
          maxHeight:220, overflowY:'auto', boxShadow:'0 8px 24px rgba(0,0,0,0.4)'
        }}>
          {filtered.map(opt=>(
            <div key={opt}
              onClick={()=>{ onChange(opt); setQuery(opt); setOpen(false); }}
              style={{padding:'12px 14px', fontSize:15, borderBottom:'1px solid var(--line)', cursor:'pointer'}}
              onTouchStart={e=>e.currentTarget.style.background='var(--bg-raised)'}
            >{opt}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PillSelect({value,onChange,options}){
  return (
    <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
      {options.map(opt=>{
        const active = value===opt;
        return (
          <button key={opt} onClick={()=>onChange(opt)}
            style={{
              padding:'10px 14px', borderRadius:99, border:active?'1px solid var(--accent)':'1px solid var(--line)',
              background: active? 'var(--accent)':'var(--bg-raised)',
              color: active? '#1c1b19':'var(--paper)',
              fontSize:14, fontWeight:600, cursor:'pointer'
            }}>{opt}</button>
        );
      })}
    </div>
  );
}

export function Toast({msg}){
  if(!msg) return null;
  return (
    <div style={{
      position:'fixed', bottom:90, left:'50%', transform:'translateX(-50%)',
      background: msg.kind==='bad' ? 'var(--bad)' : 'var(--good)',
      color:'#fff', padding:'10px 18px', borderRadius:99, fontSize:14, fontWeight:600,
      boxShadow:'0 8px 20px rgba(0,0,0,0.3)', zIndex:50, maxWidth:'85%', textAlign:'center'
    }}>{msg.text}</div>
  );
}

export function TabBar({tab,setTab}){
  const tabs = [
    {key:'sales', label:'Sale'},
    {key:'history', label:'History'},
    {key:'stock', label:'Stock'},
    {key:'newstock', label:'Buy'},
    {key:'expenses', label:'Expense'},
    {key:'loss', label:'Loss'},
    {key:'ledger', label:'Owed'},
    {key:'hr', label:'Staff'},
    {key:'health', label:'Health'},
    {key:'tax', label:'Tax'},
    {key:'downloads', label:'Downloads'},
  ];
  return (
    <div className="no-print" style={{
      display:'flex', overflowX:'auto', background:'var(--bg-raised)', borderBottom:'1px solid var(--line)',
      WebkitOverflowScrolling:'touch'
    }}>
      {tabs.map(t=>(
        <button key={t.key} onClick={()=>setTab(t.key)} style={{
          flex:'1 0 60px', padding:'12px 4px 10px', background:'none', border:'none',
          color: tab===t.key ? 'var(--accent)' : 'var(--concrete-light)',
          fontWeight: tab===t.key ? 700:500, fontSize:10.5, cursor:'pointer', whiteSpace:'nowrap',
          fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"
        }}>{t.label}</button>
      ))}
    </div>
  );
}