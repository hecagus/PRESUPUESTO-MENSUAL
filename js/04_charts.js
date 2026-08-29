/* v1.2.0 - Métricas/analítica. Sin mutar estado. */
import { safeFloat, quincenaId } from './01_consts_utils.js';

const horasTurno=t=>Number.isFinite(t.duracionHoras)?t.duracionHoras:Math.max(0,(safeFloat(t.fin)-safeFloat(t.inicio))/3600000);
const tipoTurno=t=>t.tipoTrabajo||((t.fuente==='jaimau')?'jaimau':'uber');

export function metricasUltimos7Dias(store) {
  const limite = new Date(); limite.setDate(limite.getDate() - 7);
  const turnos = store.turnos.filter(t => new Date(t.fecha) >= limite && tipoTurno(t)==='uber');
  const totalIngresos = turnos.reduce((a,t) => a + safeFloat(t.ganancia), 0);
  const totalHoras = turnos.reduce((a,t) => a + horasTurno(t), 0);
  const totalKm = turnos.reduce((a,t)=>a+safeFloat(t.kmRecorrido),0);
  const totalGasolina = store.cargasCombustible.filter(c=>new Date(c.fecha)>=limite&&c.pagador!=='empresa').reduce((a,c)=>a+safeFloat(c.costo),0);
  const diasTrabajados = new Set(turnos.map(t => new Date(t.fecha).toDateString())).size;
  const ingresoNeto = totalIngresos - totalGasolina;
  return {
    totalIngresos,totalHoras,totalKm,totalGasolina,diasTrabajados,ingresoNeto,
    ingresoHora:totalHoras>0?totalIngresos/totalHoras:0,
    netoHora:totalHoras>0?ingresoNeto/totalHoras:0,
    ingresoKm:totalKm>0?totalIngresos/totalKm:0,
    ingresoDiario:diasTrabajados>0?totalIngresos/diasTrabajados:0,
    horasPromedio:diasTrabajados>0?totalHoras/diasTrabajados:0
  };
}

export function resumenJaimau(store,fecha=new Date()){
  const periodo=quincenaId(fecha);
  const turnos=store.turnos.filter(t=>tipoTurno(t)==='jaimau'&&(t.periodo||quincenaId(t.fecha))===periodo);
  const horas=turnos.reduce((a,t)=>a+horasTurno(t),0);
  const km=turnos.reduce((a,t)=>a+safeFloat(t.kmRecorrido),0);
  const jornadas=new Set(turnos.map(t=>new Date(t.fecha).toDateString())).size;
  const pago=store.movimientos.find(m=>m.tipo==='ingreso'&&m.fuente==='jaimau'&&m.periodo===periodo);
  const depositado=(store.fondosCombustibleEmpresa||[]).filter(x=>quincenaId(x.fecha)===periodo).reduce((a,x)=>a+safeFloat(x.monto),0);
  const combustible=store.cargasCombustible.filter(x=>x.pagador==='empresa'&&quincenaId(x.fecha)===periodo).reduce((a,x)=>a+safeFloat(x.costo),0);
  return {periodo,turnos:turnos.length,jornadas,horas,km,pago:safeFloat(pago?.monto),pagado:Boolean(pago),gasDepositado:depositado,gasUtilizado:combustible,gasDisponible:depositado-combustible};
}

export function resumenUber(store,fecha=new Date()){
  const d=new Date(fecha);const day=d.getDay()||7;const inicio=new Date(d);inicio.setHours(0,0,0,0);inicio.setDate(d.getDate()-day+1);
  const turnos=store.turnos.filter(t=>tipoTurno(t)==='uber'&&new Date(t.fecha)>=inicio);
  const ingresos=turnos.reduce((a,t)=>a+safeFloat(t.ganancia),0);
  const horas=turnos.reduce((a,t)=>a+horasTurno(t),0);
  const km=turnos.reduce((a,t)=>a+safeFloat(t.kmRecorrido),0);
  const gasolina=store.cargasCombustible.filter(c=>c.pagador!=='empresa'&&new Date(c.fecha)>=inicio).reduce((a,c)=>a+safeFloat(c.costo),0);
  return {turnos:turnos.length,ingresos,horas,km,gasolina,utilidad:ingresos-gasolina,ingresoHora:horas>0?ingresos/horas:0,ingresoKm:km>0?ingresos/km:0};
}

export function resumenIngresosHibridos(store) {
  const fijo = store.movimientos.filter(m => m.tipo === 'ingreso' && (m.fuente === 'fijo'||m.fuente==='jaimau')).reduce((a,m)=>a+safeFloat(m.monto),0);
  const reparto = store.movimientos.filter(m => m.tipo === 'ingreso' && (m.fuente === 'uber'||m.fuente==='reparto'||m.desc === 'Turno Finalizado')).reduce((a,m)=>a+safeFloat(m.monto),0);
  return { fijo, reparto, total: fijo + reparto };
}
