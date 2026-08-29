/* v2.0.0 - Motor financiero configurable. Cero DOM. */
import {
  STORAGE_KEY, LEGACY_KEYS, SCHEMA_VERSION, MAPA_DIAS, CAPABILITIES,
  SOURCE_KINDS, COMPENSATIONS, TRANSPORT_MODES, safeFloat, uuid,
  normalizeWeekDay, periodIdFor
} from './01_consts_utils.js';

const PERSONAL_ACCOUNT_ID='acct-personal';
const LEGACY_JAIMAU_ID='source-jaimau';
const LEGACY_UBER_ID='source-uber';
const LEGACY_TICKET_ID='acct-ticketcar';

const INITIAL_STATE={
  schemaVersion:SCHEMA_VERSION,
  profile:{
    onboarded:false,
    displayName:'',
    useCases:['personal'],
    transportMode:'none',
    capabilities:[CAPABILITIES.PERSONAL_FINANCE],
    currency:'MXN'
  },
  workSources:[],
  accounts:[],
  assets:[],
  turnos:[],
  movimientos:[],
  cargasCombustible:[],
  fondosCombustibleEmpresa:[],
  deudas:[],
  gastosFijosMensuales:[],
  ingresosFijos:[],
  business:{ingredients:[],products:[],sales:[]},
  wallet:{saldo:0,sobres:[]},
  parametros:{ultimoKM:0,costoPorKm:0,metaDiaria:0,metaBase:0,deficitTotal:0,moraVencida:0,kmInicialConfigurado:false,saldoInicialConfigurado:false},
  categoriasPersonalizadas:{operativo:[],hogar:[]},
  activeActivity:null,
  turnoActivo:null
};

let store=structuredClone(INITIAL_STATE);
export const getState=()=>store;
export const getCapabilities=()=>new Set(store.profile?.capabilities||[]);
export const fuenteById=id=>store.workSources.find(x=>x.id===id)||null;
export const cuentaById=id=>store.accounts.find(x=>x.id===id)||null;

export function saveData(){
  store.schemaVersion=SCHEMA_VERSION;
  localStorage.setItem(STORAGE_KEY,JSON.stringify(store));
}

const requireText=(value,code='DESCRIPCION_INVALIDA')=>{
  const text=String(value??'').trim();
  if(!text)throw new Error(code);
  return text;
};
const requirePositive=(value,code='MONTO_INVALIDO')=>{
  const n=safeFloat(value);
  if(!(n>0))throw new Error(code);
  return n;
};
const sourceLabel=s=>s?.name||'Ingreso';

function hasMeaningfulLegacy(x){
  return ['turnos','movimientos','cargasCombustible','fondosCombustibleEmpresa','deudas','gastosFijosMensuales','ingresosFijos']
    .some(k=>Array.isArray(x?.[k])&&x[k].length>0)
    ||Boolean(x?.parametros?.saldoInicialConfigurado)
    ||Boolean(x?.parametros?.kmInicialConfigurado);
}

function defaultPersonalAccount(){
  return {id:PERSONAL_ACCOUNT_ID,name:'Caja personal',type:'cash',ownership:'personal',active:true};
}

function legacySources(){
  return [
    {
      id:LEGACY_JAIMAU_ID,name:'Jaimau / Ingenico',kind:'employment',compensation:'biweekly',
      trackTime:true,trackDistance:true,fuelPayer:'company',fundAccountId:LEGACY_TICKET_ID,active:true,legacyKey:'jaimau'
    },
    {
      id:LEGACY_UBER_ID,name:'Uber Eats',kind:'gig',compensation:'per_shift',
      trackTime:true,trackDistance:true,fuelPayer:'personal',fundAccountId:null,active:true,legacyKey:'uber'
    }
  ];
}

function migrateFixedIncome(list){
  return (Array.isArray(list)?list:[]).map(f=>{
    if(Array.isArray(f.pagos))return {...f,pagos:f.pagos.map(p=>({...p,monto:safeFloat(p.monto)}))};
    const frecuencia=['Semanal','Quincenal','Mensual'].includes(f.frecuencia)?f.frecuencia:'Mensual';
    let pagos=[];
    if(frecuencia==='Semanal')pagos=[{id:uuid(),monto:0,diaSemana:String(f.diaPago||'6')}];
    else if(frecuencia==='Quincenal')pagos=[{id:uuid(),monto:0,diaMes:'15'},{id:uuid(),monto:0,diaMes:'fin_mes'}];
    else pagos=[{id:uuid(),monto:0,diaMes:String(f.diaPago||'1')}];
    return {...f,frecuencia,pagos};
  });
}

function migrateWorkSources(x){
  if(Array.isArray(x.workSources)&&x.workSources.length)return x.workSources.map(s=>({...s,active:s.active!==false}));
  if(!hasMeaningfulLegacy(x))return [];
  return legacySources();
}

