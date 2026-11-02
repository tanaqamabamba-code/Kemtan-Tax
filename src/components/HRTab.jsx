import React, { useState, useMemo } from 'react';
import { nextDueInfo } from '../utils';
import { Field, AutocompleteInput, PillSelect, inputStyle } from './Shared';
import { saveState } from '../storage';

export function HRTab({state,setState,toast}){
  const today = new Date().toISOString().slice(0,10);
  const [view,setView] = useState('staff');

  const [name,setName] = useState('');
  const [role,setRole] = useState('');
  const [wage,setWage] = useState('');
  const [frequency,setFrequency] = useState('monthly');
  const [editingStaff,setEditingStaff] = useState(null);

  function resetStaffForm(){ setName(''); setRole(''); setWage(''); setFrequency('monthly'); setEditingStaff(null); }

  function startEditStaff(s){
    setEditingStaff(s.id); setName(s.name); setRole(s.role||''); setWage(s.wage?String(s.wage):''); setFrequency(s.frequency);
  }

  function saveStaff(){
    if(!name.trim()){ toast('Enter a name.','bad'); return; }
    if(editingStaff){
      const next = {...state, staff: state.staff.map(s=> s.id===editingStaff ? {...s, name:name.trim(), role:role.trim(), wage: wage?Number(wage):null, frequency} : s)};
      setState(next); saveState(next);
      toast('Updated','good');
    } else {
      const s = { id:'staff_'+Date.now(), name:name.trim(), role:role.trim(), wage: wage?Number(wage):null, frequency };
      const next = {...state, staff:[...state.staff, s]};
      setState(next); saveState(next);
      toast(`Added ${s.name}`,'good');
    }
    resetStaffForm();
  }

  function removeStaff(id){
    const hasPayments = state.payroll.some(p=>p.staffId===id);
    if(hasPayments){ toast('Can’t remove — this person has payment history.','bad'); return; }
    const next = {...state, staff: state.staff.filter(s=>s.id!==id)};
    setState(next); saveState(next);
    toast('Removed','good');
  }

  const [payStaffId,setPayStaffId] = useState('');
  const [payDate,setPayDate] = useState(today);
  const [payAmount,setPayAmount] = useState('');
  const [payNotes,setPayNotes] = useState('');

  const selectedStaff = state.staff.find(s=>s.name===payStaffId);

  function pickPayStaff(staffName){
    setPayStaffId(staffName);
    const s = state.staff.find(x=>x.name===staffName);
    setPayAmount(s && s.wage ? String(s.wage) : '');
  }

  function submitPayment(){
    if(!payStaffId){ toast('Choose who you’re paying.','bad'); return; }
    if(!payAmount || Number(payAmount)<=0){ toast('Enter an amount greater than 0.','bad'); return; }
    const s = state.staff.find(x=>x.name===payStaffId);
    if(!s){ toast('Couldn’t find that staff member.','bad'); return; }
    const expenseId = 'exp_'+Date.now();
    const payrollId = 'pay_'+Date.now();
    const expense = {
      id: expenseId, date: payDate, description: `Wages — ${s.name}`,
      accountType:'Salaries', amount:Number(payAmount), notes: payNotes.trim(),
      paymentStatus:'paid'
    };
    const payment = {
      id: payrollId, date: payDate, staffId: s.id, staffName: s.name,
      amount:Number(payAmount), notes: payNotes.trim(), expenseId
    };
    const next = {...state, expenses:[...state.expenses, expense], payroll:[...state.payroll, payment]};
    setState(next); saveState(next);
    toast(`Paid ${s.name}`,'good');
    setPayStaffId(''); setPayAmount(''); setPayNotes(''); setPayDate(today);
  }

  const recentPayments = [...state.payroll].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,15);

  return (
    <div style={{padding:'0 20px 100px'}}>
      <div style={{display:'flex',gap:6,marginBottom:20}}>
        {[{k:'staff',l:'Staff'},{k:'pay',l:'Pay someone'},{k:'history',l:'History'}].map(t=>(
          <button key={t.k} onClick={()=>setView(t.k)} style={{
            flex:1, padding:'10px 4px', borderRadius:8, fontSize:12.5, fontWeight:700, cursor:'pointer',
            border: view===t.k ? '1px solid var(--accent)' : '1px solid var(--line)',
            background: view===t.k ? 'var(--accent)' : 'none',
            color: view===t.k ? '#1c1b19' : 'var(--concrete-light)'
          }}>{t.l}</button>
        ))}
      </div>

      {view==='staff' && (
        <div>
          {state.staff.map(s=>{
            const due = nextDueInfo(state, s, today);
            return (
              <div key={s.id} style={{background:'var(--bg-card)',borderRadius:12,padding:'14px 16px',marginBottom:10}}>
                {editingStaff===s.id ? (
                  <div>
                    <input style={{...inputStyle,marginBottom:8}} value={name} onChange={e=>setName(e.target.value)} placeholder="Name" />
                    <input style={{...inputStyle,marginBottom:8}} value={role} onChange={e=>setRole(e.target.value)} placeholder="Role (optional)" />
                    <div style={{display:'flex',gap:10,marginBottom:8}}>
                      <input type="number" inputMode="decimal" style={{...inputStyle,flex:1}} value={wage} onChange={e=>setWage(e.target.value)} placeholder="Fixed wage (optional)" />
                    </div>
                    <div style={{marginBottom:10}}>
                      <PillSelect value={frequency} onChange={setFrequency} options={['daily','weekly','monthly','variable']} />
                    </div>
                    <div style={{display:'flex',gap:8}}>
                      <button onClick={saveStaff} style={{flex:1,padding:'10px',borderRadius:8,border:'none',background:'var(--accent)',color:'#1c1b19',fontWeight:700,fontSize:13,cursor:'pointer'}}>Save</button>
                      <button onClick={resetStaffForm} style={{flex:1,padding:'10px',borderRadius:8,border:'1px solid var(--line)',background:'none',color:'var(--concrete-light)',fontWeight:600,fontSize:13,cursor:'pointer'}}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                      <span style={{fontWeight:600,fontSize:15}}>{s.name}</span>
                      {s.wage && <span style={{fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",fontWeight:700}}>{s.wage.toFixed(2)}</span>}
                    </div>
                    <div style={{fontSize:12,color:'var(--concrete-light)',marginTop:4}}>
                      {s.role ? s.role+' · ' : ''}{s.frequency}
                    </div>
                    <div style={{fontSize:12,marginTop:6,color: due.overdue?'var(--bad)': due.dueSoon?'var(--accent)':'var(--concrete)'}}>
                      {due.label}
                    </div>
                    <div style={{display:'flex',gap:16,marginTop:8}}>
                      <span onClick={()=>startEditStaff(s)} style={{fontSize:12,color:'var(--accent)',cursor:'pointer',textDecoration:'underline'}}>Edit</span>
                      <span onClick={()=>removeStaff(s.id)} style={{fontSize:12,color:'var(--bad)',cursor:'pointer',textDecoration:'underline'}}>Remove</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {!editingStaff && (
            <div style={{background:'var(--bg-card)',borderRadius:12,padding:14,marginTop:10}}>
              <div style={{fontSize:12,color:'var(--concrete-light)',fontWeight:600,marginBottom:10}}>Add staff member</div>
              <input style={{...inputStyle,marginBottom:8}} value={name} onChange={e=>setName(e.target.value)} placeholder="Name" />
              <input style={{...inputStyle,marginBottom:8}} value={role} onChange={e=>setRole(e.target.value)} placeholder="Role (optional)" />
              <input type="number" inputMode="decimal" style={{...inputStyle,marginBottom:8}} value={wage} onChange={e=>setWage(e.target.value)} placeholder="Fixed wage (optional, leave blank if variable)" />
              <div style={{marginBottom:10}}>
                <PillSelect value={frequency} onChange={setFrequency} options={['daily','weekly','monthly','variable']} />
              </div>
              <button onClick={saveStaff} style={{width:'100%',padding:'12px',borderRadius:8,border:'none',background:'var(--accent)',color:'#1c1b19',fontWeight:700,fontSize:14,cursor:'pointer'}}>Add</button>
            </div>
          )}
        </div>
      )}

      {view==='pay' && (
        <div>
          <Field label="Who are you paying">
            <PillSelect value={payStaffId} onChange={pickPayStaff} options={state.staff.map(s=>s.name)} />
          </Field>
          <Field label="Date">
            <input type="date" style={inputStyle} value={payDate} onChange={e=>setPayDate(e.target.value)} />
          </Field>
          <Field label="Amount">
            <input type="number" inputMode="decimal" style={inputStyle} value={payAmount} onChange={e=>setPayAmount(e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="Notes (optional)">
            <input style={inputStyle} value={payNotes} onChange={e=>setPayNotes(e.target.value)} placeholder="e.g. half month, bonus" />
          </Field>
          <button onClick={submitPayment} style={{
            width:'100%', padding:'16px', borderRadius:12, border:'none',
            background:'var(--accent)', color:'#1c1b19', fontSize:16, fontWeight:700,
            cursor:'pointer', fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"
          }}>Log payment</button>
          <div style={{fontSize:12,color:'var(--concrete)',marginTop:10}}>This also logs as a Salaries expense, so it shows up in your P&amp;L automatically.</div>
        </div>
      )}

      {view==='history' && (
        <div>
          {recentPayments.length===0 && <div style={{fontSize:13,color:'var(--concrete-light)',textAlign:'center',padding:'20px 0'}}>No payments logged yet.</div>}
          {recentPayments.map(p=>(
            <div key={p.id} style={{display:'flex',justifyContent:'space-between',padding:'12px 0',borderBottom:'1px solid var(--line)'}}>
              <div>
                <div style={{fontSize:14,fontWeight:600}}>{p.staffName}</div>
                <div style={{fontSize:12,color:'var(--concrete-light)'}}>{p.date}{p.notes ? ' · '+p.notes : ''}</div>
              </div>
              <span style={{fontWeight:600,fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"}}>{p.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}