import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
class Storage{data=new Map();getItem(k){return this.data.get(k)||null;}setItem(k,v){this.data.set(k,String(v));}}
globalThis.localStorage=new Storage();
const Data=await import('../js/02_data.js');
const Home=await import('../js/23_home_semantics.js');
const Living=await import('../js/28_onboarding_living.js');
const setup={housingMode:'rent',housingAmount:4000,housingDate:'2026-10-05',foodMode:'budget',foodAmount:2500};
test.beforeEach(()=>Data.restaurar(JSON.stringify(Data.createEmptyState())));
for(const mode of ['rent','mortgage','contribution'])test(`${mode} creates a monthly obligation and food budget without spending money`,()=>{
  Living.saveLivingSetup({...setup,housingMode:mode});const s=Data.getState();
  const housing=Home.householdById('home-housing'),food=Home.householdById('home-groceries');
  assert.equal(housing.name,Living.HOUSING_MODES[mode]);assert.equal(housing.kind,'obligation');assert.equal(housing.nextDueDate,'2026-10-05');assert.equal(housing.dueDay,5);
  assert.equal(food.kind,'budget');assert.equal(food.amount,2500);assert.equal(s.movimientos.length,0);assert.equal(s.wallet.saldo,0);
});
test('no vivienda and configure food later create no expenses or assumed zero budgets',()=>{
  Living.saveLivingSetup({housingMode:'none',foodMode:'later'});assert.equal(Home.householdItems().length,0);assert.equal(Data.getState().movimientos.length,0);
});
test('editing only vivienda and food preserves services, health and existing spending',()=>{
  Home.createHouseholdExpense({id:'home-services',name:'Internet',amount:500,kind:'obligation',frequency:'monthly',nextDueDate:'2026-10-10'});
  Home.createHouseholdExpense({id:'home-health',name:'Salud',amount:800,kind:'budget',frequency:'monthly'});
  const before=structuredClone(Data.getState().financialPlan.householdExpenses);
  Living.saveLivingSetup(setup);Living.saveLivingSetup({...setup,housingMode:'mortgage',housingAmount:5500});
  for(const item of before)assert.deepEqual(Data.getState().financialPlan.householdExpenses.find(x=>x.id===item.id),item);
  assert.equal(Home.householdItems().filter(x=>x.id==='home-housing').length,1);
  Living.saveLivingSetup({housingMode:'none',foodMode:'later'});assert.equal(Home.householdById('home-housing').active,false);assert.equal(Home.householdById('home-groceries').amount,2500);
});
test('required choices, invalid amounts and invalid calendar dates do not mutate data',()=>{
  for(const patch of [{housingMode:''},{housingAmount:0},{housingAmount:-1},{housingDate:''},{housingDate:'2026-02-30'},{foodAmount:0},{foodAmount:'abc'}]){
    const before=JSON.stringify(Data.getState());assert.throws(()=>Living.saveLivingSetup({...setup,...patch}));assert.equal(JSON.stringify(Data.getState()),before);
  }
});
test('calendar seed clamps days at month end',()=>{
  assert.equal(Living.nextHousingDate({dueDay:31},new Date(2026,1,10)),'2026-02-28');
  assert.equal(Living.nextHousingDate({dueDay:5},new Date(2026,8,30)),'2026-10-05');
});
test('onboarding controls toggle fields, show validation, review and save the selected setup',async()=>{
  const html=await readFile(new URL('../onboarding.html',import.meta.url),'utf8'),dom=new JSDOM(html,{url:'https://setup.example/onboarding.html'});
  globalThis.document=dom.window.document;globalThis.window=dom.window;globalThis.localStorage=dom.window.localStorage;
  globalThis.location={search:'',replace:()=>{}};globalThis.alert=message=>{throw new Error(message);};
  Data.restaurar(JSON.stringify(Data.createEmptyState()));
  let source=await readFile(new URL('../js/10_onboarding.js',import.meta.url),'utf8');
  source=source.replace(/import \{ initSync, notifyLocalChange \} from '[^']+';/,"const initSync=()=>{},notifyLocalChange=()=>{};");
  source=source.replace(/import \{ initPWA, promptInstall, installationHelp \} from '[^']+';/,"const initPWA=()=>{},promptInstall=()=>{},installationHelp=()=>'';");
  source=source.replace(/from '(\.\/[^']+)'/g,(_match,path)=>`from '${new URL(path,new URL('../js/10_onboarding.js',import.meta.url)).href}'`);
  await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const el=id=>document.getElementById(id),choose=(name,value)=>document.querySelector(`input[name="${name}"][value="${value}"]`).click();
  el('btnStartFresh').click();for(let i=0;i<3;i++)el('setupNext').click();el('setupNext').click();
  assert.match(el('livingSetupError').textContent,/Elige cómo/);
  choose('housingMode','none');assert.equal(el('housingDetails').classList.contains('hidden'),true);
  choose('housingMode','contribution');assert.equal(el('housingDetails').classList.contains('hidden'),false);assert.equal(el('setupHousingDate').type,'date');
  el('setupHousing').value='1500';el('setupHousingDate').value='2026-10-15';choose('foodMode','budget');assert.equal(el('foodDetails').classList.contains('hidden'),false);el('setupGroceries').value='2000';
  el('setupNext').click();assert.match(el('setupReview').textContent,/Aportación/);assert.match(el('setupReview').textContent,/2026-10-15/);
  el('setupNext').click();assert.equal(Home.householdById('home-housing').amount,1500);assert.equal(Home.householdById('home-groceries').amount,2000);assert.equal(Data.getState().movimientos.some(x=>x.tipo==='gasto'),false);
  for(const id of ['setupServices','setupHealth','setupLeisure','setupOtherLiving'])assert.equal(el(id),null);
});