function legacySourceId(turnoOrMovement){
  const key=turnoOrMovement?.tipoTrabajo||turnoOrMovement?.fuente;
  if(key==='jaimau')return LEGACY_JAIMAU_ID;
  if(key==='uber'||key==='reparto'||turnoOrMovement?.desc==='Turno Finalizado')return LEGACY_UBER_ID;
  return turnoOrMovement?.sourceId||null;
}

function migrateTurns(list,sources){
  return (Array.isArray(list)?list:[]).map(t=>{
    const sourceId=t.sourceId||legacySourceId(t);
    const source=sources.find(s=>s.id===sourceId);
    return {
      ...t,
      sourceId,
      tipoTrabajo:t.tipoTrabajo||source?.legacyKey||null,
      fuente:t.fuente||source?.legacyKey||sourceId,
      compensacion:t.compensacion||source?.compensation||'per_shift',
      combustible:t.combustible||source?.fuelPayer||'personal'
    };
  });
}

function migrateMovements(list){
  return (Array.isArray(list)?list:[]).map(m=>({
    ...m,
    sourceId:m.sourceId||legacySourceId(m),
    accountId:m.accountId||PERSONAL_ACCOUNT_ID,
    affectsPersonal:m.affectsPersonal!==false
  }));
}

function migrateProfile(x,sources){
  if(x.profile?.onboarded!==undefined)return {
    ...structuredClone(INITIAL_STATE.profile),
    ...x.profile,
    capabilities:Array.isArray(x.profile.capabilities)?x.profile.capabilities:[CAPABILITIES.PERSONAL_FINANCE]
  };
  if(!hasMeaningfulLegacy(x))return structuredClone(INITIAL_STATE.profile);
  return {
    onboarded:true,
    displayName:'',
    useCases:['employment','gig'],
    transportMode:'motorcycle',
    capabilities:[
      CAPABILITIES.PERSONAL_FINANCE,CAPABILITIES.WORK,CAPABILITIES.TIME_TRACKING,
      CAPABILITIES.TRANSPORT,CAPABILITIES.VEHICLE,CAPABILITIES.FUEL,CAPABILITIES.THIRD_PARTY_FUNDS
    ],
    currency:'MXN'
  };
}

function migrateAccounts(x,sources){
  if(Array.isArray(x.accounts)&&x.accounts.length)return x.accounts.map(a=>({...a,active:a.active!==false}));
  const accounts=[defaultPersonalAccount()];
  if(sources.some(s=>s.fuelPayer==='company'))accounts.push({id:LEGACY_TICKET_ID,name:'Fondo empresa',type:'third_party',ownership:'third_party',active:true});
  return accounts;
}

function normalizeBusiness(business){
  return {
    ingredients:Array.isArray(business?.ingredients)?business.ingredients:[],
    products:Array.isArray(business?.products)?business.products:[],
    sales:Array.isArray(business?.sales)?business.sales:[]
  };
}

export function loadData(){
  let raw=localStorage.getItem(STORAGE_KEY);
  if(!raw||raw.length<50){
    for(const k of LEGACY_KEYS){const v=localStorage.getItem(k);if(v&&v.length>=50){raw=v;break;}}
  }
  if(raw){
    try{
      const x=JSON.parse(raw);
      const sources=migrateWorkSources(x);
      const profile=migrateProfile(x,sources);
      const accounts=migrateAccounts(x,sources);
      store={
        ...structuredClone(INITIAL_STATE),...x,
        profile,workSources:sources,accounts,
        assets:Array.isArray(x.assets)?x.assets:[],
        wallet:{...INITIAL_STATE.wallet,...(x.wallet||{})},
        parametros:{...INITIAL_STATE.parametros,...(x.parametros||{})},
        categoriasPersonalizadas:{...INITIAL_STATE.categoriasPersonalizadas,...(x.categoriasPersonalizadas||{})},
        ingresosFijos:migrateFixedIncome(x.ingresosFijos),
        turnos:migrateTurns(x.turnos,sources),
        movimientos:migrateMovements(x.movimientos),
        fondosCombustibleEmpresa:Array.isArray(x.fondosCombustibleEmpresa)?x.fondosCombustibleEmpresa:[],
        business:normalizeBusiness(x.business),
        activeActivity:x.activeActivity||x.turnoActivo||null,
        turnoActivo:x.turnoActivo||x.activeActivity||null
      };
    }catch(e){
      console.error('No se pudo cargar respaldo:',e);
      store=structuredClone(INITIAL_STATE);
    }
  }else store=structuredClone(INITIAL_STATE);
  sanearDatos();
  return store;
}

