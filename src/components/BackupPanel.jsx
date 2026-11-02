import React, { useState, useRef } from 'react';
import { downloadJSON, validateBackup } from '../utils';
import { saveState } from '../storage';

export function BackupPanel({state,setState,toast,onClose}){
  const fileInputRef = useRef(null);
  const [confirmImport,setConfirmImport] = useState(null);
  const [pendingFileName,setPendingFileName] = useState('');

  function exportBackup(){
    const filename = `kemtan-backup-${new Date().toISOString().slice(0,10)}.json`;
    downloadJSON(state, filename);
    toast('Backup downloaded','good');
  }

  function handleFileSelect(e){
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      let parsed;
      try{
        parsed = JSON.parse(evt.target.result);
      }catch(err){
        toast('That file isn’t valid JSON.','bad');
        return;
      }
      const error = validateBackup(parsed);
      if(error){
        toast(error,'bad');
        return;
      }
      setConfirmImport(parsed);
      setPendingFileName(file.name);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function confirmRestore(){
    setState(confirmImport);
    saveState(confirmImport);
    toast('Backup restored','good');
    setConfirmImport(null);
    onClose();
  }

  const summary = state ? {
    sales: state.sales.length,
    items: state.items.length,
    expenses: state.expenses.length,
    ledger: (state.ledger||[]).length,
    staff: (state.staff||[]).length,
  } : null;

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
          <span style={{fontSize:18,fontWeight:700,fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"}}>Backup</span>
          <span onClick={onClose} style={{fontSize:20,color:'var(--concrete-light)',cursor:'pointer',padding:4}}>✕</span>
        </div>

        {confirmImport ? (
          <div>
            <div style={{fontSize:14,marginBottom:12}}>
              Restore from <span style={{fontWeight:600}}>{pendingFileName}</span>?
            </div>
            <div style={{background:'var(--bg-card)',borderRadius:10,padding:14,marginBottom:16,fontSize:13,color:'var(--concrete-light)'}}>
              This file has {confirmImport.sales.length} sales, {confirmImport.items.length} items, {confirmImport.expenses.length} expenses.
            </div>
            <div style={{fontSize:13,color:'var(--bad)',marginBottom:16}}>
              This will replace everything currently in the app with the contents of this file. Your current data will be lost unless you’ve backed it up separately.
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={confirmRestore} style={{flex:1,padding:'12px',borderRadius:8,border:'none',background:'var(--bad)',color:'#fff',fontWeight:700,fontSize:14,cursor:'pointer'}}>Replace everything</button>
              <button onClick={()=>setConfirmImport(null)} style={{flex:1,padding:'12px',borderRadius:8,border:'1px solid var(--line)',background:'none',color:'var(--concrete-light)',fontWeight:600,fontSize:14,cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        ) : (
          <div>
            {summary && (
              <div style={{background:'var(--bg-card)',borderRadius:10,padding:14,marginBottom:20,fontSize:13,color:'var(--concrete-light)'}}>
                Currently on this device: {summary.sales} sales, {summary.items} items, {summary.expenses} expenses, {summary.ledger} ledger entries, {summary.staff} staff.
              </div>
            )}

            <div style={{fontSize:13,color:'var(--concrete-light)',marginBottom:10}}>
              Everything in this app lives on this device only. Download a backup regularly and keep it somewhere safe (email it to yourself, save to Google Drive) so you never lose your data.
            </div>

            <button onClick={exportBackup} style={{
              width:'100%', padding:'14px', borderRadius:12, border:'none', marginBottom:12,
              background:'var(--accent)', color:'#1c1b19', fontSize:15, fontWeight:700, cursor:'pointer'
            }}>Download backup</button>

            <button onClick={()=>fileInputRef.current.click()} style={{
              width:'100%', padding:'14px', borderRadius:12, border:'1px solid var(--line)',
              background:'none', color:'var(--paper)', fontSize:15, fontWeight:700, cursor:'pointer'
            }}>Restore from backup</button>
            <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleFileSelect} style={{display:'none'}} />
          </div>
        )}
      </div>
    </div>
  );
}