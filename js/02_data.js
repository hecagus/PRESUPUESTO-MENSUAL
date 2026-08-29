/* v1.2.0 - Estado, persistencia y dominio. Cero DOM. */
import { STORAGE_KEY, LEGACY_KEYS, SCHEMA_VERSION, MAPA_DIAS, WORK_TYPES, safeFloat, uuid, normalizeWeekDay, quincenaId } from './01_consts_utils.js';

const INITIAL_STATE={
  schemaVersion:SCHEMA_VERSION,
  turnos:[],movimientos:[],cargasCombustible:[],fondosCombustibleEmpresa:[],deudas:[],gastosFijosMensuales:[],ingresosFijos:[],
  wallet:{saldo:0,sobres:[]},
  parametros:{ultimoKM:0,costoPorKm:0,metaDiaria:0,metaBase:0,deficitTotal:0,moraVencida:0,kmInicialConfigurado:false,saldoInicialConfigurado:false},
  categoriasPersonalizadas:{operativo:[],hogar:[]},turnoActivo:null
};
let store=structuredClone(INITIAL_STATE);
export const getState=()=>store;
export function saveData(){store.schemaVersion=SCHEMA_VERSION;localStorage.setItem(STORAGE_KEY,JSON.stringify(store));}

function migrarIngresosFijos(lista){return (Array.isArray(lista)?lista:[]).map(f=>{if(Array.isArray(f.pagos))return {...f,pagos:f.pagos.map(p=>({...p,monto:safeFloat(p.monto)}))};const frecuencia=['Semanal','Quincenal','Mensual'].includes(f.frecuencia)?f.frecuencia:'Mensual';let pagos=[];if(frecuencia==='Semanal')pagos=[{id:uuid(),monto:0,diaSemana:String(f.diaPago||'6')}];else if(frecuencia==='Quincenal')pagos=[{id:uuid(),monto:0,diaMes:'15'},{id:uuid(),monto:0,diaMes:'fin_mes'}];else pagos=[{id:uuid(),monto:0,diaMes:String(f.diaPago||'1')}];return {...f,frecuencia,pagos};});}
function migrarTurnos(lista){return (Array.isArray(lista)?lista:[]).map(t=>{const tipo=t.tipoTrabajo||((t.fuente==='jaimau')?'jaimau':'uber');return {...t,tipoTrabajo:tipo,fuente:tipo==='jaimau'?'jaimau':'uber',compensacion:t.compensacion||WORK_TYPES[tipo]?.compensation||'por_turno',combustible:t.combustible||WORK_TYPES[tipo]?.fuel||'personal'};});}

export function loadData(){
  let raw=localStorage.getItem(STORAGE_KEY);
  if(!raw||raw.length<50){for(const k of LEGACY_KEYS){const v=localStorage.getItem(k);if(v&&v.length>=50){raw=v;break;}}}
  if(raw){try{const x=JSON.parse(raw);store={...structuredClone(INITIAL_STATE),...x,wallet:{...INITIAL_STATE.wallet,...(x.wallet||{})},parametros:{...INITIAL_STATE.parametros,...(x.parametros||{})},categoriasPersonalizadas:{...INITIAL_STATE.categoriasPersonalizadas,...(x.categoriasPersonalizadas||{})},ingresosFijos:migrarIngresosFijos(x.ingresosFijos),turnos:migrarTurnos(x.turnos),fondosCombustibleEmpresa:Array.isArray(x.fondosCombustibleEmpresa)?x.fondosCombustibleEmpresa:[]};}catch(e){console.error('No se pudo cargar respaldo:',e);store=structuredClone(INITIAL_STATE);}}
  sanearDatos();return store;
}

