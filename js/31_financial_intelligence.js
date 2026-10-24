/* Fase C: reglas explícitas, CSV local y análisis de registros confirmados.
   No se crean movimientos durante el análisis ni la vista previa. */
import { getState, saveData, restaurar } from './02_data.js';
import { accountLedgerBalance, isPersonalMovement, actualPaymentDate, localDay } from './domain/financial-rules.js';
import { uuid } from './01_consts_utils.js';

const own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase();
const cents=v=>Math.round(Number(v)*100);
const cash=v=>Math.round(Number(v)*100)/100;
const validMoney=v=>Number.isFinite(Number(v))&&Math.abs(Number(v))<=1e12;
const personalAccounts=s=>(s.accounts||[]).filter(a=>a.ownership!=='third_party'&&a.active!==false);
const eligible=m=>m&&['ingreso','gasto'].includes(m.tipo)&&m.categoria!=='Sistema'&&m.movementKind!=='reconciliation'&&!m.goalTransfer&&!m.legacySavingsTransfer;

export function suggestCategory(description,type,rules=[]){
  const text=norm(description);
  if(!text||!['income','expense'].includes(type))return null;
  for(const r of rules){
    if(r.active===false||r.type!==type||!['contains','equals','starts'].includes(r.match)||!norm(r.pattern)||!String(r.category||'').trim())continue;
    const pattern=norm(r.pattern);
    const found=r.match==='equals'?text===pattern:r.match==='starts'?text.startsWith(pattern):text.includes(pattern);
    if(found)return {category:r.category,ruleId:r.id,reason:'Coincide con regla '+r.match+': '+r.pattern};
  }
  return null;
}

function replaceAtomically(state){
  const prior=JSON.stringify(getState());
  try{return restaurar(JSON.stringify(state));}
  catch(e){try{restaurar(prior);}catch{/* almacenamiento lleno: conservar respaldo anterior */}throw e;}
}
export function addCategorizationRule({pattern,match='contains',type='expense',category}={}){
  const name=String(pattern||'').trim(),cat=String(category||'').trim();
  if(!name||name.length>100||!cat||cat.length>64||!['income','expense'].includes(type)||!['contains','equals','starts'].includes(match))throw Error('REGLA_INVALIDA');
  const s=getState(),rules=s.financialPlan?.categorizationRules||[];
  if(rules.some(r=>r.type===type&&r.match===match&&norm(r.pattern)===norm(name)))throw Error('REGLA_DUPLICADA');
  const rule={id:uuid(),pattern:name,match,type,category:cat,active:true,createdAt:new Date().toISOString()};
  s.financialPlan=s.financialPlan||{};s.financialPlan.categorizationRules=[...rules,rule];saveData();return rule;
}
export function setCategorizationRuleActive(id,active){
  const s=getState(),r=s.financialPlan?.categorizationRules?.find(x=>x.id===id);
  if(!r)throw Error('REGLA_NO_ENCONTRADA');
  r.active=Boolean(active);saveData();return r;
}
export function removeCategorizationRule(id){
  const s=getState(),rules=s.financialPlan?.categorizationRules||[];
  if(!rules.some(x=>x.id===id))throw Error('REGLA_NO_ENCONTRADA');
  s.financialPlan.categorizationRules=rules.filter(x=>x.id!==id);saveData();
}

