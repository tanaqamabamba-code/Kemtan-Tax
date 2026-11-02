import React, { useState } from 'react';

export function ShopSwitcherPanel({shops, activeShopId, onSwitch, onAddShop, onRenameShop, onClose}){
  const [addingNew,setAddingNew] = useState(false);
  const [newShopName,setNewShopName] = useState('');
  const [renamingId,setRenamingId] = useState(null);
  const [renameValue,setRenameValue] = useState('');

  function startRename(shop){
    setRenamingId(shop.id);
    setRenameValue(shop.name);
  }

  function confirmRename(){
    const trimmed = renameValue.trim();
    if(!trimmed) return;
    onRenameShop(renamingId, trimmed);
    setRenamingId(null);
  }

  function confirmAdd(){
    const trimmed = newShopName.trim();
    if(!trimmed) return;
    onAddShop(trimmed);
    setNewShopName('');
    setAddingNew(false);
  }

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:100,
      display:'flex', alignItems:'flex-end', justifyContent:'center'
    }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:'var(--bg-raised)', borderRadius:'16px 16px 0 0', padding:'24px 20px',
        width:'100%', maxWidth:480, maxHeight:'85vh', overflowY:'auto'
      }}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <span style={{fontSize:18,fontWeight:700,fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"}}>Switch shop</span>
          <span onClick={onClose} style={{fontSize:20,color:'var(--concrete-light)',cursor:'pointer',padding:4}}>✕</span>
        </div>

        <div style={{fontSize:13,color:'var(--concrete-light)',marginBottom:16}}>
          Each shop keeps its own separate sales, stock, expenses, and everything else — nothing is shared between them.
        </div>

        {shops.map(shop=>(
          <div key={shop.id} style={{
            background: shop.id===activeShopId ? 'var(--bg-card)' : 'transparent',
            border: shop.id===activeShopId ? '1px solid var(--accent)' : '1px solid var(--line)',
            borderRadius:12, padding:'14px 16px', marginBottom:10
          }}>
            {renamingId===shop.id ? (
              <div>
                <input
                  style={{width:'100%', padding:'10px', borderRadius:8, border:'1px solid var(--line)', background:'var(--bg-raised)', color:'var(--paper)', fontSize:15, marginBottom:8}}
                  value={renameValue} onChange={e=>setRenameValue(e.target.value)} autoFocus
                />
                <div style={{display:'flex',gap:8}}>
                  <button onClick={confirmRename} style={{flex:1,padding:'8px',borderRadius:8,border:'none',background:'var(--accent)',color:'#1c1b19',fontWeight:700,fontSize:13,cursor:'pointer'}}>Save</button>
                  <button onClick={()=>setRenamingId(null)} style={{flex:1,padding:'8px',borderRadius:8,border:'1px solid var(--line)',background:'none',color:'var(--concrete-light)',fontWeight:600,fontSize:13,cursor:'pointer'}}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div onClick={()=>{ if(shop.id!==activeShopId) onSwitch(shop.id); }} style={{flex:1,cursor: shop.id===activeShopId ? 'default' : 'pointer'}}>
                  <div style={{fontSize:15,fontWeight:600}}>{shop.name}</div>
                  {shop.id===activeShopId && <div style={{fontSize:11,color:'var(--accent)',marginTop:2}}>Currently active</div>}
                </div>
                <span onClick={()=>startRename(shop)} style={{fontSize:12,color:'var(--concrete-light)',cursor:'pointer',textDecoration:'underline'}}>Rename</span>
              </div>
            )}
          </div>
        ))}

        {addingNew ? (
          <div style={{background:'var(--bg-card)',borderRadius:12,padding:14,marginTop:6}}>
            <input
              style={{width:'100%', padding:'10px', borderRadius:8, border:'1px solid var(--line)', background:'var(--bg-raised)', color:'var(--paper)', fontSize:15, marginBottom:10}}
              value={newShopName} onChange={e=>setNewShopName(e.target.value)} placeholder="New shop name" autoFocus
            />
            <div style={{display:'flex',gap:8}}>
              <button onClick={confirmAdd} style={{flex:1,padding:'10px',borderRadius:8,border:'none',background:'var(--accent)',color:'#1c1b19',fontWeight:700,fontSize:13,cursor:'pointer'}}>Create shop</button>
              <button onClick={()=>{setAddingNew(false); setNewShopName('');}} style={{flex:1,padding:'10px',borderRadius:8,border:'1px solid var(--line)',background:'none',color:'var(--concrete-light)',fontWeight:600,fontSize:13,cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        ) : (
          <div onClick={()=>setAddingNew(true)} style={{
            textAlign:'center', padding:'14px', borderRadius:12, border:'1px dashed var(--line)',
            color:'var(--accent)', fontSize:14, fontWeight:600, cursor:'pointer', marginTop:6
          }}>+ Add a new shop</div>
        )}
      </div>
    </div>
  );
}