export function sanearDatos(){
  for(const k of ['turnos','movimientos','cargasCombustible','fondosCombustibleEmpresa','deudas','gastosFijosMensuales','ingresosFijos'])if(!Array.isArray(store[k]))store[k]=[];
  store.turnos=migrarTurnos(store.turnos);
  if(!Array.isArray(store.wallet?.sobres))store.wallet={saldo:0,sobres:[]};
  store.wallet.saldo=store.movimientos.reduce((a,m)=>m.tipo==='ingreso'?a+safeFloat(m.monto):m.tipo==='gasto'?a-safeFloat(m.monto):a,0);
  const kms=[safeFloat(store.parametros.ultimoKM),...store.turnos.map(t=>safeFloat(t.kmFinal)),...store.cargasCombustible.map(c=>safeFloat(c.km))];
  store.parametros.ultimoKM=Math.max(0,...kms);
  if(store.parametros.ultimoKM>0)store.parametros.kmInicialConfigurado=true;
  if(store.turnoActivo){if(!Number.isFinite(store.turnoActivo.inicio)||store.turnoActivo.inicio<=0)store.turnoActivo=null;else if(!store.turnoActivo.tipoTrabajo)store.turnoActivo.tipoTrabajo='uber';}
  reconstruirSobres();calcularObjetivosYMeta();saveData();
}

function reconstruirSobres(){const refs=new Set();const ensure=(refId,tipo,desc,meta,freq,dp,cat)=>{refs.add(refId);let s=store.wallet.sobres.find(x=>x.refId===refId);if(!s){s={id:uuid(),refId,tipo,desc,acumulado:0,objetivoHoy:0};store.wallet.sobres.push(s);}Object.assign(s,{tipo,desc,meta:safeFloat(meta),frecuencia:freq});if(dp!==undefined&&dp!==null&&dp!=='')s.diaPago=dp;if(cat)s.categoria=cat;};store.deudas.filter(d=>safeFloat(d.saldo)>0).forEach(d=>ensure(d.id,'deuda',d.desc,d.montoCuota,d.frecuencia,d.diaPago,'Deuda'));store.gastosFijosMensuales.forEach(g=>ensure(g.id,'gasto',g.desc,g.monto,g.frecuencia,g.diaPago,g.categoria));store.wallet.sobres=store.wallet.sobres.filter(s=>refs.has(s.refId));}
export function calcularObjetivosYMeta(){const now=new Date(),hoy=MAPA_DIAS[now.getDay()],diaMes=now.getDate(),hoyStr=now.toDateString();let base=0;const cuota=(m,f)=>f==='Diario'?safeFloat(m):f==='Semanal'?safeFloat(m)/7:f==='Mensual'?safeFloat(m)/30:0;store.deudas.forEach(d=>{if(safeFloat(d.saldo)>0)base+=cuota(d.montoCuota,d.frecuencia)});store.gastosFijosMensuales.forEach(g=>{if(g.categoria!=='Ahorro'&&g.categoria!=='Meta')base+=cuota(g.monto,g.frecuencia)});const movHoy=store.movimientos.filter(m=>new Date(m.fecha).toDateString()===hoyStr);let deficit=0,mora=0;store.wallet.sobres.forEach(s=>{if(s.categoria==='Ahorro'||s.categoria==='Meta')return;const pagado=s.tipo==='deuda'?movHoy.some(m=>m.tipo==='gasto'&&m.desc===`Abono: ${s.desc}`):movHoy.some(m=>m.tipo==='gasto'&&m.desc===s.desc);s.pagadoHoy=pagado;let ideal=0;if(s.frecuencia==='Diario')ideal=s.meta;else if(s.frecuencia==='Semanal'){const dp=normalizeWeekDay(s.diaPago);const dias=hoy===dp?7:(hoy>dp?hoy-dp:(7-dp)+hoy);ideal=(s.meta/7)*dias;}else if(s.frecuencia==='Mensual')ideal=(s.meta/30)*diaMes;s.objetivoHoy=pagado&&s.frecuencia==='Diario'?0:Math.min(ideal,s.meta);if(s.frecuencia!=='Diario'){if(s.acumulado<s.objetivoHoy)deficit+=s.objetivoHoy-s.acumulado;const dp=s.frecuencia==='Semanal'?normalizeWeekDay(s.diaPago):Number.parseInt(s.diaPago||7,10);const vencido=s.frecuencia==='Semanal'?hoy>dp:s.frecuencia==='Mensual'?diaMes>dp:false;const creadaHoy=s.tipo==='deuda'&&s.creadaEn&&new Date(s.creadaEn).toDateString()===hoyStr;if(vencido&&!creadaHoy&&s.acumulado<s.meta)mora+=s.meta-s.acumulado;}});store.parametros.metaBase=base;store.parametros.deficitTotal=deficit;store.parametros.moraVencida=mora;store.parametros.metaDiaria=base+mora;}
const commit=()=>{sanearDatos();return store;};
const requireText=(value,code='DESCRIPCION_INVALIDA')=>{const text=String(value??'').trim();if(!text)throw new Error(code);return text;};
const requirePositive=(value,code='MONTO_INVALIDO')=>{const n=safeFloat(value);if(!(n>0))throw new Error(code);return n;};

