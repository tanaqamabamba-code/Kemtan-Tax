// localStorage persistence (Firebase sync omitted for now — see firebase-setup.js.disabled for reference)
// Each shop's business data is stored under its own key, so shops never mix.
// Components call loadState()/saveState(state) exactly as before — the active
// shop is tracked internally here via setActiveShop(), called once by the
// shop-switcher wrapper whenever the selected shop changes.
const SHOPS_LIST_KEY = 'kemtan-shops-v1';
const ACTIVE_SHOP_KEY = 'kemtan-active-shop-v1';
const LEGACY_KEY = 'kemtan-state-v1'; // pre-multi-shop data, migrated into the first shop automatically

function stateKeyFor(shopId){ return 'kemtan-state-'+shopId; }

let currentShopId = null;
export function setActiveShop(shopId){ currentShopId = shopId; }
export function getActiveShop(){ return currentShopId; }

export function waitForFirebase(timeoutMs){
  return new Promise((resolve) => {
    if(window.__firebase){ resolve(); return; }
    const onReady = () => { window.removeEventListener('firebase-ready', onReady); resolve(); };
    window.addEventListener('firebase-ready', onReady);
    setTimeout(() => { window.removeEventListener('firebase-ready', onReady); resolve(); }, timeoutMs);
  });
}

// Returns the list of shops: [{id, name}]. Creates a default first shop
// (migrating any pre-existing single-shop data into it) if none exist yet.
export function loadShops(){
  try{
    const raw = localStorage.getItem(SHOPS_LIST_KEY);
    if(raw){
      const shops = JSON.parse(raw);
      if(Array.isArray(shops) && shops.length>0) return shops;
    }
  }catch(e){ /* fall through to migration/default */ }

  // First run, or pre-multi-shop install: create a default shop
  const defaultShop = { id:'shop_default', name:'Kemtan' };
  try{
    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if(legacyRaw){
      localStorage.setItem(stateKeyFor(defaultShop.id), legacyRaw);
    }
  }catch(e){ /* no legacy data, fine */ }
  try{ localStorage.setItem(SHOPS_LIST_KEY, JSON.stringify([defaultShop])); }catch(e){}
  return [defaultShop];
}

export function saveShops(shops){
  try{ localStorage.setItem(SHOPS_LIST_KEY, JSON.stringify(shops)); return true; }
  catch(e){ console.error('Could not save shop list', e); return false; }
}

export function loadActiveShopId(shops){
  try{
    const saved = localStorage.getItem(ACTIVE_SHOP_KEY);
    if(saved && shops.some(s=>s.id===saved)) return saved;
  }catch(e){ /* ignore */ }
  return shops[0].id;
}

export function saveActiveShopId(shopId){
  try{ localStorage.setItem(ACTIVE_SHOP_KEY, shopId); }catch(e){ /* ignore */ }
}

export async function loadState(){
  const shopId = currentShopId;
  await waitForFirebase(4000);

  if(window.__firebase && window.__firebase.ready){
    try{
      const data = await window.__firebase.getDoc(shopId);
      if(data && data.stateJson) return JSON.parse(data.stateJson);
    }catch(e){ console.error('Firebase load failed, falling back to localStorage', e); }
  }

  try{
    const raw = localStorage.getItem(stateKeyFor(shopId));
    if(raw) return JSON.parse(raw);
  }catch(e){ /* no data yet, or localStorage unavailable */ }
  return null;
}

export async function saveState(state){
  const shopId = currentShopId;
  let savedRemotely = false;
  let savedLocally = false;

  if(window.__firebase && window.__firebase.ready){
    try{
      await window.__firebase.setDoc(shopId, { stateJson: JSON.stringify(state), updatedAt: new Date().toISOString() });
      savedRemotely = true;
    }catch(e){ console.error('Firebase save failed, falling back to localStorage', e); }
  }

  try{
    localStorage.setItem(stateKeyFor(shopId), JSON.stringify(state));
    savedLocally = true;
  }catch(e){ console.error('localStorage save failed', e); }

  return savedRemotely || savedLocally;
}