export function deriveCapabilities(){
  const caps=new Set([CAPABILITIES.PERSONAL_FINANCE]);
  if(store.workSources.some(s=>s.active!==false))caps.add(CAPABILITIES.WORK);
  if(store.workSources.some(s=>s.active!==false&&s.trackTime))caps.add(CAPABILITIES.TIME_TRACKING);
  const transport=store.profile?.transportMode||'none';
  if(transport!=='none')caps.add(CAPABILITIES.TRANSPORT);
  if(TRANSPORT_MODES[transport]?.vehicle)caps.add(CAPABILITIES.VEHICLE);
  if(TRANSPORT_MODES[transport]?.vehicle&&store.workSources.some(s=>s.fuelPayer!=='none'))caps.add(CAPABILITIES.FUEL);
  if(store.workSources.some(s=>s.fuelPayer==='company'))caps.add(CAPABILITIES.THIRD_PARTY_FUNDS);
  if(store.workSources.some(s=>s.kind==='freelance'))caps.add(CAPABILITIES.FREELANCE);
  if(store.workSources.some(s=>s.kind==='business')){
    caps.add(CAPABILITIES.BUSINESS);caps.add(CAPABILITIES.RECIPES);caps.add(CAPABILITIES.INVENTORY);
  }
  store.profile.capabilities=[...caps];
  return store.profile.capabilities;
}

export function sanearDatos(){
  for(const k of ['workSources','accounts','assets','turnos','movimientos','cargasCombustible','fondosCombustibleEmpresa','deudas','gastosFijosMensuales','ingresosFijos']){
    if(!Array.isArray(store[k]))store[k]=[];
  }
  store.business=normalizeBusiness(store.business);
  if(!store.profile||typeof store.profile!=='object')store.profile=structuredClone(INITIAL_STATE.profile);
  if(!store.accounts.some(a=>a.id===PERSONAL_ACCOUNT_ID))store.accounts.unshift(defaultPersonalAccount());
  store.turnos=migrateTurns(store.turnos,store.workSources);
  store.movimientos=migrateMovements(store.movimientos);
  if(!Array.isArray(store.wallet?.sobres))store.wallet={saldo:0,sobres:[]};
  store.wallet.saldo=store.movimientos.reduce((a,m)=>m.affectsPersonal===false?a:(m.tipo==='ingreso'?a+safeFloat(m.monto):m.tipo==='gasto'?a-safeFloat(m.monto):a),0);
  const kms=[safeFloat(store.parametros.ultimoKM),...store.turnos.map(t=>safeFloat(t.kmFinal)),...store.cargasCombustible.map(c=>safeFloat(c.km))];
  store.parametros.ultimoKM=Math.max(0,...kms);
  if(store.parametros.ultimoKM>0)store.parametros.kmInicialConfigurado=true;
  store.activeActivity=store.activeActivity||store.turnoActivo||null;
  if(store.activeActivity&&(!Number.isFinite(store.activeActivity.inicio)||store.activeActivity.inicio<=0))store.activeActivity=null;
  store.turnoActivo=store.activeActivity;
  deriveCapabilities();
  reconstruirSobres();
  calcularObjetivosYMeta();
  saveData();
}

function reconstruirSobres(){
  const refs=new Set();
  const ensure=(refId,tipo,desc,meta,freq,dp,cat)=>{
    refs.add(refId);let s=store.wallet.sobres.find(x=>x.refId===refId);
    if(!s){s={id:uuid(),refId,tipo,desc,acumulado:0,objetivoHoy:0};store.wallet.sobres.push(s);}
    Object.assign(s,{tipo,desc,meta:safeFloat(meta),frecuencia:freq});
    if(dp!==undefined&&dp!==null&&dp!=='')s.diaPago=dp;
    if(cat)s.categoria=cat;
  };
  store.deudas.filter(d=>safeFloat(d.saldo)>0).forEach(d=>ensure(d.id,'deuda',d.desc,d.montoCuota,d.frecuencia,d.diaPago,'Deuda'));
  store.gastosFijosMensuales.forEach(g=>ensure(g.id,'gasto',g.desc,g.monto,g.frecuencia,g.diaPago,g.categoria));
  store.wallet.sobres=store.wallet.sobres.filter(s=>refs.has(s.refId));
}