export function iniciarTurno(tipoTrabajo='uber'){
  if(store.turnoActivo)throw new Error('TURNO_YA_ACTIVO');
  if(!WORK_TYPES[tipoTrabajo])throw new Error('TIPO_TRABAJO_INVALIDO');
  store.turnoActivo={inicio:Date.now(),kmInicial:store.parametros.ultimoKM,tipoTrabajo};
  saveData();return store;
}

export function finalizarTurno(kmFinal,ganancia){
  if(!store.turnoActivo)throw new Error('TURNO_NO_ACTIVO');
  const k=safeFloat(kmFinal),tipo=store.turnoActivo.tipoTrabajo||'uber';
  if(!(k>0))throw new Error('KM_INVALIDO');if(k<store.parametros.ultimoKM)throw new Error('KM_MENOR');
  let g=null;if(tipo==='uber'){g=safeFloat(ganancia);if(g<0)throw new Error('GANANCIA_INVALIDA');}
  const fin=Date.now(),ini=store.turnoActivo.inicio,ki=store.turnoActivo.kmInicial??store.parametros.ultimoKM,fecha=new Date(fin).toISOString();
  const secuenciaDia=store.turnos.filter(t=>new Date(t.fecha).toDateString()===new Date(fin).toDateString()).length+1;
  store.turnos.push({id:uuid(),inicio:ini,fin,fecha,duracionMin:(fin-ini)/60000,duracionHoras:(fin-ini)/3600000,ganancia:g,kmInicial:ki,kmFinal:k,kmRecorrido:k-ki,tipoTrabajo:tipo,fuente:tipo,compensacion:WORK_TYPES[tipo].compensation,combustible:WORK_TYPES[tipo].fuel,secuenciaDia,periodo:tipo==='jaimau'?quincenaId(fin):null});
  if(tipo==='uber')store.movimientos.push({id:uuid(),fecha,tipo:'ingreso',desc:'Turno Uber Eats',monto:g,categoria:'Ingreso extra',fuente:'uber'});
  store.turnoActivo=null;store.parametros.ultimoKM=k;return commit();
}

