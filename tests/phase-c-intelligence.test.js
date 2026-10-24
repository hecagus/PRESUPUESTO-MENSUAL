import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

class Storage {
  #m=new Map();
  getItem(k){return this.#m.get(k)??null;}
  setItem(k,v){this.#m.set(k,String(v));}
  removeItem(k){this.#m.delete(k);}
}
globalThis.localStorage=new Storage();
const Data=await import('../js/02_data.js');
const Engine=await import('../js/31_financial_intelligence.js');
const Rules=await import('../js/domain/financial-rules.js');
const today=new Date();
const reset=()=>{
  Data.restaurar(JSON.stringify({
    profile:{onboarded:true,displayName:'Pruebas',transportMode:'none'},
    accounts:[{id:'acct-personal',name:'Efectivo',ownership:'personal',active:true,type:'cash'},
      {id:'corp',name:'Empresa',ownership:'third_party',active:true,type:'third_party'}],
    movimientos:[],turnos:[],deudas:[],workSources:[],fondosCombustibleEmpresa:[],cargasCombustible:[],
    wallet:{saldo:0,sobres:[]},parametros:{ultimoKM:0},
    financialPlan:{householdExpenses:[],operatingObligations:[]}
  }));
};
test.beforeEach(reset);

test('reglas son explicables, específicas por tipo y no recategorizan historial',()=>{
  const rule=Engine.addCategorizationRule({pattern:'Uber',match:'contains',type:'expense',category:'Transporte'});
  assert.equal(Engine.suggestCategory('Pago UBER APP','expense',Data.getState().financialPlan.categorizationRules).category,'Transporte');
  assert.equal(Engine.suggestCategory('Pago UBER APP','income',Data.getState().financialPlan.categorizationRules),null);
  assert.throws(()=>Engine.addCategorizationRule({pattern:'uber',match:'contains',type:'expense',category:'Otro'}),/REGLA_DUPLICADA/);
  Engine.setCategorizationRuleActive(rule.id,false);
  assert.equal(Engine.suggestCategory('UBER','expense',Data.getState().financialPlan.categorizationRules),null);
  Engine.removeCategorizationRule(rule.id);
  assert.equal(Data.getState().financialPlan.categorizationRules.length,0);
});

test('CSV permite RFC4180, BOM, punto y coma, comillas y coma decimal',()=>{
  const csv='\uFEFFFecha;Concepto;Cargo;Abono\r\n01/10/2026;"Tienda, Centro";1.234,50;\r\n02/10/2026;Reembolso;;200,30\r\n';
  const parsed=Engine.parseCSV(csv);
  assert.deepEqual(parsed.headers,['Fecha','Concepto','Cargo','Abono']);
  assert.equal(parsed.rows[0][1],'Tienda, Centro');
  assert.equal(Engine.parseMoneyCell('1.234,50'),1234.50);
  assert.equal(Engine.parseMoneyCell('(1,234.50)'),-1234.5);
  assert.equal(Engine.parseMoneyCell('$500.00'),500);
  assert.throws(()=>Engine.parseCSV('a,b,c\n"sin cerrar,10,20'),/CSV_COMILLAS/);
});

test('CSV inválido o columnas sin elegir no registra dinero',()=>{
  assert.throws(()=>Engine.parseDateCell('31/02/2026',today),/CSV_FECHA/);
  assert.throws(()=>Engine.parseMoneyCell('MXN x999'),/CSV_IMPORTE/);
  const csv='Fecha,Concepto,Monto\n2026-10-01,Pan,-75.00';
  const parsed=Engine.parseCSV(csv);
  assert.throws(()=>Engine.prepareCSVImport({csv:parsed,accountId:'corp',mapping:{date:0,description:1,amount:2}}),/CUENTA_NO_ENCONTRADA/);
  assert.throws(()=>Engine.prepareCSVImport({csv:parsed,accountId:'acct-personal',mapping:{date:0,description:1,amount:null}}),/CSV_MAPEO/);
  assert.equal(Data.getState().movimientos.length,0);
});

test('vista previa no modifica efectivo y marca posibles duplicados sin confirmar',()=>{
  Data.saldoInicial(1000);
  const csv='Fecha,Concepto,Monto\n2026-10-01,Gasolina,-100\n2026-10-01,Gasolina,-100\n2026-10-02,Depósito,250';
  const preview=Engine.prepareCSVImport({csv,accountId:'acct-personal',mapping:{date:0,description:1,amount:2},now:today});
  assert.equal(preview.entries.length,3);
  assert.equal(preview.duplicates,1);
  assert.deepEqual(preview.entries.map(e=>e.selected),[true,false,true]);
  assert.equal(Rules.personalCash(Data.getState()),1000);
  const result=Engine.applyCSVImport(preview,[0,2]);
  assert.equal(result.created,2);
  assert.equal(Rules.personalCash(Data.getState()),1150);
  assert.equal(Data.getState().movimientos.filter(m=>m.importSource==='csv').length,2);
});

test('repetir un CSV sugiere excluir los movimientos ya registrados y no reimporta automáticamente',()=>{
  const csv='Fecha;Concepto;Importe\n01/10/2026;Café;-80';
  const p=()=>Engine.prepareCSVImport({csv,accountId:'acct-personal',mapping:{date:0,description:1,amount:2},now:today});
  Engine.applyCSVImport(p(),[0]);
  const second=p();
  assert.equal(second.entries[0].possibleDuplicate,true);
  assert.equal(second.entries[0].selected,false);
  assert.throws(()=>Engine.applyCSVImport(second,[]),/CSV_SELECCION/);
  assert.equal(Data.getState().movimientos.filter(m=>m.importSource==='csv').length,1);
});

test('un cambio del libro entre previsualización y confirmación bloquea la importación',()=>{
  const p=Engine.prepareCSVImport({csv:'Fecha,Concepto,Importe\n01/10/2026,Compra,-80',accountId:'acct-personal',mapping:{date:0,description:1,amount:2}});
  Data.saldoInicial(100);
  assert.throws(()=>Engine.applyCSVImport(p,[0]),/REGISTROS_CAMBIARON/);
  assert.equal(Rules.personalCash(Data.getState()),100);
});

test('conciliación ajusta únicamente saldo contable, no gasto observado ni deuda',()=>{
  Data.saldoInicial(1000);
  const p=Engine.prepareReconciliation('acct-personal',650);
  assert.equal(p.delta,-350);
  assert.equal(Rules.personalCash(Data.getState()),1000);
  assert.equal(Engine.applyReconciliation(p).created,1);
  assert.equal(Rules.accountLedgerBalance(Data.getState(),'acct-personal'),650);
  const m=Data.getState().movimientos.at(-1);
  assert.equal(m.categoria,'Sistema');
  assert.equal(m.movementKind,'reconciliation');
  assert.equal(Rules.observedTotals(Data.getState()).expense,0);
  assert.equal(Engine.applyReconciliation(Engine.prepareReconciliation('acct-personal',650)).created,0);
  assert.equal(Data.getState().movimientos.length,2);
});

test('conciliación con información concurrente exige repetir la confirmación',()=>{
  Data.saldoInicial(500);
  const plan=Engine.prepareReconciliation('acct-personal',300);
  Data.saldoInicial(50);
  assert.throws(()=>Engine.applyReconciliation(plan),/REGISTROS_CAMBIARON/);
});

test('recomendaciones usan solo pagos registrados y excluyen sistema, transferencias y terceros',()=>{
  const ago=n=>new Date(Date.now()-n*86400000).toISOString();
  Data.getState().movimientos.push(
    {id:'a',tipo:'gasto',fecha:ago(2),monto:100,categoria:'Comida',accountId:'acct-personal'},
    {id:'b',tipo:'gasto',fecha:ago(3),monto:200,categoria:'Comida',accountId:'acct-personal'},
    {id:'c',tipo:'gasto',fecha:ago(4),monto:300,categoria:'Hogar',accountId:'acct-personal'},
    {id:'d',tipo:'ingreso',fecha:ago(1),monto:1000,categoria:'Trabajo',accountId:'acct-personal'},
    {id:'e',tipo:'gasto',fecha:ago(1),monto:10000,categoria:'Sistema',accountId:'acct-personal',movementKind:'reconciliation'},
    {id:'f',tipo:'gasto',fecha:ago(1),monto:3000,categoria:'Gasolina',accountId:'corp',affectsPersonal:false},
    {id:'g',tipo:'transferencia',fecha:ago(1),monto:5000,fromAccountId:'acct-personal',toAccountId:'corp'}
  );
  const result=Engine.explainConfirmedSpending();
  assert.equal(result.spent,600);assert.equal(result.received,1000);
  assert.equal(result.expenses,3);assert.equal(result.incomes,1);
  assert.match(result.insights[0].detail,/600.00 MXN/);
});

test('sin historial suficiente se indica incertidumbre, sin proyectar ni inventar montos',()=>{
  const report=Engine.explainConfirmedSpending();
  assert.equal(report.spent,0);
  assert.match(report.insights[0].title,/insuficiente/i);
});

test('rutas y JS de fase C quedan disponibles para la PWA sin alterar esquema',async()=>{
  const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
  const [sw,init,html,stats]=await Promise.all(['sw.js','js/05_init.js','inteligencia.html','stats.html'].map(read));
  for(const path of ['inteligencia.html','31_financial_intelligence.js','32_financial_intelligence_ui.js'])assert.match(sw,new RegExp(path.replace(/\./g,'\\.')));
  assert.match(init,/initFinancialIntelligence/);
  assert.match(init,/renderFinancialIntelligence/);
  assert.match(html,/id="csvPreview"/);
  assert.match(html,/id="accountReconciliationForm"/);
  assert.match(stats,/href="inteligencia\.html"/);
  assert.equal(Data.getState().schemaVersion,30);
});