export function calcularObjetivosYMeta(){
  const now=new Date(),hoy=MAPA_DIAS[now.getDay()],diaMes=now.getDate(),hoyStr=now.toDateString();let base=0;
  const cuota=(m,f)=>f==='Diario'?safeFloat(m):f==='Semanal'?safeFloat(m)/7:f==='Mensual'?safeFloat(m)/30:0;
  store.deudas.forEach(d=>{if(safeFloat(d.saldo)>0)base+=cuota(d.montoCuota,d.frecuencia)});
  store.gastosFijosMensuales.forEach(g=>{if(g.categoria!=='Ahorro'&&g.categoria!=='Meta')base+=cuota(g.monto,g.frecuencia)});
  const movHoy=store.movimientos.filter(m=>new Date(m.fecha).toDateString()===hoyStr&&m.affectsPersonal!==false);let deficit=0,mora=0;
  store.wallet.sobres.forEach(s=>{
    if(s.categoria==='Ahorro'||s.categoria==='Meta')return;
    const pagado=s.tipo==='deuda'?movHoy.some(m=>m.tipo==='gasto'&&m.desc===`Abono: ${s.desc}`):movHoy.some(m=>m.tipo==='gasto'&&m.desc===s.desc);
    s.pagadoHoy=pagado;let ideal=0;
    if(s.frecuencia==='Diario')ideal=s.meta;
    else if(s.frecuencia==='Semanal'){
      const dp=normalizeWeekDay(s.diaPago);const dias=hoy===dp?7:(hoy>dp?hoy-dp:(7-dp)+hoy);ideal=(s.meta/7)*dias;
    }else if(s.frecuencia==='Mensual')ideal=(s.meta/30)*diaMes;
    s.objetivoHoy=pagado&&s.frecuencia==='Diario'?0:Math.min(ideal,s.meta);
    if(s.frecuencia!=='Diario'){
      if(s.acumulado<s.objetivoHoy)deficit+=s.objetivoHoy-s.acumulado;
      const dp=s.frecuencia==='Semanal'?normalizeWeekDay(s.diaPago):Number.parseInt(s.diaPago||7,10);
      const vencido=s.frecuencia==='Semanal'?hoy>dp:s.frecuencia==='Mensual'?diaMes>dp:false;
      const creadaHoy=s.tipo==='deuda'&&s.creadaEn&&new Date(s.creadaEn).toDateString()===hoyStr;
      if(vencido&&!creadaHoy&&s.acumulado<s.meta)mora+=s.meta-s.acumulado;
    }
  });
  store.parametros.metaBase=base;store.parametros.deficitTotal=deficit;store.parametros.moraVencida=mora;store.parametros.metaDiaria=base+mora;
}

const commit=()=>{sanearDatos();return store;};

function sourceDefaults(config){
  const kind=SOURCE_KINDS[config.kind]?config.kind:'other';
  const compensation=COMPENSATIONS[config.compensation]?config.compensation:(kind==='gig'?'per_shift':kind==='employment'?'monthly':'variable');
  const vehicle=TRANSPORT_MODES[store.profile.transportMode]?.vehicle;
  return {
    id:config.id||uuid(),name:requireText(config.name,'NOMBRE_INVALIDO'),kind,compensation,
    trackTime:config.trackTime??['employment','gig','freelance'].includes(kind),
    trackDistance:config.trackDistance??Boolean(vehicle&&['employment','gig'].includes(kind)),
    fuelPayer:config.fuelPayer||'personal',fundAccountId:config.fundAccountId||null,active:config.active!==false
  };
}

export function crearCuenta(config){
  const account={
    id:config?.id||uuid(),name:requireText(config?.name,'NOMBRE_INVALIDO'),
    type:config?.type||'cash',ownership:config?.ownership||'personal',active:config?.active!==false
  };
  store.accounts.push(account);return commit();
}

export function crearFuenteTrabajo(config){
  const source=sourceDefaults(config||{});
  if(source.fuelPayer==='company'&&!source.fundAccountId){
    const account={id:uuid(),name:`Fondo ${source.name}`,type:'third_party',ownership:'third_party',active:true};
    store.accounts.push(account);source.fundAccountId=account.id;
  }
  store.workSources.push(source);return commit();
}

export function actualizarFuenteTrabajo(id,patch){
  const source=fuenteById(id);if(!source)throw new Error('FUENTE_NO_ENCONTRADA');
  if(patch.name!==undefined)source.name=requireText(patch.name,'NOMBRE_INVALIDO');
  for(const key of ['kind','compensation','trackTime','trackDistance','fuelPayer','fundAccountId','active'])if(patch[key]!==undefined)source[key]=patch[key];
  if(source.fuelPayer==='company'&&!source.fundAccountId){const a={id:uuid(),name:`Fondo ${source.name}`,type:'third_party',ownership:'third_party',active:true};store.accounts.push(a);source.fundAccountId=a.id;}
  return commit();
}

export function configurarOnboarding(config={}){
  const transportMode=TRANSPORT_MODES[config.transportMode]?config.transportMode:'none';
  store.profile={
    ...store.profile,
    onboarded:true,
    displayName:String(config.displayName||store.profile.displayName||'').trim(),
    useCases:Array.isArray(config.useCases)&&config.useCases.length?config.useCases:['personal'],
    transportMode,
    currency:'MXN'
  };
  if(!store.accounts.some(a=>a.id===PERSONAL_ACCOUNT_ID))store.accounts.unshift(defaultPersonalAccount());
  if(TRANSPORT_MODES[transportMode]?.vehicle&&!store.assets.some(a=>a.kind==='vehicle')){
    store.assets.push({id:uuid(),kind:'vehicle',name:config.vehicleName||TRANSPORT_MODES[transportMode].label,transportMode,active:true});
  }
  if(Array.isArray(config.sources)){
    for(const raw of config.sources){
      if(!raw?.name)continue;
      const existing=raw.id?fuenteById(raw.id):store.workSources.find(s=>s.name.toLowerCase()===String(raw.name).trim().toLowerCase());
      if(existing)actualizarFuenteTrabajo(existing.id,raw);else crearFuenteTrabajo(raw);
    }
  }
  const opening=safeFloat(config.openingBalance);
  if(opening>=0&&!store.parametros.saldoInicialConfigurado&&config.openingBalance!==undefined&&config.openingBalance!=='')saldoInicial(opening);
  deriveCapabilities();return commit();
}