/* Parser RFC4180 limitado a 1MB y 1000 operaciones por lote. */
export function parseCSV(text,delimiter='auto'){
  if(typeof text!=='string'||text.length>1_000_000)throw Error('CSV_TAMANO');
  const raw=text.replace(/^\uFEFF/,'');
  const first=raw.split(/\r?\n/,1)[0]||'';
  const count=(sep)=>{let n=0,q=false;for(let i=0;i<first.length;i++){if(first[i]==='"'){if(q&&first[i+1]==='"')i++;else q=!q;}else if(!q&&first[i]===sep)n++;}return n;};
  const sep=delimiter==='auto'?(count(';')>count(',')?';':','):delimiter;
  if(![',',';'].includes(sep))throw Error('CSV_SEPARADOR');
  const lines=[],row=[];let cell='',quoted=false,atStart=true;
  for(let i=0;i<raw.length;i++){
    const c=raw[i];
    if(c==='"'){if(quoted&&raw[i+1]==='"'){cell+='"';i++;}else if(atStart||quoted)quoted=!quoted;else throw Error('CSV_COMILLAS');atStart=false;continue;}
    if(!quoted&&(c===sep||c==='\n'||c==='\r')){
      row.push(cell);cell='';atStart=true;
      if(c===sep)continue;
      if(c==='\r'&&raw[i+1]==='\n')i++;
      if(row.some(x=>x.trim()!==''))lines.push([...row]);row.length=0;
      if(lines.length>1001)throw Error('CSV_FILAS');
      continue;
    }
    cell+=c;atStart=false;
  }
  if(quoted)throw Error('CSV_COMILLAS');
  row.push(cell);if(row.some(x=>x.trim()!==''))lines.push(row);
  if(lines.length<2||lines.length>1001)throw Error('CSV_FILAS');
  const width=lines[0].length;
  if(width<3||lines.slice(1).some(r=>r.length!==width))throw Error('CSV_COLUMNAS');
  return {headers:lines[0].map(x=>x.trim()),rows:lines.slice(1),delimiter:sep};
}
export function parseDateCell(cell,now=new Date()){
  const x=String(cell??'').trim();let y,m,d;
  let p=x.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if(p){y=+p[1];m=+p[2];d=+p[3];}
  else{p=x.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);if(!p)throw Error('CSV_FECHA');d=+p[1];m=+p[2];y=+p[3];}
  const date=new Date(y,m-1,d,12);
  if(y<2000||y>2100||date.getFullYear()!==y||date.getMonth()!==m-1||date.getDate()!==d)throw Error('CSV_FECHA');
  return actualPaymentDate(date,now).toISOString();
}
export function parseMoneyCell(cell){
  let x=String(cell??'').trim();if(!x)return null;
  const bracket=/^\(.*\)$/.test(x);
  if(bracket)x='-'+x.slice(1,-1);
  x=x.replace(/[$\s\u00a0]/g,'');
  if(!/^[+-]?[\d.,]+$/.test(x))throw Error('CSV_IMPORTE');
  const comma=x.lastIndexOf(','),dot=x.lastIndexOf('.');
  if(comma>=0&&dot>=0){x=comma>dot?x.replace(/\./g,'').replace(',','.'):x.replace(/,/g,'');}
  else if(comma>=0){x=/,\d{1,2}$/.test(x)?x.replace(',','.'):x.replace(/,/g,'');}
  else if(dot>=0&&/^[-+]?\d{1,3}(\.\d{3})+$/.test(x)){x=x.replace(/\./g,'');}
  const value=Number(x);
  if(!validMoney(value))throw Error('CSV_IMPORTE');
  return cash(value);
}
const index=(mapping,key,width)=>{const n=Number(mapping?.[key]);return Number.isInteger(n)&&n>=0&&n<width?n:null;};
export function movementFingerprint({accountId,date,type,amount,description}){
  return [accountId,localDay(date),type,cents(amount),norm(description)].join('|');
}
export function ledgerSignature(s=getState()){
  return JSON.stringify({accounts:(s.accounts||[]).map(a=>[a.id,a.active,a.ownership]),
    records:(s.movimientos||[]).map(m=>[m.id,m.accountId,m.tipo,m.monto,m.fecha,m.desc,m.categoria])});
}
export function prepareCSVImport({csv,accountId,mapping,positiveIs='income',now=new Date(),state=getState()}={}){
  const acct=personalAccounts(state).find(a=>a.id===accountId);
  if(!acct)throw Error('CUENTA_NO_ENCONTRADA');
  if(!['income','expense'].includes(positiveIs))throw Error('CSV_SENTIDO');
  const {headers,rows}=typeof csv==='string'?parseCSV(csv):csv||{};
  if(!Array.isArray(headers)||!Array.isArray(rows))throw Error('CSV_FORMATO');
  const dateI=index(mapping,'date',headers.length),descI=index(mapping,'description',headers.length),
    amountI=index(mapping,'amount',headers.length),debitI=index(mapping,'debit',headers.length),creditI=index(mapping,'credit',headers.length);
  if(dateI===null||descI===null||(amountI===null&&(debitI===null||creditI===null)))throw Error('CSV_MAPEO');
  const seen=new Set((state.movimientos||[]).filter(eligible).map(m=>movementFingerprint({accountId:m.accountId,date:m.fecha,type:m.tipo==='ingreso'?'income':'expense',amount:m.monto,description:m.desc})));
  const rules=state.financialPlan?.categorizationRules||[];
  const entries=rows.map((cols,i)=>{
    try{
      const date=parseDateCell(cols[dateI],now),description=String(cols[descI]??'').trim();
      if(!description||description.length>160)throw Error('CSV_DESCRIPCION');
      let type,amount;
      if(amountI!==null){
        const v=parseMoneyCell(cols[amountI]);
        if(v===null||v===0)throw Error('CSV_IMPORTE');
        type=v>0?positiveIs:positiveIs==='income'?'expense':'income';amount=Math.abs(v);
      }else{
        const debit=parseMoneyCell(cols[debitI])||0,credit=parseMoneyCell(cols[creditI])||0;
        if((debit!==0&&credit!==0)||(debit===0&&credit===0)||debit<0||credit<0)throw Error('CSV_CARGO_ABONO');
        type=credit>0?'income':'expense';amount=credit||debit;
      }
      const fingerprint=movementFingerprint({accountId,date,type,amount,description});
      const possibleDuplicate=seen.has(fingerprint);seen.add(fingerprint);
      const suggestion=suggestCategory(description,type,rules);
      return {index:i,date,description,type,amount,category:suggestion?.category||'Otro',reason:suggestion?.reason||'Sin regla',possibleDuplicate,selected:!possibleDuplicate};
    }catch(e){return {index:i,error:e.message||'CSV_FILA_INVALIDA',selected:false};}
  });
  return {entries,accountId,signature:ledgerSignature(state),errors:entries.filter(x=>x.error).length,duplicates:entries.filter(x=>x.possibleDuplicate).length};
}
export function applyCSVImport(preview,selectedIndexes,now=new Date()){
  if(!preview||preview.signature!==ledgerSignature())throw Error('REGISTROS_CAMBIARON');
  const current=getState(),acct=personalAccounts(current).find(a=>a.id===preview.accountId);
  if(!acct)throw Error('CUENTA_NO_ENCONTRADA');
  if(!Array.isArray(selectedIndexes)||new Set(selectedIndexes).size!==selectedIndexes.length)throw Error('CSV_SELECCION');
  const selection=new Set(selectedIndexes),items=(preview.entries||[]).filter(e=>selection.has(e.index));
  if(items.length!==selection.size||!items.length||items.some(e=>e.error||e.amount<=0||!validMoney(e.amount)||!['income','expense'].includes(e.type)))throw Error('CSV_SELECCION');
  const next=structuredClone(current),batch=uuid(),timestamp=now.toISOString();
  for(const e of items){
    next.movimientos.push({id:uuid(),fecha:e.date,recordedAt:timestamp,tipo:e.type==='income'?'ingreso':'gasto',
      desc:e.description,monto:e.amount,categoria:e.category||'Otro',accountId:acct.id,
      sourceId:null,fuente:'personal',affectsPersonal:true,movementKind:'universal',
      importBatchId:batch,importSource:'csv',tags:[]});
  }
  replaceAtomically(next);
  return {created:items.length,batchId:batch};
}