export function registrarFondoJaimau(monto){const m=requirePositive(monto);store.fondosCombustibleEmpresa.push({id:uuid(),fecha:new Date().toISOString(),monto:m,fuente:'jaimau',tipo:'deposito'});return commit();}
export function saldoCombustibleEmpresa(){const depositado=store.fondosCombustibleEmpresa.reduce((a,x)=>a+safeFloat(x.monto),0);const utilizado=store.cargasCombustible.filter(x=>x.pagador==='empresa').reduce((a,x)=>a+safeFloat(x.costo),0);return {depositado,utilizado,disponible:depositado-utilizado};}
export function registrarGasolina(litros,costo,km,pagador='personal'){
  const l=requirePositive(litros,'LITROS_INVALIDOS'),c=requirePositive(costo),k=safeFloat(km);if(!(k>0))throw new Error('KM_INVALIDO');if(k<store.parametros.ultimoKM)throw new Error('KM_MENOR');
  const empresa=pagador==='empresa';store.cargasCombustible.push({id:uuid(),fecha:new Date().toISOString(),litros:l,costo:c,km:k,pagador:empresa?'empresa':'personal',fuente:empresa?'jaimau':'personal'});
  if(!empresa){store.movimientos.push({id:uuid(),fecha:new Date().toISOString(),tipo:'gasto',desc:'⛽ Gasolina',monto:c,categoria:'Operativo',fuente:'personal'});const gas=store.wallet.sobres.find(s=>s.categoria==='Operativo'&&/gas|combustible/i.test(String(s.desc||'')));if(gas)gas.acumulado=Math.max(0,safeFloat(gas.acumulado)-c);}
  if(k>store.parametros.ultimoKM)store.parametros.ultimoKM=k;return commit();
}

export function registrarPagoJaimau(monto,fecha=Date.now()){
  const m=requirePositive(monto),periodo=quincenaId(fecha);if(store.movimientos.some(x=>x.tipo==='ingreso'&&x.fuente==='jaimau'&&x.periodo===periodo))throw new Error('COBRO_DUPLICADO');
  store.movimientos.push({id:uuid(),fecha:new Date(fecha).toISOString(),tipo:'ingreso',desc:`Pago Jaimau ${periodo}`,monto:m,categoria:'Trabajo principal',fuente:'jaimau',periodo});return commit();
}

