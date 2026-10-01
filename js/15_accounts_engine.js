/* v2.3.0 - Cuentas reales, transferencias y movimientos universales. */
import { safeFloat, uuid, ACCOUNT_TYPES } from './01_consts_utils.js';
import { getState, saveData, sanearDatos } from './02_data.js';
import { personalCash, actualPaymentDate, accountLedgerBalance } from './domain/financial-rules.js';

const EPS=0.005;
const BASE_ACCOUNT_ID='acct-personal';
const text=(value,code='DESCRIPCION_INVALIDA')=>{const v=String(value??'').trim();if(!v)throw new Error(code);return v;};
const positive=(value,code='MONTO_INVALIDO')=>{const n=safeFloat(value);if(!(n>0))throw new Error(code);return n;};

function normalizeAccount(a){
  return {
    ...a,
    name:String(a?.name||'Cuenta').trim()||'Cuenta',
    type:ACCOUNT_TYPES[a?.type]?a.type:(a?.ownership==='third_party'?'third_party':'cash'),
    ownership:a?.ownership==='third_party'?'third_party':'personal',
    active:a?.active!==false,
    createdAt:a?.createdAt||null
  };
}

export function ensureAccountsEngine(){
  const state=getState();let changed=false;
  state.accounts=Array.isArray(state.accounts)?state.accounts.map(normalizeAccount):[];
  for(const m of state.movimientos||[]){
    if(m.tipo==='transferencia'){
      if(!m.fromAccountId&&m.accountId){m.fromAccountId=m.accountId;changed=true;}
      if(!m.transferId){m.transferId=m.id;changed=true;}
      if(m.affectsPersonal!==false){m.affectsPersonal=false;changed=true;}
    }
  }
  if(changed)saveData();
  return state.accounts;
}

export const accountTypeLabel=type=>ACCOUNT_TYPES[type]||'Cuenta';
export const getPersonalAccounts=({activeOnly=false}={})=>ensureAccountsEngine().filter(a=>a.ownership!=='third_party'&&(!activeOnly||a.active!==false));

export function accountBalance(accountId,now=new Date()){
  ensureAccountsEngine();return accountLedgerBalance(getState(),accountId,now);
}

export function personalCashTotal(now=new Date()){ensureAccountsEngine();return personalCash(getState(),now);}

export function createPersonalAccount({name,type='bank'}={}){
  ensureAccountsEngine();const state=getState();
  const n=text(name,'NOMBRE_INVALIDO');
  if(state.accounts.some(a=>a.ownership!=='third_party'&&a.name.toLowerCase()===n.toLowerCase()))throw new Error('CUENTA_DUPLICADA');
  const account={id:uuid(),name:n,type:ACCOUNT_TYPES[type]&&type!=='third_party'?type:'bank',ownership:'personal',active:true,createdAt:new Date().toISOString()};
  state.accounts.push(account);saveData();return account;
}

export function setAccountActive(accountId,active){
  ensureAccountsEngine();const state=getState(),account=state.accounts.find(a=>a.id===accountId&&a.ownership!=='third_party');
  if(!account)throw new Error('CUENTA_NO_ENCONTRADA');
  if(!active&&accountId===BASE_ACCOUNT_ID)throw new Error('CUENTA_BASE');
  if(!active&&Math.abs(accountBalance(accountId))>EPS)throw new Error('CUENTA_CON_SALDO');
  account.active=Boolean(active);saveData();return account;
}

export function recordUniversalMovement({type,description,amount,accountId,category='Otro',sourceId=null,tags=[],date=new Date(),operatingPayment=null,operationId=null}={}){
  const existing=operationId&&(getState().movimientos||[]).find(m=>m.operationId===operationId);
  if(existing){if(existing.accountId!==accountId||existing.monto!==safeFloat(amount))throw new Error('OPERACION_INCOMPATIBLE');return existing;}
  ensureAccountsEngine();const state=getState(),account=state.accounts.find(a=>a.id===accountId&&a.ownership!=='third_party'&&a.active!==false);
  if(!account)throw new Error('CUENTA_NO_ENCONTRADA');
  const tipo=type==='income'?'ingreso':type==='expense'?'gasto':null;if(!tipo)throw new Error('TIPO_MOVIMIENTO_INVALIDO');
  const recordedDate=actualPaymentDate(date);
  const movement={
    id:operationId?`payment-${encodeURIComponent(operationId)}`:uuid(),...(operationId?{operationId}:{}),fecha:recordedDate.toISOString(),tipo,desc:text(description),monto:positive(amount),categoria:String(category||'Otro'),
    sourceId:sourceId||null,fuente:sourceId||'personal',accountId,affectsPersonal:true,movementKind:'universal',
    tags:Array.isArray(tags)?tags.map(x=>String(x).trim()).filter(Boolean):[],
    ...(operatingPayment?{operatingObligationId:operatingPayment.id,operatingPeriod:operatingPayment.period,operatingDueDate:operatingPayment.dueDate,operatingExpectedAmount:operatingPayment.expectedAmount,...(operatingPayment.settled===true?{operatingSettled:true}:{})}:{})
  };
  state.movimientos.push(movement);sanearDatos();return movement;
}

export function transferBetweenAccounts({fromAccountId,toAccountId,amount,note=''}={}){
  ensureAccountsEngine();const state=getState(),from=state.accounts.find(a=>a.id===fromAccountId&&a.ownership!=='third_party'&&a.active!==false),to=state.accounts.find(a=>a.id===toAccountId&&a.ownership!=='third_party'&&a.active!==false);
  if(!from||!to)throw new Error('CUENTA_NO_ENCONTRADA');if(from.id===to.id)throw new Error('TRANSFERENCIA_MISMA_CUENTA');
  const m=positive(amount);if(m>accountBalance(from.id)+EPS)throw new Error('SALDO_CUENTA_INSUFICIENTE');
  const movement={
    id:uuid(),transferId:uuid(),fecha:new Date().toISOString(),tipo:'transferencia',desc:String(note||'').trim()||`Transferencia · ${from.name} → ${to.name}`,
    monto:m,categoria:'Transferencia',fromAccountId:from.id,toAccountId:to.id,accountId:null,affectsPersonal:false,movementKind:'transfer'
  };
  state.movimientos.push(movement);saveData();return movement;
}

export function recentFinancialMovements(limit=30){
  ensureAccountsEngine();const state=getState();
  return [...(state.movimientos||[])].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)).slice(0,limit).map(m=>({
    ...m,
    fromAccount:m.fromAccountId?state.accounts.find(a=>a.id===m.fromAccountId)||null:null,
    toAccount:m.toAccountId?state.accounts.find(a=>a.id===m.toAccountId)||null:null,
    account:m.accountId?state.accounts.find(a=>a.id===m.accountId)||null:null
  }));
}