export function prepareReconciliation(accountId,confirmed,state=getState(),now=new Date()){
  const acct=personalAccounts(state).find(a=>a.id===accountId);if(!acct)throw Error('CUENTA_NO_ENCONTRADA');
  if(!validMoney(confirmed))throw Error('SALDO_INVALIDO');
  const registered=cash(accountLedgerBalance(state,accountId,now)),actual=cash(confirmed);
  return {accountId,accountName:acct.name,registered,actual,delta:cash(actual-registered),signature:ledgerSignature(state)};
}
export function applyReconciliation(plan){
  if(!plan||plan.signature!==ledgerSignature())throw Error('REGISTROS_CAMBIARON');
  const fresh=prepareReconciliation(plan.accountId,plan.actual);
  if(fresh.registered!==plan.registered||fresh.delta!==plan.delta)throw Error('REGISTROS_CAMBIARON');
  if(Math.abs(fresh.delta)<0.005)return {created:0,delta:0};
  const next=structuredClone(getState()),stamp=new Date().toISOString();
  next.movimientos.push({id:uuid(),fecha:stamp,recordedAt:stamp,tipo:fresh.delta>0?'ingreso':'gasto',
    desc:'Ajuste de conciliación · '+fresh.accountName,monto:Math.abs(fresh.delta),
    categoria:'Sistema',accountId:fresh.accountId,affectsPersonal:true,movementKind:'reconciliation',
    reconciliation:{auditedAt:stamp,previousBalance:fresh.registered,confirmedBalance:fresh.actual}});
  replaceAtomically(next);return {created:1,delta:fresh.delta};
}
export function explainConfirmedSpending(state=getState(),now=new Date()){
  const time=now.getTime(),DAY=86400000;
  const list=(state.movimientos||[]).filter(m=>eligible(m)&&isPersonalMovement(state,m)&&Number.isFinite(new Date(m.fecha).getTime())&&new Date(m.fecha)<=now);
  const current=list.filter(m=>time-new Date(m.fecha).getTime()<30*DAY);
  const previous=list.filter(m=>time-new Date(m.fecha).getTime()>=30*DAY&&time-new Date(m.fecha).getTime()<60*DAY);
  const expenses=current.filter(m=>m.tipo==='gasto'),income=current.filter(m=>m.tipo==='ingreso');
  const sum=rows=>cash(rows.reduce((s,m)=>s+Number(m.monto||0),0));
  const total=sum(expenses),received=sum(income),cats=new Map();
  for(const m of expenses)cats.set(m.categoria||'Otro',cash((cats.get(m.categoria||'Otro')||0)+Number(m.monto)));
  const ranked=[...cats.entries()].sort((a,b)=>b[1]-a[1]);
  const insights=[];
  if(expenses.length>=3&&total>0&&ranked.length){
    const [category,amount]=ranked[0],share=Math.round(amount/total*100);
    insights.push({title:'Mayor categoría confirmada: '+category,detail:amount.toFixed(2)+' MXN de '+total.toFixed(2)+' MXN ('+share+'% de '+expenses.length+' gastos), últimos 30 días. Es una concentración, no una calificación de exceso.',basis:'Solo gastos registrados; sin ajustes, transferencias ni proyecciones.'});
  }
  const prevExpense=previous.filter(m=>m.tipo==='gasto'),prevTotal=sum(prevExpense);
  if(expenses.length>=3&&prevExpense.length>=3&&prevTotal>0){
    const diff=cash(total-prevTotal),pct=Math.round(diff/prevTotal*100);
    insights.push({title:'Comparación de gasto confirmado: '+(diff>=0?'aumento':'disminución'),
      detail:'Últimos 30 días: '+total.toFixed(2)+' MXN; 30 anteriores: '+prevTotal.toFixed(2)+' MXN. Diferencia: '+(diff>=0?'+':'')+diff.toFixed(2)+' MXN ('+pct+'%).',
      basis:'Mismo tamaño de ventana; no se infieren gastos sin registrar.'});
  }
  if(!insights.length)insights.push({title:'Evidencia insuficiente para comparar',detail:'Hay '+expenses.length+' gastos y '+income.length+' ingresos confirmados en los últimos 30 días. Registra operaciones reales para obtener comparaciones útiles.',basis:'No se usan ingresos esperados ni pagos programados.'});
  return {periodDays:30,expenses:expenses.length,incomes:income.length,spent:total,received,insights};
}