export function nuevoGasto(desc,monto,categoria,frecuencia){const d=requireText(desc),m=requirePositive(monto);const id=uuid();if(frecuencia!=='Unico'||categoria==='Ahorro')store.gastosFijosMensuales.push({id,desc:d,monto:m,categoria,frecuencia});if(frecuencia==='Unico'&&categoria!=='Ahorro')store.movimientos.push({id,fecha:new Date().toISOString(),tipo:'gasto',desc:d,monto:m,categoria});return commit();}
export function nuevaDeuda(desc,total,cuota,frecuencia,diaPago){const d=requireText(desc),t=requirePositive(total,'TOTAL_INVALIDO'),c=requirePositive(cuota,'CUOTA_INVALIDA');store.deudas.push({id:uuid(),desc:d,montoTotal:t,montoCuota:c,frecuencia,diaPago,saldo:t,creadaEn:new Date().toISOString()});return commit();}
export function abonarDeuda(id){const d=store.deudas.find(x=>x.id===id);if(!d)return store;const p=Math.min(safeFloat(d.montoCuota),safeFloat(d.saldo));if(!(p>0))throw new Error('CUOTA_INVALIDA');d.saldo=Math.max(0,safeFloat(d.saldo)-p);const s=store.wallet.sobres.find(x=>x.refId===id);if(s)s.acumulado=0;store.movimientos.push({id:uuid(),fecha:new Date().toISOString(),tipo:'gasto',desc:`Abono: ${d.desc}`,monto:p,categoria:'Deuda'});return commit();}
export function pagarRecurrente(id){const g=store.gastosFijosMensuales.find(x=>x.id===id);if(!g)return store;const monto=requirePositive(g.monto);store.movimientos.push({id:uuid(),fecha:new Date().toISOString(),tipo:'gasto',desc:g.desc,monto,categoria:g.categoria});const s=store.wallet.sobres.find(x=>x.refId===id);if(s)s.acumulado=Math.max(0,safeFloat(s.acumulado)-monto);return commit();}
export function nuevaMetaAhorro(desc,monto){return nuevoGasto(desc,monto,'Ahorro','Unico');}
export function abonarAhorro(id,monto){const s=store.wallet.sobres.find(x=>x.id===id);if(!s)return store;const m=requirePositive(monto);s.acumulado+=m;store.movimientos.push({id:uuid(),fecha:new Date().toISOString(),tipo:'gasto',desc:`Abono: ${s.desc}`,monto:m,categoria:'Ahorro'});return commit();}
export function configurarKM(km){const k=safeFloat(km);if(k<=0)throw new Error('KM_INVALIDO');store.parametros.ultimoKM=k;store.parametros.kmInicialConfigurado=true;return commit();}
export function saldoInicial(monto){const m=safeFloat(monto);if(m<0)throw new Error('SALDO_INVALIDO');store.movimientos.push({id:uuid(),fecha:new Date().toISOString(),tipo:'ingreso',desc:'Saldo Inicial',monto:m,categoria:'Sistema'});store.parametros.saldoInicialConfigurado=true;return commit();}
export function crearIngresoFijo(config){const nombre=requireText(config?.nombre,'NOMBRE_INVALIDO');const frecuencia=config?.frecuencia;let pagos=[];if(frecuencia==='Semanal')pagos=[{id:uuid(),monto:0,diaSemana:String(config.dia1)}];else if(frecuencia==='Quincenal')pagos=[{id:uuid(),monto:0,diaMes:String(config.dia1||15)},{id:uuid(),monto:0,diaMes:config.dia2==='fin_mes'?'fin_mes':String(config.dia2)}];else if(frecuencia==='Mensual')pagos=[{id:uuid(),monto:0,diaMes:String(config.dia1)}];else throw new Error('FRECUENCIA_INVALIDA');store.ingresosFijos.push({id:uuid(),nombre,frecuencia,pagos,activo:true});saveData();return store;}
export function registrarCobroFijo(id,pagoId,monto){const f=store.ingresosFijos.find(x=>x.id===id&&x.activo);if(!f)throw new Error('INGRESO_NO_ENCONTRADO');const p=f.pagos?.find(x=>x.id===pagoId);if(!p)throw new Error('PAGO_NO_ENCONTRADO');const m=requirePositive(monto);const now=new Date(),periodo=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;const duplicado=store.movimientos.some(x=>x.tipo==='ingreso'&&x.refId===f.id&&x.pagoId===p.id&&x.periodo===periodo);if(duplicado)throw new Error('COBRO_DUPLICADO');p.monto=m;p.ultimoCobro={monto:m,fecha:now.toISOString(),periodo};store.movimientos.push({id:uuid(),fecha:now.toISOString(),tipo:'ingreso',desc:`Ingreso fijo: ${f.nombre}`,monto:m,categoria:'Trabajo fijo',fuente:'fijo',refId:f.id,pagoId:p.id,periodo});return commit();}
export function restaurar(json){let x;try{x=JSON.parse(json);}catch{throw new Error('BACKUP_INVALIDO');}if(!x||typeof x!=='object'||Array.isArray(x))throw new Error('BACKUP_INVALIDO');const hasKnownData=['movimientos','turnos','deudas','wallet','parametros','ingresosFijos'].some(k=>Object.prototype.hasOwnProperty.call(x,k));if(!hasKnownData)throw new Error('BACKUP_INVALIDO');store={...structuredClone(INITIAL_STATE),...x,parametros:{...INITIAL_STATE.parametros,...(x.parametros||{})},wallet:{...INITIAL_STATE.wallet,...(x.wallet||{})},categoriasPersonalizadas:{...INITIAL_STATE.categoriasPersonalizadas,...(x.categoriasPersonalizadas||{})},ingresosFijos:migrarIngresosFijos(x.ingresosFijos),turnos:migrarTurnos(x.turnos),fondosCombustibleEmpresa:Array.isArray(x.fondosCombustibleEmpresa)?x.fondosCombustibleEmpresa:[]};return commit();}
