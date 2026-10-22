/* One scenario for calendar, forecast, health and goals. Keep the installed preference. */
import {getState,saveData} from '../02_data.js';
export const FORECAST_DAYS=45;
export function financialScenario(options={}){
  let includeVariable=getState().financialPlan?.forecastPreferences?.includeVariable;
  if(typeof includeVariable!=='boolean')try{includeVariable=globalThis.localStorage?.getItem('forecast_include_variable')==='true';}catch{includeVariable=false;}
  return {days:FORECAST_DAYS,...options,includeVariable:options.includeVariable??includeVariable};
}
export function setVariableIncomeScenario(enabled){
  const state=getState();state.financialPlan??={};state.financialPlan.forecastPreferences={...state.financialPlan.forecastPreferences,includeVariable:Boolean(enabled)};saveData();
  globalThis.localStorage?.setItem('forecast_include_variable',String(Boolean(enabled)));
}