export function saldoCuenta(accountId){
  const account=cuentaById(accountId);if(!account)return 0;
  if(account.ownership==='third_party'){
    const depositado=store.fondosCombustibleEmpresa.filter(x=>x.accountId===accountId||(!x.accountId&&account.id===LEGACY_TICKET_ID)).reduce((a,x)=>a+safeFloat(x.monto),0);
    const usado=store.cargasCombustible.filter(x=>x.accountId===accountId||(!x.accountId&&x.pagador==='empresa'&&account.id===LEGACY_TICKET_ID)).reduce((a,x)=>a+safeFloat(x.costo),0);
    return depositado-usado;
  }
  return store.movimientos.filter(m=>m.accountId===accountId&&m.affectsPersonal!==false).reduce((a,m)=>m.tipo==='ingreso'?a+safeFloat(m.monto):m.tipo==='gasto'?a-safeFloat(m.monto):a,0);
}

export function iniciarActividad(sourceId){
  if(store.activeActivity)throw new Error('TURNO_YA_ACTIVO');
  const source=fuenteById(sourceId);if(!source||source.active===false)throw new Error('FUENTE_NO_ENCONTRADA');
  store.activeActivity={id:uuid(),sourceId,inicio:Date.now(),kmInicial:source.trackDistance?store.parametros.ultimoKM:null};
  store.turnoActivo=store.activeActivity;saveData();return store;
}

export function finalizarActividad({kmFinal=null,income=null}={}){
  if(!store.activeActivity)throw new Error('TURNO_NO_ACTIVO');
  const source=fuenteById(store.activeActivity.sourceId);if(!source)throw new Error('FUENTE_NO_ENCONTRADA');
  let k=null,kmRecorrido=0;
  if(source.trackDistance){
    k=safeFloat(kmFinal);if(!(k>0))throw new Error('KM_INVALIDO');if(k<store.parametros.ultimoKM)throw new Error('KM_MENOR');
    kmRecorrido=k-safeFloat(store.activeActivity.kmInicial??store.parametros.ultimoKM);
  }
  let earned=null;
  if(COMPENSATIONS[source.compensation]?.captureOnActivity){earned=safeFloat(income);if(earned<0)throw new Error('GANANCIA_INVALIDA');}
  const fin=Date.now(),fecha=new Date(fin).toISOString(),ini=store.activeActivity.inicio;
  const turno={
    id:store.activeActivity.id||uuid(),sourceId:source.id,inicio:ini,fin,fecha,
    duracionMin:(fin-ini)/60000,duracionHoras:(fin-ini)/3600000,
    ganancia:earned,kmInicial:store.activeActivity.kmInicial,kmFinal:k,kmRecorrido,
    compensacion:source.compensation,tipoTrabajo:source.legacyKey||null,fuente:source.legacyKey||source.id,
    periodo:periodIdFor(source.compensation,fin)
  };
  store.turnos.push(turno);
  if(earned!==null){
    store.movimientos.push({id:uuid(),fecha,tipo:'ingreso',desc:`Actividad · ${source.name}`,monto:earned,categoria:'Trabajo',fuente:source.id,sourceId:source.id,accountId:PERSONAL_ACCOUNT_ID,affectsPersonal:true,periodo:turno.periodo});
  }
  store.activeActivity=null;store.turnoActivo=null;if(k&&k>store.parametros.ultimoKM)store.parametros.ultimoKM=k;
  return commit();
}

export function registrarPagoFuente(sourceId,monto,fecha=Date.now()){
  const source=fuenteById(sourceId);if(!source)throw new Error('FUENTE_NO_ENCONTRADA');
  const m=requirePositive(monto),periodo=periodIdFor(source.compensation,fecha);
  if(store.movimientos.some(x=>x.tipo==='ingreso'&&x.sourceId===source.id&&x.periodo===periodo&&x.paymentKind==='source_period'))throw new Error('COBRO_DUPLICADO');
  store.movimientos.push({
    id:uuid(),fecha:new Date(fecha).toISOString(),tipo:'ingreso',desc:`Pago · ${source.name}`,monto:m,
    categoria:'Trabajo',fuente:source.id,sourceId:source.id,accountId:PERSONAL_ACCOUNT_ID,affectsPersonal:true,periodo,paymentKind:'source_period'
  });
  return commit();
}

