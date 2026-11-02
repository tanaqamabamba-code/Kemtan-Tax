import React, { useState, useEffect } from 'react';
import { loadState, saveState, loadShops, saveShops, loadActiveShopId, saveActiveShopId, setActiveShop } from './storage';
import { initialState } from './fifo';

import { TopBar, Toast, TabBar } from './components/Shared';
import { ShopSwitcherPanel } from './components/ShopSwitcherPanel';
import { SalesTab } from './components/SalesTab';
import { HistoryTab } from './components/HistoryTab';
import { StockTab } from './components/StockTab';
import { NewstockTab } from './components/NewstockTab';
import { ExpensesTab } from './components/ExpensesTab';
import { DamageLossTab } from './components/DamageLossTab';
import { LedgerTab } from './components/LedgerTab';
import { HRTab } from './components/HRTab';
import { HealthTab } from './components/HealthTab';
import { TaxTab } from './components/TaxTab';
import { DownloadsTab } from './components/DownloadsTab';
import { BackupPanel } from './components/BackupPanel';

// Everything below was the old App component, unchanged, except it now also
// receives the active shop's name and a callback to open the shop switcher.
function ShopWorkspace({shopId, shopName, onOpenShopSwitcher}){
  const [state,setState] = useState(null);
  const [tab,setTab] = useState('sales');
  const [toastMsg,setToastMsg] = useState(null);
  const [showBackup,setShowBackup] = useState(false);

  useEffect(()=>{
    setActiveShop(shopId);
    setState(null);
    (async ()=>{
      const loaded = await loadState();
      setState(loaded || initialState());
    })();
  },[shopId]);

  function toast(text,kind){
    setToastMsg({text,kind});
    setTimeout(()=>setToastMsg(null), 2200);
  }

  if(!state){
    return <div style={{padding:40,textAlign:'center',color:'var(--concrete-light)'}}>Loading…</div>;
  }

  return (
    <React.Fragment>
      <TabBar tab={tab} setTab={setTab} />
      <TopBar tab={tab} onBackupClick={()=>setShowBackup(true)} shopName={shopName} onShopClick={onOpenShopSwitcher} />
      {tab==='sales' && <SalesTab state={state} setState={setState} toast={toast} />}
      {tab==='history' && <HistoryTab state={state} setState={setState} toast={toast} />}
      {tab==='stock' && <StockTab state={state} setState={setState} toast={toast} />}
      {tab==='newstock' && <NewstockTab state={state} setState={setState} toast={toast} />}
      {tab==='expenses' && <ExpensesTab state={state} setState={setState} toast={toast} />}
      {tab==='loss' && <DamageLossTab state={state} setState={setState} toast={toast} />}
      {tab==='ledger' && <LedgerTab state={state} setState={setState} toast={toast} />}
      {tab==='hr' && <HRTab state={state} setState={setState} toast={toast} />}
      {tab==='health' && <HealthTab state={state} setState={setState} toast={toast} />}
      {tab==='tax' && <TaxTab state={state} setState={setState} toast={toast} />}
      {tab==='downloads' && <DownloadsTab state={state} toast={toast} />}
      {showBackup && <BackupPanel state={state} setState={setState} toast={toast} onClose={()=>setShowBackup(false)} />}
      <Toast msg={toastMsg} />
    </React.Fragment>
  );
}

export default function App(){
  const [shops,setShops] = useState(null);
  const [activeShopId,setActiveShopId] = useState(null);
  const [showSwitcher,setShowSwitcher] = useState(false);

  useEffect(()=>{
    const loadedShops = loadShops();
    setShops(loadedShops);
    setActiveShopId(loadActiveShopId(loadedShops));
  },[]);

  function switchShop(shopId){
    setActiveShopId(shopId);
    saveActiveShopId(shopId);
    setShowSwitcher(false);
  }

  function addShop(name){
    const newShop = { id:'shop_'+Date.now()+'_'+Math.random().toString(36).slice(2,7), name };
    const next = [...shops, newShop];
    setShops(next);
    saveShops(next);
    switchShop(newShop.id);
  }

  function renameShop(shopId, newName){
    const next = shops.map(s=> s.id===shopId ? {...s, name:newName} : s);
    setShops(next);
    saveShops(next);
  }

  if(!shops || !activeShopId){
    return <div style={{padding:40,textAlign:'center',color:'var(--concrete-light)'}}>Loading…</div>;
  }

  const activeShop = shops.find(s=>s.id===activeShopId) || shops[0];

  return (
    <React.Fragment>
      <ShopWorkspace key={activeShopId} shopId={activeShopId} shopName={activeShop.name} onOpenShopSwitcher={()=>setShowSwitcher(true)} />
      {showSwitcher && (
        <ShopSwitcherPanel
          shops={shops}
          activeShopId={activeShopId}
          onSwitch={switchShop}
          onAddShop={addShop}
          onRenameShop={renameShop}
          onClose={()=>setShowSwitcher(false)}
        />
      )}
    </React.Fragment>
  );
}