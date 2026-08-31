/* v2.9.0 - Analítica genérica por fuente, combustible y costos operativos. Sin mutar estado. */
import { safeFloat, periodIdFor, CATEGORIAS_BASE } from './01_consts_utils.js';

const horasTurno=t=>Number.isFinite(t.duracionHoras)?t.duracionHoras:Math.max(0,(safeFloat(t.fin)-safeFloat(t.inicio))/3600000);
const sourceOf=(store,item)=>store.workSources?.find(s=>s.id===(item?.sourceId||item?.fuente))||null;

export function metricasFuente(store,sourceId,{days=7,now=new Date()}={}){
  const source=store.workSources?.find(s=>s.id===sourceId);if(!source)return{source:null,turnos:0,ingresos:0,horas:0,km:0,combustible:0,neto:0,dias:0,ingresoHora:0,ingresoKm:0};
  const limit=new Date(now);limit.setDate(limit.getDate()-days);limit.setHours(0,0,0,0);
  const turnos=(store.turnos||[]).filter(t=>t.sourceId===sourceId&&new Date(t.fecha)>=limit);
  const movimientos=(store.movimientos||[]).filter(m=>m.sourceId===sourceId&&m.tipo==='ingreso'&&m.categoria!=='Sistema'&&new Date(m.fecha)>=limit&&m.affectsPersonal!==false);
  const ingresos=movimientos.reduce((a,m)=>a+safeFloat(m.monto),0);
  const horas=turnos.reduce((a,t)=>a+horasTurno(t),0);
  const km=turnos.reduce((a,t)=>a+safeFloat(t.kmRecorrido),0);
  const combustible=(store.cargasCombustible||[]).filter(c=>c.sourceId===sourceId&&c.pagador!=='empresa'&&new Date(c.fecha)>=limit).reduce((a,c)=>a+safeFloat(c.costo),0);
  const dias=new Set(turnos.map(t=>new Date(t.fecha).toDateString())).size;
  const neto=ingresos-combustible;
  return {source,turnos:turnos.length,ingresos,horas,km,combustible,neto,dias,ingresoHora:horas>0?ingresos/horas:0,netoHora:horas>0?neto/horas:0,ingresoKm:km>0?ingresos/km:0,ingresoDiario:dias>0?ingresos/dias:0};
}

export function resumenPeriodoFuente(store,sourceId,fecha=new Date()){
  const source=store.workSources?.find(s=>s.id===sourceId);if(!source)return null;
  const periodo=periodIdFor(source.compensation,fecha);
  const turnos=(store.turnos||[]).filter(t=>t.sourceId===sourceId&&(t.periodo||periodIdFor(source.compensation,t.fecha))===periodo);
  const pago=(store.movimientos||[]).find(m=>m.sourceId===sourceId&&m.tipo==='ingreso'&&m.periodo===periodo&&m.paymentKind==='source_period');
  const ingresos=(store.movimientos||[]).filter(m=>m.sourceId===sourceId&&m.tipo==='ingreso'&&m.categoria!=='Sistema'&&m.periodo===periodo&&m.affectsPersonal!==false).reduce((a,m)=>a+safeFloat(m.monto),0);
  const horas=turnos.reduce((a,t)=>a+horasTurno(t),0),km=turnos.reduce((a,t)=>a+safeFloat(t.kmRecorrido),0);
  return {source,periodo,turnos:turnos.length,jornadas:new Set(turnos.map(t=>new Date(t.fecha).toDateString())).size,horas,km,pago:safeFloat(pago?.monto),pagado:Boolean(pago),ingresos};
}

export function resumenGlobal(store){
  const personal=(store.movimientos||[]).filter(m=>m.affectsPersonal!==false);
  const cashInflows=personal.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+safeFloat(m.monto),0);
  const ingresos=personal.filter(m=>m.tipo==='ingreso'&&m.categoria!=='Sistema').reduce((a,m)=>a+safeFloat(m.monto),0);
  const gastos=personal.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+safeFloat(m.monto),0);
  const hasGoals=Array.isArray(store.savingsGoals);
  const ahorro=hasGoals
    ?store.savingsGoals.filter(g=>g.active!==false).reduce((a,g)=>a+safeFloat(g.reserved),0)
    :(store.wallet?.sobres||[]).filter(s=>s.categoria==='Ahorro'||s.categoria==='Meta').reduce((a,s)=>a+safeFloat(s.acumulado),0);
  const saldo=cashInflows-gastos;
  return {ingresos,gastos,saldo,ahorro,disponible:saldo-ahorro};
}