export function registrarFondoFuente(sourceId,monto,descripcion='Depósito de empresa'){
  const source=fuenteById(sourceId);if(!source)throw new Error('FUENTE_NO_ENCONTRADA');
  if(source.fuelPayer!=='company')throw new Error('FONDO_NO_APLICA');
  if(!source.fundAccountId){const a={id:uuid(),name:`Fondo ${source.name}`,type:'third_party',ownership:'third_party',active:true};store.accounts.push(a);source.fundAccountId=a.id;}
  const m=requirePositive(monto);
  store.fondosCombustibleEmpresa.push({id:uuid(),fecha:new Date().toISOString(),monto:m,sourceId:source.id,accountId:source.fundAccountId,fuente:source.id,tipo:'deposito',desc:descripcion});
  return commit();
}

export function saldoFondoFuente(sourceId){
  const source=fuenteById(sourceId);if(!source||!source.fundAccountId)return{depositado:0,utilizado:0,disponible:0};
  const depositado=store.fondosCombustibleEmpresa.filter(x=>x.sourceId===source.id||(!x.sourceId&&source.legacyKey==='jaimau')).reduce((a,x)=>a+safeFloat(x.monto),0);
  const utilizado=store.cargasCombustible.filter(x=>x.sourceId===source.id||(!x.sourceId&&x.pagador==='empresa'&&source.legacyKey==='jaimau')).reduce((a,x)=>a+safeFloat(x.costo),0);
  return {depositado,utilizado,disponible:depositado-utilizado};
}

export function registrarCombustible({litros,costo,km,sourceId=null,payer=null,gasolinera=''}={}){
  const l=requirePositive(litros,'LITROS_INVALIDOS'),c=requirePositive(costo),k=safeFloat(km);
  if(!(k>0))throw new Error('KM_INVALIDO');if(k<store.parametros.ultimoKM)throw new Error('KM_MENOR');
  const activeSource=store.activeActivity?fuenteById(store.activeActivity.sourceId):null;
  const source=activeSource||fuenteById(sourceId);
  const resolvedPayer=source?.fuelPayer==='company'?'company':source?.fuelPayer==='personal'?'personal':payer;
  if(!['company','personal'].includes(resolvedPayer))throw new Error('ORIGEN_COMBUSTIBLE_REQUERIDO');
  const company=resolvedPayer==='company';
  if(company&&!source)throw new Error('FUENTE_NO_ENCONTRADA');
  const accountId=company?source.fundAccountId:PERSONAL_ACCOUNT_ID;
  const fecha=new Date().toISOString(),station=String(gasolinera||'').trim();
  store.cargasCombustible.push({
    id:uuid(),fecha,litros:l,costo:c,km:k,pagador:company?'empresa':'personal',
    sourceId:source?.id||null,accountId,fuente:source?.id||'personal',tipoTrabajo:source?.id||'personal',gasolinera:station
  });
  if(!company){
    store.movimientos.push({id:uuid(),fecha,tipo:'gasto',desc:station?`⛽ Combustible · ${station}`:'⛽ Combustible',monto:c,categoria:'Transporte',fuente:source?.id||'personal',sourceId:source?.id||null,accountId:PERSONAL_ACCOUNT_ID,affectsPersonal:true});
  }
  if(k>store.parametros.ultimoKM)store.parametros.ultimoKM=k;
  return commit();
}

/* Compatibilidad v1.x */
function legacySource(key){return store.workSources.find(s=>s.legacyKey===key)||store.workSources.find(s=>key==='jaimau'?s.kind==='employment':s.kind==='gig');}
export function iniciarTurno(tipoTrabajo='uber'){const s=legacySource(tipoTrabajo);if(!s)throw new Error('FUENTE_NO_ENCONTRADA');return iniciarActividad(s.id);}
export function finalizarTurno(kmFinal,ganancia){return finalizarActividad({kmFinal,income:ganancia});}
export function registrarFondoJaimau(monto){const s=legacySource('jaimau');if(!s)throw new Error('FUENTE_NO_ENCONTRADA');return registrarFondoFuente(s.id,monto,'Depósito de su Empresa');}
export function saldoCombustibleEmpresa(){const s=legacySource('jaimau')||store.workSources.find(x=>x.fuelPayer==='company');return s?saldoFondoFuente(s.id):{depositado:0,utilizado:0,disponible:0};}
export function registrarGasolina(litros,costo,km,pagador=null,gasolinera=''){
  const active=store.activeActivity?fuenteById(store.activeActivity.sourceId):null;
  let source=active;
  if(!source&&pagador==='empresa')source=store.workSources.find(s=>s.fuelPayer==='company');
  if(!source&&pagador==='personal')source=store.workSources.find(s=>s.kind==='gig')||null;
  return registrarCombustible({litros,costo,km,sourceId:source?.id||null,payer:pagador==='empresa'?'company':pagador==='personal'?'personal':null,gasolinera});
}
export function registrarPagoJaimau(monto,fecha=Date.now()){const s=legacySource('jaimau');if(!s)throw new Error('FUENTE_NO_ENCONTRADA');return registrarPagoFuente(s.id,monto,fecha);}

