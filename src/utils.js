// Shared utility/helper functions

export function emptyRow(){ return { key: 'row_'+Date.now()+'_'+Math.random(), item:'', qty:'', price:'' }; }

function utcDate(dateStr){
  const [y,m,d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m-1, d));
}
export function startOfWeek(dateStr){
  const d = utcDate(dateStr);
  const day = d.getUTCDay();
  const diff = (day===0 ? -6 : 1-day);
  d.setUTCDate(d.getUTCDate()+diff);
  return d.toISOString().slice(0,10);
}
export function addDays(dateStr,n){
  const d = utcDate(dateStr);
  d.setUTCDate(d.getUTCDate()+n);
  return d.toISOString().slice(0,10);
}

export function monthKey(dateStr){ return dateStr.slice(0,7); }

export function fmtMoney(n){ return (n<0?'−':'') + Math.abs(n).toFixed(2); }

export function ledgerPaidTotal(entry){
  return (entry.payments||[]).reduce((a,p)=>a+p.amount,0);
}
export function ledgerRemaining(entry){
  return Math.round((entry.amount - ledgerPaidTotal(entry))*100)/100;
}
export function openReceivablesTotal(state, asOfMonth){
  return (state.ledger||[])
    .filter(l=> l.type==='receivable' && l.status==='open' && (!asOfMonth || monthKey(l.date)<=asOfMonth))
    .reduce((a,l)=>a+ledgerRemaining(l),0);
}
export function openPayablesTotal(state, asOfMonth){
  return (state.ledger||[])
    .filter(l=> l.type==='payable' && l.status==='open' && (!asOfMonth || monthKey(l.date)<=asOfMonth))
    .reduce((a,l)=>a+ledgerRemaining(l),0);
}

export function daysBetween(d1,d2){
  const a = new Date(d1+'T00:00:00'), b = new Date(d2+'T00:00:00');
  return Math.round((b-a)/(1000*60*60*24));
}

export function nextDueInfo(state, staffMember, today){
  const payments = state.payroll.filter(p=>p.staffId===staffMember.id).sort((a,b)=>b.date.localeCompare(a.date));
  const lastPaid = payments.length>0 ? payments[0].date : null;
  if(staffMember.frequency==='variable' || !lastPaid){
    return { label: lastPaid ? `Last paid ${lastPaid}` : 'Never paid yet', overdue:false, dueSoon:false };
  }
  const intervalDays = { daily:1, weekly:7, monthly:30 }[staffMember.frequency] || 30;
  const daysSince = daysBetween(lastPaid, today);
  const daysUntilDue = intervalDays - daysSince;
  if(daysUntilDue === 0){
    return { label: 'Due today', overdue:true, dueSoon:false };
  }
  if(daysUntilDue < 0){
    return { label: `Overdue by ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue)===1?'':'s'}`, overdue:true, dueSoon:false };
  }
  if(daysUntilDue <= 2){
    return { label: `Due in ${daysUntilDue} day${daysUntilDue===1?'':'s'}`, overdue:false, dueSoon:true };
  }
  return { label: `Last paid ${lastPaid}`, overdue:false, dueSoon:false };
}

export function downloadJSON(data, filename){
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadCSV(rows, headers, filename){
  function escapeCell(value){
    const str = value===null || value===undefined ? '' : String(value);
    if(str.includes(',') || str.includes('"') || str.includes('\n')){
      return '"' + str.replace(/"/g,'""') + '"';
    }
    return str;
  }
  const headerLine = headers.map(h=>escapeCell(h.label)).join(',');
  const lines = rows.map(row => headers.map(h=>escapeCell(row[h.key])).join(','));
  const csv = [headerLine, ...lines].join('\r\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function validateBackup(data){
  if(!data || typeof data !== 'object') return 'File doesn’t look like a valid backup.';
  const requiredArrays = ['items','batches','sales','agents','expenses','ledger','staff','payroll'];
  for(const key of requiredArrays){
    if(!Array.isArray(data[key])) return `Missing or invalid "${key}" — this doesn’t look like a Tanbuild/Kemtan backup file.`;
  }
  return null;
}