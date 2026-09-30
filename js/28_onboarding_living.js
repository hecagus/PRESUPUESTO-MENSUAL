/* Onboarding only configures housing obligations and an optional food budget. */
import * as Data from './02_data.js';
import * as Home from './23_home_semantics.js';
export const HOUSING_MODES={rent:'Renta',mortgage:'Hipoteca',contribution:'Aportación para vivienda',none:'No pago vivienda'};
const localDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function nextHousingDate(item,now=new Date()){
  if(item?.nextDueDate)return item.nextDueDate;
  if(!item)return '';
  const day=Number(item.dueDay)||1;
  let d=new Date(now.getFullYear(),now.getMonth(),Math.min(day,new Date(now.getFullYear(),now.getMonth()+1,0).getDate()));
  if(localDate(d)<localDate(now))d=new Date(now.getFullYear(),now.getMonth()+1,Math.min(day,new Date(now.getFullYear(),now.getMonth()+2,0).getDate()));
  return localDate(d);
}
export function validateLivingSetup({housingMode,housingAmount,housingDate,foodMode,foodAmount}){
  if(!Object.hasOwn(HOUSING_MODES,housingMode))throw new Error('Elige cómo cubres tu vivienda.');
  if(housingMode!=='none'){
    if(!Number.isFinite(Number(housingAmount))||Number(housingAmount)<=0)throw new Error('Escribe un importe mensual de vivienda mayor a $0.');
    const d=new Date(`${housingDate}T12:00:00`);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(housingDate)||Number.isNaN(d.getTime())||localDate(d)!==housingDate)throw new Error('Elige en el calendario la fecha de tu próximo pago.');
  }
  if(!['budget','later'].includes(foodMode))throw new Error('Elige si deseas configurar tu presupuesto de despensa y comida.');
  if(foodMode==='budget'&&(!Number.isFinite(Number(foodAmount))||Number(foodAmount)<=0))throw new Error('Escribe un presupuesto de despensa y comida mayor a $0 o elige configurarlo después.');
  return true;
}
export function saveLivingSetup(values){
  validateLivingSetup(values);
  const housing=Home.householdById('home-housing');
  if(values.housingMode==='none'){if(housing)Home.setHouseholdExpenseActive(housing.id,false);}
  else{
    const config={id:'home-housing',name:HOUSING_MODES[values.housingMode],category:'Vivienda',kind:'obligation',amount:Number(values.housingAmount),frequency:'monthly',nextDueDate:values.housingDate,dueDay:Number(values.housingDate.slice(-2)),active:true};
    if(housing)Home.updateHouseholdExpense(housing.id,config);else Home.createHouseholdExpense(config);
  }
  if(values.foodMode==='budget'){
    const food=Home.householdById('home-groceries'),config={id:'home-groceries',name:'Despensa y comida',category:'Alimentación',kind:'budget',amount:Number(values.foodAmount),frequency:'monthly',active:true};
    if(food)Home.updateHouseholdExpense(food.id,config);else Home.createHouseholdExpense(config);
  }
  // Deferring leaves any existing budget intact; other Hogar items are never modified here.
  Data.getState().profile.housingMode=values.housingMode;Data.saveData();
}