export function nuevoGasto(desc,monto,categoria,frecuencia){
  const d=requireText(desc),m=requirePositive(monto),id=uuid();
  if(frecuencia!=='Unico'||categoria==='Ahorro')store.gastosFijosMensuales.push({id,desc:d,monto:m,categoria,frecuencia});
  if(frecuencia==='Unico'&&categoria!=='Ahorro')store.movimientos.push({id,fecha:new Date().toISOString(),tipo:'gasto',desc:d,monto:m,categoria,accountId:PERSONAL_ACCOUNT_ID,affectsPersonal:true});
  return commit();
}
export function nuevaDeuda(desc,total,cuota,frecuencia,diaPago){const d=requireText(desc),t=requirePositive(total,'TOTAL_INVALIDO'),c=requirePositive(cuota,'CUOTA_INVALIDA');store.deudas.push({id:uuid(),desc:d,montoTotal:t,montoCuota:c,frecuencia,diaPago,saldo:t,creadaEn:new Date().toISOString()});return commit();}
export function abonarDeuda(id){const d=store.deudas.find(x=>x.id===id);if(!d)return store;const p=Math.min(safeFloat(d.montoCuota),safeFloat(d.saldo));if(!(p>0))throw new Error('CUOTA_INVALIDA');d.saldo=Math.max(0,safeFloat(d.saldo)-p);const s=store.wallet.sobres.find(x=>x.refId===id);if(s)s.acumulado=0;store.movimientos.push({id:uuid(),fecha:new Date().toISOString(),tipo:'gasto',desc:`Abono: ${d.desc}`,monto:p,categoria:'Deuda',accountId:PERSONAL_ACCOUNT_ID,affectsPersonal:true});return commit();}
export function pagarRecurrente(id){const g=store.gastosFijosMensuales.find(x=>x.id===id);if(!g)return store;const monto=requirePositive(g.monto);store.movimientos.push({id:uuid(),fecha:new Date().toISOString(),tipo:'gasto',desc:g.desc,monto,categoria:g.categoria,accountId:PERSONAL_ACCOUNT_ID,affectsPersonal:true});const s=store.wallet.sobres.find(x=>x.refId===id);if(s)s.acumulado=Math.max(0,safeFloat(s.acumulado)-monto);return commit();}
export function nuevaMetaAhorro(desc,monto){return nuevoGasto(desc,monto,'Ahorro','Unico');}
export function abonarAhorro(id,monto){const s=store.wallet.sobres.find(x=>x.id===id);if(!s)return store;const m=requirePositive(monto);s.acumulado+=m;store.movimientos.push({id:uuid(),fecha:new Date().toISOString(),tipo:'gasto',desc:`Abono: ${s.desc}`,monto:m,categoria:'Ahorro',accountId:PERSONAL_ACCOUNT_ID,affectsPersonal:true});return commit();}
export function configurarKM(km){const k=safeFloat(km);if(k<=0)throw new Error('KM_INVALIDO');store.parametros.ultimoKM=k;store.parametros.kmInicialConfigurado=true;return commit();}
export function saldoInicial(monto){const m=safeFloat(monto);if(m<0)throw new Error('SALDO_INVALIDO');store.movimientos.push({id:uuid(),fecha:new Date().toISOString(),tipo:'ingreso',desc:'Saldo inicial',monto:m,categoria:'Sistema',accountId:PERSONAL_ACCOUNT_ID,affectsPersonal:true});store.parametros.saldoInicialConfigurado=true;return commit();}

export function crearIngresoFijo(config){
  const nombre=requireText(config?.nombre,'NOMBRE_INVALIDO');
  if(/^jaimau(\s*\/.*)?$/i.test(nombre))throw new Error('INGRESO_RESERVADO');
  const frecuencia=config?.frecuencia;let pagos=[];
  if(frecuencia==='Semanal')pagos=[{id:uuid(),monto:0,diaSemana:String(config.dia1)}];
  else if(frecuencia==='Quincenal')pagos=[{id:uuid(),monto:0,diaMes:String(config.dia1||15)},{id:uuid(),monto:0,diaMes:config.dia2==='fin_mes'?'fin_mes':String(config.dia2)}];
  else if(frecuencia==='Mensual')pagos=[{id:uuid(),monto:0,diaMes:String(config.dia1)}];
  else throw new Error('FRECUENCIA_INVALIDA');
  store.ingresosFijos.push({id:uuid(),nombre,frecuencia,pagos,activo:true});saveData();return store;
}
export function registrarCobroFijo(id,pagoId,monto){
  const f=store.ingresosFijos.find(x=>x.id===id&&x.activo);if(!f)throw new Error('INGRESO_NO_ENCONTRADO');
  const p=f.pagos?.find(x=>x.id===pagoId);if(!p)throw new Error('PAGO_NO_ENCONTRADO');
  const m=requirePositive(monto),now=new Date(),periodo=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  if(store.movimientos.some(x=>x.tipo==='ingreso'&&x.refId===f.id&&x.pagoId===p.id&&x.periodo===periodo))throw new Error('COBRO_DUPLICADO');
  p.monto=m;p.ultimoCobro={monto:m,fecha:now.toISOString(),periodo};
  store.movimientos.push({id:uuid(),fecha:now.toISOString(),tipo:'ingreso',desc:`Ingreso fijo: ${f.nombre}`,monto:m,categoria:'Trabajo',fuente:'fijo',refId:f.id,pagoId:p.id,periodo,accountId:PERSONAL_ACCOUNT_ID,affectsPersonal:true});
  return commit();
}