export function resumenNegocio(store){
  const products=store.business?.products||[],sales=store.business?.sales||[];
  const ingresos=sales.reduce((a,s)=>a+safeFloat(s.total),0),costos=sales.reduce((a,s)=>a+safeFloat(s.unitCost)*safeFloat(s.qty),0);
  return {productos:products.length,ventas:sales.length,ingresos,costos,margen:ingresos-costos};
}

/* Rendimiento por método entre cargas. Para que km/L sea representativo, las cargas deben registrarse con odómetro y de preferencia llenar a un nivel comparable. */
export function rendimientoCombustible(store,{maxSegments=8}={}){
  const fills=(store.cargasCombustible||[])
    .map(c=>({...c,km:safeFloat(c.km),litros:safeFloat(c.litros),costo:safeFloat(c.costo)}))
    .filter(c=>c.km>0&&c.litros>0&&c.costo>=0)
    .sort((a,b)=>a.km-b.km||new Date(a.fecha)-new Date(b.fecha));
  const segments=[];
  for(let i=1;i<fills.length;i++){
    const prev=fills[i-1],current=fills[i],distance=current.km-prev.km;
    if(!(distance>0)||!(current.litros>0))continue;
    segments.push({from:prev,to:current,km:distance,litros:current.litros,costo:current.costo,kmL:distance/current.litros,costoKm:current.costo/distance,precioLitro:current.costo/current.litros});
  }
  const recent=segments.slice(-Math.max(1,maxSegments)),totalKm=recent.reduce((a,x)=>a+x.km,0),totalLitros=recent.reduce((a,x)=>a+x.litros,0),totalCosto=recent.reduce((a,x)=>a+x.costo,0);
  return {fills,segments,recent,last:segments.at(-1)||null,hasEstimate:segments.length>0,totalKm,totalLitros,avgKmL:totalLitros>0?totalKm/totalLitros:0,avgCostoKm:totalKm>0?totalCosto/totalKm:0};
}

export function gastosOperativosRecientes(store,limit=6){
  const cats=new Set(CATEGORIAS_BASE.operativo||[]);
  return (store.movimientos||[])
    .filter(m=>m.tipo==='gasto'&&m.affectsPersonal!==false&&!m.householdExpenseId&&!m.debtId&&!String(m.desc||'').startsWith('⛽')&&(Array.isArray(m.tags)&&m.tags.includes('operational')||cats.has(m.categoria)))
    .sort((a,b)=>new Date(b.fecha)-new Date(a.fecha))
    .slice(0,Math.max(1,limit));
}

/* Compatibilidad con componentes v1.x mientras termina la migración visual. */
export function metricasUltimos7Dias(store){const s=store.workSources?.find(x=>x.legacyKey==='uber'||x.kind==='gig');return s?metricasFuente(store,s.id,{days:7}):metricasFuente(store,'__none__',{days:7});}
export function resumenJaimau(store,fecha=new Date()){
  const s=store.workSources?.find(x=>x.legacyKey==='jaimau'||x.kind==='employment');
  const base=s?resumenPeriodoFuente(store,s.id,fecha):null;if(!base)return{periodo:'',turnos:0,jornadas:0,horas:0,km:0,pago:0,pagado:false,gasDepositado:0,gasUtilizado:0,gasDisponible:0};
  const depositado=(store.fondosCombustibleEmpresa||[]).filter(x=>x.sourceId===s.id).reduce((a,x)=>a+safeFloat(x.monto),0),gas=(store.cargasCombustible||[]).filter(x=>x.sourceId===s.id&&x.pagador==='empresa').reduce((a,x)=>a+safeFloat(x.costo),0);
  return {...base,gasDepositado:depositado,gasUtilizado:gas,gasDisponible:depositado-gas};
}
export function resumenUber(store){const s=store.workSources?.find(x=>x.legacyKey==='uber'||x.kind==='gig');if(!s)return{turnos:0,ingresos:0,horas:0,km:0,gasolina:0,utilidad:0,ingresoHora:0,ingresoKm:0};const m=metricasFuente(store,s.id,{days:7});return{...m,gasolina:m.combustible,utilidad:m.neto};}
export function resumenIngresosHibridos(store){const fijo=(store.movimientos||[]).filter(m=>m.tipo==='ingreso'&&m.categoria!=='Sistema'&&sourceOf(store,m)?.kind==='employment').reduce((a,m)=>a+safeFloat(m.monto),0);const reparto=(store.movimientos||[]).filter(m=>m.tipo==='ingreso'&&m.categoria!=='Sistema'&&sourceOf(store,m)?.kind==='gig').reduce((a,m)=>a+safeFloat(m.monto),0);return{fijo,reparto,total:fijo+reparto};}
