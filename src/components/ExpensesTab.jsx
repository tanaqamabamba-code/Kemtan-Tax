import React, { useState } from 'react';
import { Field, AutocompleteInput, PillSelect, inputStyle } from './Shared';
import { saveState } from '../storage';
import { EXPENSE_TYPES } from '../fifo';
import { downloadCSV } from '../utils';

export function ExpensesTab({state,setState,toast}){
  const today = new Date().toISOString().slice(0,10);
  const categories = state.expenseTypes && state.expenseTypes.length ? state.expenseTypes : EXPENSE_TYPES;
  const [date,setDate] = useState(today);
  const [description,setDescription] = useState('');
  const [accountType,setAccountType] = useState('');
  const [amount,setAmount] = useState('');
  const [notes,setNotes] = useState('');
  const [paymentStatus,setPaymentStatus] = useState('paid');
  const [payeeName,setPayeeName] = useState('');
  const [editingId,setEditingId] = useState(null);
  const [showCategoryManager,setShowCategoryManager] = useState(false);
  const [newCategoryName,setNewCategoryName] = useState('');
  const [renamingCategory,setRenamingCategory] = useState(null);
  const [renameValue,setRenameValue] = useState('');

  function reset(keepDate){
    setDescription(''); setAccountType(''); setAmount(''); setNotes(''); setPaymentStatus('paid'); setPayeeName('');
    if(!keepDate) setDate(today);
  }

  function submit(){
    if(!description.trim()){ toast('Enter what this expense was for.','bad'); return; }
    if(!accountType){ toast('Choose an expense category.','bad'); return; }
    if(!amount || Number(amount)<=0){ toast('Enter an amount greater than 0.','bad'); return; }
    if(paymentStatus==='unpaid' && !payeeName.trim()){ toast('Enter who you owe for this expense.','bad'); return; }

    const expenseId = 'exp_'+Date.now();
    const newExpense = {
      id: expenseId, date, description:description.trim(),
      accountType, amount:Number(amount), notes:notes.trim(),
      paymentStatus
    };
    let nextLedger = state.ledger || [];
    if(paymentStatus==='unpaid'){
      nextLedger = [...nextLedger, {
        id:'ledger_'+Date.now(), date, type:'payable', name:payeeName.trim(),
        item: description.trim(), amount: Number(amount), status:'open', settledDate:null,
        linkedExpenseId: expenseId
      }];
    }
    const next = {...state, expenses:[...state.expenses, newExpense], ledger:nextLedger};
    setState(next);
    saveState(next);
    const paidNote = paymentStatus==='unpaid' ? ' (unpaid)' : '';
    toast(`Logged ${accountType} expense`+paidNote, 'good');
    reset(true);
  }

  const thisMonth = date.slice(0,7);
  const monthTotal = state.expenses
    .filter(e=>e.date.slice(0,7)===thisMonth)
    .reduce((a,e)=>a+e.amount,0);

  function startEdit(exp){
    setEditingId(exp.id);
    setDate(exp.date);
    setDescription(exp.description);
    setAccountType(exp.accountType);
    setAmount(String(exp.amount));
    setNotes(exp.notes||'');
    setPaymentStatus(exp.paymentStatus||'paid');
    const linked = (state.ledger||[]).find(l=>l.linkedExpenseId===exp.id);
    setPayeeName(linked ? linked.name : '');
  }

  function cancelEdit(){
    setEditingId(null);
    reset(false);
  }

  function saveEdit(){
    if(!description.trim()){ toast('Enter what this expense was for.','bad'); return; }
    if(!accountType){ toast('Choose an expense category.','bad'); return; }
    if(!amount || Number(amount)<=0){ toast('Enter an amount greater than 0.','bad'); return; }
    if(paymentStatus==='unpaid' && !payeeName.trim()){ toast('Enter who you owe for this expense.','bad'); return; }

    const updated = {
      id: editingId, date, description:description.trim(),
      accountType, amount:Number(amount), notes:notes.trim(),
      paymentStatus
    };
    let nextLedger = state.ledger || [];
    const existingLinked = nextLedger.find(l=>l.linkedExpenseId===editingId);
    if(paymentStatus==='unpaid'){
      if(existingLinked){
        nextLedger = nextLedger.map(l=> l.linkedExpenseId===editingId
          ? {...l, date, name:payeeName.trim(), item:description.trim(), amount:Number(amount)}
          : l);
      } else {
        nextLedger = [...nextLedger, {
          id:'ledger_'+Date.now(), date, type:'payable', name:payeeName.trim(),
          item: description.trim(), amount: Number(amount), status:'open', settledDate:null,
          linkedExpenseId: editingId
        }];
      }
    } else if(existingLinked){
      nextLedger = nextLedger.filter(l=>l.linkedExpenseId!==editingId);
    }

    const next = {
      ...state,
      expenses: state.expenses.map(e=> e.id===editingId ? updated : e),
      ledger: nextLedger
    };
    setState(next);
    saveState(next);
    toast('Expense updated', 'good');
    setEditingId(null);
    reset(false);
  }

  function downloadExpenseHistory(){
    const headers = [
      {key:'date', label:'Date'},
      {key:'reason', label:'Reason'},
      {key:'category', label:'Category'},
      {key:'amount', label:'Amount'},
      {key:'status', label:'Status'},
    ];
    const rows = [...state.expenses]
      .sort((a,b)=> a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
      .map(e=>{
        const linked = (state.ledger||[]).find(l=>l.linkedExpenseId===e.id);
        const status = e.paymentStatus==='unpaid'
          ? (linked && linked.status==='settled' ? 'unpaid (now settled)' : 'unpaid (open)')
          : 'paid';
        return {
          date: e.date, reason: e.description, category: e.accountType,
          amount: e.amount.toFixed(2), status
        };
      });
    if(rows.length===0){ toast('No expenses to download yet.','bad'); return; }
    downloadCSV(rows, headers, `expense-history-${new Date().toISOString().slice(0,10)}.csv`);
  }

  function addCategory(){
    const name = newCategoryName.trim();
    if(!name){ toast('Enter a category name.','bad'); return; }
    if(categories.includes(name)){ toast('That category already exists.','bad'); return; }
    const next = {...state, expenseTypes:[...categories, name]};
    setState(next);
    saveState(next);
    setNewCategoryName('');
    toast('Category added', 'good');
  }

  function startRenameCategory(cat){
    setRenamingCategory(cat);
    setRenameValue(cat);
  }

  function confirmRenameCategory(){
    const newName = renameValue.trim();
    if(!newName){ toast('Category name can’t be empty.','bad'); return; }
    if(newName!==renamingCategory && categories.includes(newName)){ toast('That category already exists.','bad'); return; }
    const next = {
      ...state,
      expenseTypes: categories.map(c=> c===renamingCategory ? newName : c),
      expenses: state.expenses.map(e=> e.accountType===renamingCategory ? {...e, accountType:newName} : e),
    };
    setState(next);
    saveState(next);
    if(accountType===renamingCategory) setAccountType(newName);
    setRenamingCategory(null);
    toast('Category renamed', 'good');
  }

  function removeCategory(cat){
    const inUse = state.expenses.some(e=>e.accountType===cat);
    if(inUse){
      toast('Can’t remove — expenses are still logged under this category. Rename it instead, or re-categorize those expenses first.','bad');
      return;
    }
    const next = {...state, expenseTypes: categories.filter(c=>c!==cat)};
    setState(next);
    saveState(next);
    if(accountType===cat) setAccountType('');
    toast('Category removed', 'good');
  }

  return (
    <div style={{padding:'0 20px 100px'}}>
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)} />
      </Field>

      <Field label="What was it for">
        <input style={inputStyle} value={description} onChange={e=>setDescription(e.target.value)} placeholder="e.g. Security, Base salary…" />
      </Field>

      <Field label="Category">
        <PillSelect value={accountType} onChange={setAccountType} options={categories} />
        <div onClick={()=>setShowCategoryManager(s=>!s)} style={{fontSize:12,color:'var(--accent)',cursor:'pointer',textDecoration:'underline',marginTop:8}}>
          {showCategoryManager ? 'Hide category manager' : 'Manage categories'}
        </div>
      </Field>

      {showCategoryManager && (
        <div style={{background:'var(--bg-card)',borderRadius:12,padding:14,marginBottom:16}}>
          {categories.map(cat=>(
            <div key={cat} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--line)'}}>
              {renamingCategory===cat ? (
                <div style={{display:'flex',gap:6,flex:1,alignItems:'center'}}>
                  <input style={{...inputStyle,padding:'8px',flex:1}} value={renameValue} onChange={e=>setRenameValue(e.target.value)} autoFocus />
                  <span onClick={confirmRenameCategory} style={{fontSize:12,color:'var(--good)',cursor:'pointer',fontWeight:700}}>Save</span>
                  <span onClick={()=>setRenamingCategory(null)} style={{fontSize:12,color:'var(--concrete-light)',cursor:'pointer'}}>Cancel</span>
                </div>
              ) : (
                <React.Fragment>
                  <span style={{fontSize:14}}>{cat}</span>
                  <div style={{display:'flex',gap:12}}>
                    <span onClick={()=>startRenameCategory(cat)} style={{fontSize:12,color:'var(--accent)',cursor:'pointer',textDecoration:'underline'}}>Rename</span>
                    <span onClick={()=>removeCategory(cat)} style={{fontSize:12,color:'var(--bad)',cursor:'pointer',textDecoration:'underline'}}>Remove</span>
                  </div>
                </React.Fragment>
              )}
            </div>
          ))}
          <div style={{display:'flex',gap:8,marginTop:12}}>
            <input style={{...inputStyle,padding:'10px',flex:1}} value={newCategoryName} onChange={e=>setNewCategoryName(e.target.value)} placeholder="New category name" />
            <button onClick={addCategory} style={{padding:'10px 14px',borderRadius:8,border:'none',background:'var(--accent)',color:'#1c1b19',fontWeight:700,fontSize:13,cursor:'pointer'}}>Add</button>
          </div>
        </div>
      )}

      <Field label="Amount">
        <input type="number" inputMode="decimal" style={inputStyle} value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" />
      </Field>

      <Field label="Payment">
        <PillSelect value={paymentStatus} onChange={setPaymentStatus} options={['paid','unpaid']} />
        <div style={{fontSize:12,color:'var(--concrete)',marginTop:6}}>
          {paymentStatus==='unpaid' ? 'Expense happened now, you’ll pay it later — tracked in Owed.' : 'Paid now.'}
        </div>
      </Field>

      {paymentStatus==='unpaid' && (
        <Field label="Who you owe">
          <input style={inputStyle} value={payeeName} onChange={e=>setPayeeName(e.target.value)} placeholder="e.g. landlord, supplier name" />
        </Field>
      )}

      <Field label="Notes (optional)">
        <input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. paid to Nason" />
      </Field>

      {editingId ? (
        <div style={{display:'flex',gap:8}}>
          <button onClick={saveEdit} style={{
            flex:1, padding:'16px', borderRadius:12, border:'none',
            background:'var(--accent)', color:'#1c1b19', fontSize:16, fontWeight:700,
            cursor:'pointer', fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"
          }}>Save changes</button>
          <button onClick={cancelEdit} style={{
            flex:1, padding:'16px', borderRadius:12, border:'1px solid var(--line)',
            background:'none', color:'var(--concrete-light)', fontSize:16, fontWeight:700,
            cursor:'pointer', fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"
          }}>Cancel</button>
        </div>
      ) : (
        <button onClick={submit} style={{
          width:'100%', padding:'16px', borderRadius:12, border:'none',
          background:'var(--accent)', color:'#1c1b19', fontSize:16, fontWeight:700,
          cursor:'pointer', fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"
        }}>Log expense</button>
      )}

      <div style={{background:'var(--bg-card)',borderRadius:12,padding:'14px 16px',marginTop:20,marginBottom:16}}>
        <div style={{fontSize:12,color:'var(--concrete-light)'}}>This month’s expenses</div>
        <div style={{fontSize:20,fontWeight:700,fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"}}>{monthTotal.toFixed(2)}</div>
      </div>

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <div style={{fontSize:12,color:'var(--concrete-light)',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600}}>Recent</div>
        <div onClick={downloadExpenseHistory} style={{fontSize:12,color:'var(--accent)',cursor:'pointer',textDecoration:'underline'}}>Download all (CSV)</div>
      </div>
      {[...state.expenses].reverse().slice(0,8).map(e=>(
        <div key={e.id} onClick={()=>startEdit(e)} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid var(--line)',fontSize:14,cursor:'pointer'}}>
          <div>
            <div>{e.description}</div>
            <div style={{fontSize:12,color:'var(--concrete)'}}>{e.accountType} &middot; {e.date}{e.paymentStatus==='unpaid' ? ' · unpaid' : ''}</div>
          </div>
          <span style={{fontWeight:600}}>{e.amount.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}