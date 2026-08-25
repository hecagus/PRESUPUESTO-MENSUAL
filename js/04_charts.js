/* V10 - Métricas/analítica. Sin mutar estado. */
import { safeFloat } from './01_consts_utils.js';

export function metricasUltimos7Dias(store) {
  const limite = new Date(); limite.setDate(limite.getDate() - 7);
  const turnos = store.turnos.filter(t => new Date(t.fecha) >= limite);
  const totalIngresos = turnos.reduce((a,t) => a + safeFloat(t.ganancia), 0);
  const totalHoras = turnos.reduce((a,t) => a + (Number.isFinite(t.duracionHoras) ? t.duracionHoras : Math.max(0, (safeFloat(t.fin)-safeFloat(t.inicio))/3600000)), 0);
  const totalGasolina = store.movimientos.filter(m => new Date(m.fecha) >= limite && /gasolina/i.test(String(m.desc||''))).reduce((a,m) => a + safeFloat(m.monto), 0);
  const diasTrabajados = new Set(turnos.map(t => new Date(t.fecha).toDateString())).size;
  const ingresoNeto = totalIngresos - totalGasolina;
  return {
    totalIngresos, totalHoras, totalGasolina, diasTrabajados, ingresoNeto,
    ingresoHora: totalHoras > 0 ? totalIngresos / totalHoras : 0,
    netoHora: totalHoras > 0 ? ingresoNeto / totalHoras : 0,
    ingresoDiario: diasTrabajados > 0 ? totalIngresos / diasTrabajados : 0,
    horasPromedio: diasTrabajados > 0 ? totalHoras / diasTrabajados : 0
  };
}

export function resumenIngresosHibridos(store) {
  const fijo = store.movimientos.filter(m => m.tipo === 'ingreso' && m.fuente === 'fijo').reduce((a,m)=>a+safeFloat(m.monto),0);
  const reparto = store.movimientos.filter(m => m.tipo === 'ingreso' && (m.fuente === 'reparto' || m.desc === 'Turno Finalizado')).reduce((a,m)=>a+safeFloat(m.monto),0);
  return { fijo, reparto, total: fijo + reparto };
}