/* Negocio / costeo: capacidades reutilizables; la UI se muestra solo si el perfil las activa. */
export function crearIngrediente(nombre,unidad,costoUnidad){
  const item={id:uuid(),name:requireText(nombre,'NOMBRE_INVALIDO'),unit:requireText(unidad||'unidad'),costPerUnit:requirePositive(costoUnidad)};
  store.business.ingredients.push(item);return commit();
}
export function actualizarCostoIngrediente(id,costoUnidad){const item=store.business.ingredients.find(x=>x.id===id);if(!item)throw new Error('INGREDIENTE_NO_ENCONTRADO');item.costPerUnit=requirePositive(costoUnidad);return commit();}
export function crearProducto(nombre,precioVenta){const p={id:uuid(),name:requireText(nombre,'NOMBRE_INVALIDO'),salePrice:requirePositive(precioVenta),recipe:[],active:true};store.business.products.push(p);return commit();}
export function agregarIngredienteProducto(productId,ingredientId,cantidad){const p=store.business.products.find(x=>x.id===productId),i=store.business.ingredients.find(x=>x.id===ingredientId);if(!p||!i)throw new Error('RECETA_INVALIDA');const q=requirePositive(cantidad,'CANTIDAD_INVALIDA');const existing=p.recipe.find(x=>x.ingredientId===ingredientId);if(existing)existing.qty=q;else p.recipe.push({ingredientId,qty:q});return commit();}
export function costoProducto(productId){const p=store.business.products.find(x=>x.id===productId);if(!p)return 0;return p.recipe.reduce((sum,r)=>sum+safeFloat(r.qty)*safeFloat(store.business.ingredients.find(i=>i.id===r.ingredientId)?.costPerUnit),0);}
export function registrarVentaProducto(productId,cantidad=1,sourceId=null){const p=store.business.products.find(x=>x.id===productId&&x.active);if(!p)throw new Error('PRODUCTO_NO_ENCONTRADO');const q=requirePositive(cantidad,'CANTIDAD_INVALIDA'),source=fuenteById(sourceId)||store.workSources.find(s=>s.kind==='business');const total=safeFloat(p.salePrice)*q,fecha=new Date().toISOString();store.business.sales.push({id:uuid(),fecha,productId:p.id,qty:q,total,sourceId:source?.id||null,unitCost:costoProducto(p.id)});store.movimientos.push({id:uuid(),fecha,tipo:'ingreso',desc:`Venta · ${p.name}`,monto:total,categoria:'Ventas',sourceId:source?.id||null,fuente:source?.id||'business',accountId:PERSONAL_ACCOUNT_ID,affectsPersonal:true});return commit();}

export function restaurar(json){
  let x;try{x=JSON.parse(json);}catch{throw new Error('BACKUP_INVALIDO');}
  if(!x||typeof x!=='object'||Array.isArray(x))throw new Error('BACKUP_INVALIDO');
  const hasKnownData=['movimientos','turnos','deudas','wallet','parametros','ingresosFijos','profile','workSources'].some(k=>Object.prototype.hasOwnProperty.call(x,k));
  if(!hasKnownData)throw new Error('BACKUP_INVALIDO');
  const sources=migrateWorkSources(x),profile=migrateProfile(x,sources),accounts=migrateAccounts(x,sources);
  store={
    ...structuredClone(INITIAL_STATE),...x,profile,workSources:sources,accounts,
    assets:Array.isArray(x.assets)?x.assets:[],
    parametros:{...INITIAL_STATE.parametros,...(x.parametros||{})},wallet:{...INITIAL_STATE.wallet,...(x.wallet||{})},
    categoriasPersonalizadas:{...INITIAL_STATE.categoriasPersonalizadas,...(x.categoriasPersonalizadas||{})},
    ingresosFijos:migrateFixedIncome(x.ingresosFijos),turnos:migrateTurns(x.turnos,sources),movimientos:migrateMovements(x.movimientos),
    fondosCombustibleEmpresa:Array.isArray(x.fondosCombustibleEmpresa)?x.fondosCombustibleEmpresa:[],business:normalizeBusiness(x.business),
    activeActivity:x.activeActivity||x.turnoActivo||null,turnoActivo:x.turnoActivo||x.activeActivity||null
  };
  return commit();
}
