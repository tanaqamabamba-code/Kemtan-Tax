import React, { useState, useMemo } from 'react';
import { monthKey, fmtMoney } from '../utils';
import { computeClosingCash } from '../health-calcs';
import { saveState } from '../storage';
import { Field, ReportRow, inputStyle } from './Shared';

export function CashFlowPanel({state,setState,month}){
  const cashSales = useMemo(()=>state.sales
    .filter(s=>monthKey(s.date)===month && (s.paymentStatus||'paid')==='paid')
    .reduce((a,s)=>a+s.qty*s.price,0),[state.sales,month]);

  const cashPurchases = useMemo(()=>state.batches
    .filter(b=>monthKey(b.date)===month && (b.paymentStatus||'paid')==='paid')
    .reduce((a,b)=>a+b.qty*b.price,0),[state.batches,month]);

  const cashExpenses = useMemo(()=>state.expenses
    .filter(e=>monthKey(e.date)===month && (e.paymentStatus||'paid')==='paid')
    .reduce((a,e)=>a+e.amount,0),[state.expenses,month]);

  const ledgerReceipts = useMemo(()=>(state.ledger||[])
    .filter(l=> l.type==='receivable' && l.status==='settled' && l.settledDate && monthKey(l.settledDate)===month)
    .reduce((a,l)=>a+l.amount,0),[state.ledger,month]);

  const ledgerPayments = useMemo(()=>(state.ledger||[])
    .filter(l=> l.type==='payable' && l.status==='settled' && l.settledDate && monthKey(l.settledDate)===month)
    .reduce((a,l)=>a+l.amount,0),[state.ledger,month]);

  const netCashFlow = (cashSales + ledgerReceipts) - (cashPurchases + cashExpenses + ledgerPayments);

  const openingBalances = state.cashOpeningBalances || {};
  const hasManualOpening = openingBalances[month] !== undefined;
  const closingBalance = computeClosingCash(state, month);
  const openingBalance = closingBalance - netCashFlow;

  function setOpeningBalance(v){
    const val = Number(v)||0;
    const next = {...state, cashOpeningBalances: {...openingBalances, [month]: val}};
    setState(next);
    saveState(next);
  }

  return (
    <div>
      <div style={{background:'var(--bg-card)',borderRadius:12,padding:'16px',marginBottom:16}}>
        <div style={{fontSize:12,color:'var(--concrete-light)',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600,marginBottom:6}}>Operating activities</div>
        <ReportRow label="Cash sales" value={cashSales} />
        <ReportRow label="Cash paid for stock" value={-cashPurchases} />
        <ReportRow label="Cash paid for expenses" value={-cashExpenses} />
        {ledgerReceipts>0 && <ReportRow label="Received from customers (Owed)" value={ledgerReceipts} />}
        {ledgerPayments>0 && <ReportRow label="Paid to suppliers (Owed)" value={-ledgerPayments} />}
        <ReportRow label="Net cash flow" value={netCashFlow} bold accent />
      </div>

      <Field label={hasManualOpening ? "Opening cash balance (manually set)" : "Opening cash balance"}>
        <input type="number" inputMode="decimal" style={inputStyle}
          value={openingBalance.toFixed(2)} onChange={e=>setOpeningBalance(e.target.value)} placeholder="0.00" />
      </Field>
      <div style={{fontSize:12,color:'var(--concrete)',marginTop:-10,marginBottom:16}}>
        Only set this for your very first month — later months carry forward automatically.
      </div>

      <div style={{background:'var(--bg-card)',borderRadius:12,padding:'16px'}}>
        <ReportRow label="Opening balance" value={openingBalance} />
        <ReportRow label="Net cash flow" value={netCashFlow} />
        <ReportRow label="Closing balance" value={closingBalance} bold accent />
      </div>
    </div>
  );
}