/* Fase C — Adaptador DOM. Sin lógica financiera duplicada ni llamadas externas. */
import { getState } from './02_data.js';
import { fmtMoney } from './01_consts_utils.js';
import { getPersonalAccounts, accountBalance } from './15_accounts_engine.js';
import { addCategorizationRule, setCategorizationRuleActive, removeCategorizationRule,
  parseCSV, prepareCSVImport, applyCSVImport, prepareReconciliation, applyReconciliation,
  explainConfirmedSpending, suggestCategory } from './31_financial_intelligence.js';

const $=id=>document.getElementById(id);
const element=(name,content)=>{const el=document.createElement(name);if(content!==undefined)el.textContent=content;return el;};
const caption=(target,text)=>{const p=element('p',text);p.className='intelligence-hint';target.append(p);return p;};
const notification=(text,error=false)=>{const n=$('intelligenceStatus');if(n){n.textContent=text;n.dataset.error=error?'true':'false';}};
let parsed=null,preview=null,initialized=false;
const sync=()=>document.dispatchEvent(new CustomEvent('budget:data-changed'));

function updateAccountSelectors(){
  const accounts=getPersonalAccounts({activeOnly:true});
  for(const id of ['csvAccount','reconcileAccount']){
    const sel=$(id),previous=sel?.value;if(!sel)continue;
    sel.replaceChildren();
    for(const acct of accounts)sel.add(new Option(acct.name,acct.id));
    if(accounts.some(x=>x.id===previous))sel.value=previous;
    if(!accounts.length)sel.add(new Option('Crea una cuenta en Wallet',''));
  }
}
function renderRules(){
  const list=$('categoryRuleList');if(!list)return;
  list.replaceChildren();
  const rules=getState().financialPlan?.categorizationRules||[];
  if(!rules.length){caption(list,'Aún no hay reglas; ninguna categoría será asignada automáticamente.');return;}
  for(const rule of rules){
    const row=element('div');row.className='intelligence-rule';
    const info=element('div');
    const label=element('strong',rule.pattern+' → '+rule.category);
    const note=element('small',(rule.type==='income'?'Ingreso':'Gasto')+' · '+(rule.match==='contains'?'Contiene':rule.match==='equals'?'Exacta':'Empieza con')+' · '+(rule.active===false?'Pausada':'Activa'));
    info.append(label,note);
    const buttons=element('div');buttons.className='intelligence-rule-buttons';
    const toggle=element('button',rule.active===false?'Activar':'Pausar');toggle.type='button';toggle.className='btn btn-outline';
    const remove=element('button','Quitar');remove.type='button';remove.className='btn btn-outline';
    toggle.addEventListener('click',()=>run(()=>setCategorizationRuleActive(rule.id,rule.active===false),'Regla actualizada.'));
    remove.addEventListener('click',()=>{if(confirm('¿Quitar esta regla? Los movimientos anteriores no cambiarán.'))run(()=>removeCategorizationRule(rule.id),'Regla eliminada.');});
    buttons.append(toggle,remove);row.append(info,buttons);list.append(row);
  }
}
function renderInsights(){
  const box=$('intelligenceInsights');if(!box)return;box.replaceChildren();
  const report=explainConfirmedSpending();
  caption(box,'Últimos 30 días · Ingresos registrados: '+fmtMoney(report.received)+' · Gastos registrados: '+fmtMoney(report.spent)+'.');
  for(const item of report.insights){
    const card=element('article');card.className='intelligence-insight';
    const h=element('strong',item.title),text=element('p',item.detail),basis=element('small',item.basis);
    card.append(h,text,basis);box.append(card);
  }
}
function run(action,success){
  try{action();renderFinancialIntelligence();sync();notification(success);}
  catch(error){console.error('Inteligencia:',error);notification('No se aplicó el cambio: '+(error?.message||'Error desconocido'),true);}
}
const headerNames={
  date:['fecha','date','fecha operacion','fecha movimiento'],
  description:['concepto','descripcion','description','detalle','movimiento','merchant'],
  amount:['monto','importe','amount','importe neto'],
  debit:['cargo','cargos','debito','debit','retiro','withdrawal'],
  credit:['abono','abonos','credito','credit','deposito','deposit','ingreso']
};
const folded=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
function setColumns(){
  if(!parsed)return;
  for(const key of ['date','description','amount','debit','credit']){
    const select=$('csv'+key[0].toUpperCase()+key.slice(1));if(!select)continue;
    select.replaceChildren(new Option('— Sin asignar —',''));
    for(let i=0;i<parsed.headers.length;i++)select.add(new Option(parsed.headers[i]||'Columna '+(i+1),String(i)));
    const found=parsed.headers.findIndex(h=>headerNames[key].includes(folded(h)));
    if(found>=0)select.value=String(found);
  }
}
function mapping(){
  const read=id=>$(id)?.value===''?null:Number($(id).value);
  return {date:read('csvDate'),description:read('csvDescription'),amount:read('csvAmount'),debit:read('csvDebit'),credit:read('csvCredit')};
}
function renderPreview(){
  const zone=$('csvPreview');if(!zone)return;zone.replaceChildren();
  if(!preview)return;
  const invalid=preview.entries.filter(e=>e.error).length,duplicates=preview.entries.filter(e=>e.possibleDuplicate).length;
  const h=element('h3','Vista previa: '+preview.entries.length+' filas');zone.append(h);
  caption(zone,invalid+' filas inválidas · '+duplicates+' posibles duplicados. Nada se ha registrado todavía. Se muestran todas las filas y tú decides cuáles importar.');
  const scroll=element('div');scroll.className='intelligence-csv-scroll';
  const table=element('table');table.className='intelligence-csv-table';
  const head=element('thead'),tr=element('tr');
  for(const name of ['Elegir','Fecha','Concepto','Tipo / importe','Categoría / estado'])tr.append(element('th',name));
  head.append(tr);table.append(head);
  const tbody=element('tbody');
  for(const e of preview.entries){
    const row=element('tr'),choose=element('td');
    if(e.error){choose.textContent='—';}
    else{
      const box=element('input');box.type='checkbox';box.checked=e.selected;box.setAttribute('aria-label','Importar '+e.description);
      box.addEventListener('change',()=>{e.selected=box.checked;updateCount();});
      choose.append(box);
    }
    row.append(choose);
    row.append(element('td',e.error?'—':new Date(e.date).toLocaleDateString('es-MX')));
    row.append(element('td',e.description||'Fila '+(e.index+1)));
    row.append(element('td',e.error?'—':(e.type==='income'?'Ingreso':'Gasto')+' · '+fmtMoney(e.amount)));
    const category=element('td');
    if(e.error){category.textContent='Inválida: '+e.error;}
    else{
      const input=element('input');input.value=e.category;input.maxLength=64;input.setAttribute('aria-label','Categoría de '+e.description);
      input.addEventListener('input',()=>{e.category=input.value.trim()||'Otro';});
      category.append(input);
      const note=element('small',(e.possibleDuplicate?'Posible duplicado. ':'')+e.reason);category.append(note);
    }
    row.append(category);tbody.append(row);
  }
  table.append(tbody);scroll.append(table);zone.append(scroll);
  const bar=element('div');bar.className='intelligence-preview-actions';
  const amount=element('strong');amount.id='csvSelectedCount';
  const confirm=element('button','Confirmar importación');confirm.type='button';confirm.className='btn btn-primary';
  const clear=element('button','Cancelar vista previa');clear.type='button';clear.className='btn btn-outline';
  const updateCount=()=>{amount.textContent=preview.entries.filter(e=>e.selected&&!e.error).length+' seleccionadas';};
  updateCount();
  confirm.addEventListener('click',()=>{
    const selected=preview.entries.filter(e=>e.selected&&!e.error);
    if(!selected.length){notification('Selecciona al menos un movimiento válido.',true);return;}
    const duplicates=selected.filter(e=>e.possibleDuplicate).length;
    if(!window.confirm('¿Registrar '+selected.length+' movimientos reales en la cuenta elegida?'+(duplicates?' Incluyes '+duplicates+' posibles duplicados.':'')+' Esta acción modificará el saldo y podría sincronizarse con Firebase.'))return;
    try{
      const result=applyCSVImport(preview,selected.map(e=>e.index));
      preview=null;parsed=null;$('csvFile').value='';renderPreview();renderFinancialIntelligence();sync();
      notification(result.created+' movimientos importados. Revisa sus saldos en Wallet e Historial.');
    }catch(error){notification('Importación cancelada: '+error.message,true);}
  });
  clear.addEventListener('click',()=>{preview=null;renderPreview();});
  bar.append(amount,confirm,clear);zone.append(bar);
}
export function renderFinancialIntelligence(){
  if(document.body.dataset.page!=='inteligencia')return;
  updateAccountSelectors();renderRules();renderInsights();
}
export function initFinancialIntelligence(){
  if(initialized||document.body.dataset.page!=='inteligencia')return;initialized=true;
  $('categoryRuleForm')?.addEventListener('submit',event=>{
    event.preventDefault();
    run(()=>addCategorizationRule({pattern:$('rulePattern').value,match:$('ruleMatch').value,
      type:$('ruleType').value,category:$('ruleCategory').value}),'Regla creada. Solo afectará a las próximas sugerencias.');
    $('rulePattern').value='';
  });
  $('csvFile')?.addEventListener('change',async event=>{
    const file=event.target.files?.[0];parsed=null;preview=null;renderPreview();
    if(!file)return;
    if(file.size>1_000_000){notification('CSV demasiado grande (límite 1 MB).',true);return;}
    try{parsed=parseCSV(await file.text());setColumns();notification('CSV leído localmente. Revisa las columnas antes de previsualizar.');}
    catch(e){notification('CSV inválido: '+e.message,true);}
  });
  $('csvImportForm')?.addEventListener('submit',event=>{
    event.preventDefault();
    if(!parsed){notification('Primero selecciona un CSV válido.',true);return;}
    try{
      preview=prepareCSVImport({csv:parsed,accountId:$('csvAccount').value,mapping:mapping(),positiveIs:$('csvPositive').value});
      renderPreview();notification('Revisa filas, categorías y posibles duplicados antes de confirmar.');
    }catch(e){preview=null;renderPreview();notification('No se pudo analizar CSV: '+e.message,true);}
  });
  $('accountReconciliationForm')?.addEventListener('submit',event=>{
    event.preventDefault();
    try{
      const plan=prepareReconciliation($('reconcileAccount').value,$('reconcileBalance').value);
      const msg='Saldo registrado: '+fmtMoney(plan.registered)+'. Saldo confirmado: '+fmtMoney(plan.actual)+'. Diferencia: '+fmtMoney(plan.delta)+'. ¿Crear ajuste de sistema? Esto NO liquidará deudas ni cuotas.';
      if(!window.confirm(msg))return;
      const result=applyReconciliation(plan);
      $('reconcileStatus').textContent=result.created?'Ajuste registrado: '+fmtMoney(result.delta)+'.':'No hay diferencia. No se creó movimiento.';
      renderFinancialIntelligence();sync();
    }catch(e){$('reconcileStatus').textContent='No se pudo conciliar: '+e.message;}
  });
  renderFinancialIntelligence();
}
