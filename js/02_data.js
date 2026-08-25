/* V10 - Estado, persistencia y dominio. Cero DOM. */
import { STORAGE_KEY, LEGACY_KEYS, SCHEMA_VERSION, MAPA_DIAS, safeFloat, uuid } from './01_consts_utils.js';

const INITIAL_STATE = {
  schemaVersion: SCHEMA_VERSION,
  turnos: [], movimientos: [], cargasCombustible: [], deudas: [], gastosFijosMensuales: [],
  ingresosFijos: [],
  wallet: { saldo: 0, sobres: [] },
  parametros: { ultimoKM: 0, costoPorKm: 0, metaDiaria: 0, metaBase: 0, deficitTotal: 0, moraVencida: 0, kmInicialConfigurado: false, saldoInicialConfigurado: false },
  categoriasPersonalizadas: { operativo: [], hogar: [] },
  turnoActivo: null
};

let store = structuredClone(INITIAL_STATE);
export const getState = () => store;

export function saveData() {
  store.schemaVersion = SCHEMA_VERSION;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function loadData() {
  let raw = localStorage.getItem(STORAGE_KEY);
  if (!raw || raw.length < 50) {
    for (const key of LEGACY_KEYS) {
      const legacy = localStorage.getItem(key);
      if (legacy && legacy.length >= 50) { raw = legacy; break; }
    }
  }
  if (raw) {
    try {
      const saved = JSON.parse(raw);
      store = {
        ...structuredClone(INITIAL_STATE), ...saved,
        wallet: { ...INITIAL_STATE.wallet, ...(saved.wallet || {}) },
        parametros: { ...INITIAL_STATE.parametros, ...(saved.parametros || {}) },
        categoriasPersonalizadas: { ...INITIAL_STATE.categoriasPersonalizadas, ...(saved.categoriasPersonalizadas || {}) },
        ingresosFijos: Array.isArray(saved.ingresosFijos) ? saved.ingresosFijos : []
      };
    } catch (error) {
      console.error('No se pudo cargar el respaldo local:', error);
      store = structuredClone(INITIAL_STATE);
    }
  }
  sanearDatos();
  return store;
}

export function sanearDatos() {
  for (const key of ['turnos','movimientos','cargasCombustible','deudas','gastosFijosMensuales','ingresosFijos']) {
    if (!Array.isArray(store[key])) store[key] = [];
  }
  if (!Array.isArray(store.wallet?.sobres)) store.wallet = { saldo: 0, sobres: [] };

  store.wallet.saldo = store.movimientos.reduce((saldo, m) => {
    if (m.tipo === 'ingreso') return saldo + safeFloat(m.monto);
    if (m.tipo === 'gasto') return saldo - safeFloat(m.monto);
    return saldo;
  }, 0);

  const kms = [safeFloat(store.parametros.ultimoKM), ...store.turnos.map(t => safeFloat(t.kmFinal)), ...store.cargasCombustible.map(c => safeFloat(c.km))];
  store.parametros.ultimoKM = Math.max(0, ...kms);
  if (store.parametros.ultimoKM > 0) store.parametros.kmInicialConfigurado = true;
  if (store.turnoActivo && (!Number.isFinite(store.turnoActivo.inicio) || store.turnoActivo.inicio <= 0)) store.turnoActivo = null;

  reconstruirSobres();
  calcularObjetivosYMeta();
  saveData();
}

function reconstruirSobres() {
  const refsValidas = new Set();
  const ensureSobre = (refId, tipo, desc, meta, frecuencia, diaPago, categoria) => {
    refsValidas.add(refId);
    let s = store.wallet.sobres.find(x => x.refId === refId);
    if (!s) {
      s = { id: uuid(), refId, tipo, desc, acumulado: 0, objetivoHoy: 0 };
      store.wallet.sobres.push(s);
    }
    s.tipo = tipo; s.desc = desc; s.meta = safeFloat(meta); s.frecuencia = frecuencia;
    if (diaPago !== undefined && diaPago !== null && diaPago !== '') s.diaPago = diaPago;
    if (categoria) s.categoria = categoria;
  };

  store.deudas.filter(d => safeFloat(d.saldo) > 0).forEach(d => ensureSobre(d.id, 'deuda', d.desc, d.montoCuota, d.frecuencia, d.diaPago, 'Deuda'));
  store.gastosFijosMensuales.forEach(g => ensureSobre(g.id, 'gasto', g.desc, g.monto, g.frecuencia, g.diaPago, g.categoria));
  store.wallet.sobres = store.wallet.sobres.filter(s => refsValidas.has(s.refId));
}

/* Motor financiero heredado V8.8: se conserva su fórmula y semántica. */
export function calcularObjetivosYMeta() {
  const hoy = new Date();
  const hoyIdx = MAPA_DIAS[hoy.getDay()];
  const diaMes = hoy.getDate();
  const hoyStr = hoy.toDateString();
  let metaBase = 0;

  const cuotaBase = (monto, frecuencia) => {
    if (frecuencia === 'Diario') return safeFloat(monto);
    if (frecuencia === 'Semanal') return safeFloat(monto) / 7;
    if (frecuencia === 'Mensual') return safeFloat(monto) / 30;
    return 0;
  };

  store.deudas.forEach(d => { if (safeFloat(d.saldo) > 0) metaBase += cuotaBase(d.montoCuota, d.frecuencia); });
  store.gastosFijosMensuales.forEach(g => { if (g.categoria !== 'Ahorro' && g.categoria !== 'Meta') metaBase += cuotaBase(g.monto, g.frecuencia); });

  const movimientosHoy = store.movimientos.filter(m => new Date(m.fecha).toDateString() === hoyStr);
  let deficitTotal = 0;
  let moraVencida = 0;

  store.wallet.sobres.forEach(s => {
    if (s.categoria === 'Ahorro' || s.categoria === 'Meta') return;
    const yaPagado = s.tipo === 'deuda'
      ? movimientosHoy.some(m => m.tipo === 'gasto' && m.desc === `Abono: ${s.desc}`)
      : movimientosHoy.some(m => m.tipo === 'gasto' && m.desc === s.desc);
    s.pagadoHoy = yaPagado;

    let ideal = 0;
    if (s.frecuencia === 'Diario') ideal = s.meta;
    else if (s.frecuencia === 'Semanal') {
      const dp = Number.parseInt(s.diaPago || 7, 10);
      const dias = hoyIdx === dp ? 7 : (hoyIdx > dp ? hoyIdx - dp : (7 - dp) + hoyIdx);
      ideal = (s.meta / 7) * dias;
    } else if (s.frecuencia === 'Mensual') ideal = (s.meta / 30) * diaMes;

    s.objetivoHoy = yaPagado && s.frecuencia === 'Diario' ? 0 : Math.min(ideal, s.meta);
    if (s.frecuencia !== 'Diario') {
      if (s.acumulado < s.objetivoHoy) deficitTotal += s.objetivoHoy - s.acumulado;
      const dp = Number.parseInt(s.diaPago || 7, 10);
      const vencido = s.frecuencia === 'Semanal' ? hoyIdx > dp : (s.frecuencia === 'Mensual' ? diaMes > dp : false);
      if (vencido && s.acumulado < s.meta) moraVencida += s.meta - s.acumulado;
    }
  });

  store.parametros.metaBase = metaBase;
  store.parametros.deficitTotal = deficitTotal;
  store.parametros.moraVencida = moraVencida;
  store.parametros.metaDiaria = metaBase + moraVencida;
}

const commit = () => { sanearDatos(); return store; };
export const iniciarTurno = () => { if (!store.turnoActivo) { store.turnoActivo = { inicio: Date.now(), kmInicial: store.parametros.ultimoKM }; saveData(); } };
export function finalizarTurno(kmFinal, ganancia) {
  const kF = safeFloat(kmFinal), gan = safeFloat(ganancia);
  if (kF < store.parametros.ultimoKM) throw new Error('KM_MENOR');
  const fin = Date.now(), inicio = store.turnoActivo?.inicio || fin, kmIni = store.turnoActivo?.kmInicial ?? store.parametros.ultimoKM;
  store.turnos.push({ id:uuid(), inicio, fin, fecha:new Date(fin).toISOString(), duracionMin:(fin-inicio)/60000, duracionHoras:(fin-inicio)/3600000, ganancia:gan, kmInicial:kmIni, kmFinal:kF, kmRecorrido:kF-kmIni, fuente:'reparto' });
  store.movimientos.push({ id:uuid(), fecha:new Date(fin).toISOString(), tipo:'ingreso', desc:'Turno Finalizado', monto:gan, categoria:'Reparto', fuente:'reparto' });
  store.turnoActivo = null; store.parametros.ultimoKM = kF; return commit();
}
export function registrarGasolina(litros, costo, km) {
  const k = safeFloat(km), c = safeFloat(costo);
  if (k > 0 && k < store.parametros.ultimoKM) throw new Error('KM_MENOR');
  store.cargasCombustible.push({ id:uuid(), fecha:new Date().toISOString(), litros:safeFloat(litros), costo:c, km:k });
  store.movimientos.push({ id:uuid(), fecha:new Date().toISOString(), tipo:'gasto', desc:'⛽ Gasolina', monto:c, categoria:'Operativo' });
  const gas = store.wallet.sobres.find(s => s.categoria === 'Operativo' && /gas|combustible/i.test(String(s.desc || '')));
  if (gas) gas.acumulado = Math.max(0, safeFloat(gas.acumulado) - c);
  if (k > store.parametros.ultimoKM) store.parametros.ultimoKM = k;
  return commit();
}
export function nuevoGasto(desc, monto, categoria, frecuencia) {
  const id = uuid();
  if (frecuencia !== 'Unico' || categoria === 'Ahorro') store.gastosFijosMensuales.push({ id, desc, monto:safeFloat(monto), categoria, frecuencia });
  if (frecuencia === 'Unico' && categoria !== 'Ahorro') store.movimientos.push({ id, fecha:new Date().toISOString(), tipo:'gasto', desc, monto:safeFloat(monto), categoria });
  return commit();
}
export function nuevaDeuda(desc, total, cuota, frecuencia, diaPago) {
  store.deudas.push({ id:uuid(), desc, montoTotal:safeFloat(total), montoCuota:safeFloat(cuota), frecuencia, diaPago, saldo:safeFloat(total), creadaEn:new Date().toISOString() });
  return commit();
}
export function abonarDeuda(id) {
  const d = store.deudas.find(x => x.id === id); if (!d) return store;
  const pago = Math.min(safeFloat(d.montoCuota), safeFloat(d.saldo));
  d.saldo = Math.max(0, safeFloat(d.saldo) - pago);
  const s = store.wallet.sobres.find(x => x.refId === id); if (s) s.acumulado = 0;
  store.movimientos.push({ id:uuid(), fecha:new Date().toISOString(), tipo:'gasto', desc:`Abono: ${d.desc}`, monto:pago, categoria:'Deuda' });
  return commit();
}
export function pagarRecurrente(id) {
  const g = store.gastosFijosMensuales.find(x => x.id === id); if (!g) return store;
  store.movimientos.push({ id:uuid(), fecha:new Date().toISOString(), tipo:'gasto', desc:g.desc, monto:safeFloat(g.monto), categoria:g.categoria });
  const s = store.wallet.sobres.find(x => x.refId === id); if (s) s.acumulado = Math.max(0, safeFloat(s.acumulado) - safeFloat(g.monto));
  return commit();
}
export function nuevaMetaAhorro(desc, monto) { return nuevoGasto(desc, monto, 'Ahorro', 'Unico'); }
export function abonarAhorro(id, monto) {
  const s = store.wallet.sobres.find(x => x.id === id); if (!s) return store;
  const m = Math.max(0, safeFloat(monto)); s.acumulado += m;
  store.movimientos.push({ id:uuid(), fecha:new Date().toISOString(), tipo:'gasto', desc:`Abono: ${s.desc}`, monto:m, categoria:'Ahorro' });
  return commit();
}
export function configurarKM(km) { const k=safeFloat(km); if(k<=0) throw new Error('KM_INVALIDO'); store.parametros.ultimoKM=k; store.parametros.kmInicialConfigurado=true; return commit(); }
export function saldoInicial(monto) { const m=safeFloat(monto); if(m<0) throw new Error('SALDO_INVALIDO'); store.movimientos.push({id:uuid(),fecha:new Date().toISOString(),tipo:'ingreso',desc:'Saldo Inicial',monto:m,categoria:'Sistema'}); store.parametros.saldoInicialConfigurado=true; return commit(); }

/* Trabajo híbrido: configuración independiente; no altera el motor de obligaciones. */
export function crearIngresoFijo(nombre, monto, frecuencia='Mensual', diaPago='') {
  store.ingresosFijos.push({ id:uuid(), nombre:String(nombre||'Trabajo fijo').trim(), monto:safeFloat(monto), frecuencia, diaPago, activo:true });
  saveData(); return store;
}
export function registrarCobroFijo(id) {
  const fuente = store.ingresosFijos.find(x => x.id === id && x.activo); if (!fuente) return store;
  store.movimientos.push({ id:uuid(), fecha:new Date().toISOString(), tipo:'ingreso', desc:`Ingreso fijo: ${fuente.nombre}`, monto:safeFloat(fuente.monto), categoria:'Trabajo fijo', fuente:'fijo', refId:fuente.id });
  return commit();
}
export function restaurar(json) {
  const parsed = JSON.parse(json);
  store = { ...structuredClone(INITIAL_STATE), ...parsed, parametros:{...INITIAL_STATE.parametros,...(parsed.parametros||{})}, wallet:{...INITIAL_STATE.wallet,...(parsed.wallet||{})} };
  return commit();
}
