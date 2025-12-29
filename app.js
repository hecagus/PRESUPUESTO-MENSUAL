/* =============================================================
   APP.JS - V8.7.1 (REFACTOR SEMÁNTICO - MORA VS CICLO)
   ============================================================= */

/* -------------------------------------------------------------
   SECCIÓN 1: CONFIGURACIÓN
   ------------------------------------------------------------- */
const STORAGE_KEY = "moto_finanzas_vFinal";
const LEGACY_KEYS = ["moto_finanzas_v3", "moto_finanzas", "app_moto_data"];
const SCHEMA_VERSION = 8.71;

const FRECUENCIAS = { 'Diario': 1, 'Semanal': 7, 'Quincenal': 15, 'Mensual': 30, 'Bimestral': 60, 'Anual': 365, 'Unico': 0 };
const MAPA_DIAS = { 1:1, 2:2, 3:3, 4:4, 5:5, 6:6, 0:7 }; 
const DIAS_SEMANA = [
    {val:"", txt:"Seleccionar..."}, {val:"1", txt:"Lunes"}, {val:"2", txt:"Martes"},
    {val:"3", txt:"Miércoles"}, {val:"4", txt:"Jueves"}, {val:"5", txt:"Viernes"},
    {val:"6", txt:"Sábado"}, {val:"0", txt:"Domingo"}
];

const CATEGORIAS_BASE = {
    operativo: ["Gasolina", "Mantenimiento", "Reparación", "Equipo", "Seguro"],
    hogar: ["Renta", "Comida", "Servicios", "Internet", "Salud", "Deudas", "Otro"]
};

// Utils
const $ = id => document.getElementById(id);
const safeFloat = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const fmtMoney = n => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(safeFloat(n));
const uuid = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

/* -------------------------------------------------------------
   SECCIÓN 2: ESTADO Y RECUPERACIÓN
   ------------------------------------------------------------- */
const INITIAL_STATE = {
    schemaVersion: SCHEMA_VERSION,
    turnos: [], movimientos: [], cargasCombustible: [], deudas: [], gastosFijosMensuales: [],
    wallet: { saldo: 0, sobres: [] },
    parametros: { 
        ultimoKM: 0, 
        costoPorKm: 0, 
        metaDiaria: 0, 
        metaBase: 0, 
        deficitTotal: 0,
        kmInicialConfigurado: false, 
        saldoInicialConfigurado: false 
    },
    categoriasPersonalizadas: { operativo: [], hogar: [] },
    turnoActivo: null
};

let store = JSON.parse(JSON.stringify(INITIAL_STATE));

function loadData() {
    console.log("♻️ [V8.7.1] Semantic UI Refactor Loaded.");
    let raw = localStorage.getItem(STORAGE_KEY);
    
    if (!raw || raw.length < 50) {
        for (const key of LEGACY_KEYS) {
            const leg = localStorage.getItem(key);
            if (leg && leg.length > 50) { raw = leg; break; }
        }
    }

    if (raw) {
        try {
            const saved = JSON.parse(raw);
            if(Array.isArray(saved.movimientos)) store.movimientos = saved.movimientos;
            if(Array.isArray(saved.turnos)) store.turnos = saved.turnos;
            if(Array.isArray(saved.cargasCombustible)) store.cargasCombustible = saved.cargasCombustible;
            if(Array.isArray(saved.deudas)) store.deudas = saved.deudas;
            if(Array.isArray(saved.gastosFijosMensuales)) store.gastosFijosMensuales = saved.gastosFijosMensuales;
            
            if(saved.wallet) store.wallet = { ...INITIAL_STATE.wallet, ...saved.wallet };
            if(saved.parametros) store.parametros = { ...INITIAL_STATE.parametros, ...saved.parametros };
            if(saved.turnoActivo) store.turnoActivo = saved.turnoActivo;
            
            if(saved.categoriasPersonalizadas) store.categoriasPersonalizadas = saved.categoriasPersonalizadas;
            else store.categoriasPersonalizadas = { operativo: [], hogar: [] };

            if (store.parametros.ultimoKM > 0) store.parametros.kmInicialConfigurado = true;
            
            sanearDatos();
        } catch (e) { console.error("❌ Error carga:", e); }
    }
}

function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }

function sanearDatos() {
    let saldo = 0;
    store.movimientos.forEach(m => {
        if (m.tipo === 'ingreso') saldo += safeFloat(m.monto);
        if (m.tipo === 'gasto') saldo -= safeFloat(m.monto);
    });
    store.wallet.saldo = saldo;

    const kms = [
        store.parametros.ultimoKM || 0,
        ...store.turnos.map(t => t.kmFinal || 0),
        ...store.cargasCombustible.map(c => c.km || 0)
    ];
    store.parametros.ultimoKM = Math.max(...kms);

    if (store.turnoActivo && (!store.turnoActivo.inicio || !Number.isFinite(store.turnoActivo.inicio))) {
        store.turnoActivo = null;
    }

    reconstruirSobres();
    calcularObjetivosYMeta();
    saveData();
}

function reconstruirSobres() {
    const ensureSobre = (refId, tipo, desc, meta, freq, dp) => {
        let s = store.wallet.sobres.find(x => x.refId === refId);
        if (!s) {
            s = { id: uuid(), refId, tipo, desc, acumulado: 0, objetivoHoy: 0 };
            store.wallet.sobres.push(s);
        }
        s.meta = safeFloat(meta); s.frecuencia = freq; s.desc = desc; 
        if(dp) s.diaPago = dp;
    };
    store.deudas.forEach(d => { if(d.saldo > 0) ensureSobre(d.id, 'deuda', d.desc, d.montoCuota, d.frecuencia, d.diaPago); });
    store.gastosFijosMensuales.forEach(g => ensureSobre(g.id, 'gasto', g.desc, g.monto, g.frecuencia));
}

// LÓGICA V8.6 INTACTA - CÁLCULOS FINANCIEROS SAGRADOS
function calcularObjetivosYMeta() {
    const fechaHoy = new Date();
    const hoyIdx = MAPA_DIAS[fechaHoy.getDay()];
    const diaMes = fechaHoy.getDate();
    const fechaHoyStr = fechaHoy.toDateString();
    
    let metaEstaticaBase = 0;
    
    store.deudas.forEach(d => {
        if(d.saldo <= 0) return;
        let cuotaDiaria = 0;
        if(d.frecuencia === 'Semanal') cuotaDiaria = safeFloat(d.montoCuota) / 7;
        else if(d.frecuencia === 'Mensual') cuotaDiaria = safeFloat(d.montoCuota) / 30;
        else if(d.frecuencia === 'Diario') cuotaDiaria = safeFloat(d.montoCuota);
        metaEstaticaBase += cuotaDiaria;
    });

    store.gastosFijosMensuales.forEach(g => {
        let cuotaDiaria = 0;
        if(g.frecuencia === 'Diario') cuotaDiaria = safeFloat(g.monto);
        else if(g.frecuencia === 'Semanal') cuotaDiaria = safeFloat(g.monto) / 7;
        else if(g.frecuencia === 'Mensual') cuotaDiaria = safeFloat(g.monto) / 30;
        metaEstaticaBase += cuotaDiaria;
    });
    
    const movimientosHoy = store.movimientos.filter(m => new Date(m.fecha).toDateString() === fechaHoyStr);
    let deficitAcumulado = 0;

    store.wallet.sobres.forEach(s => {
        s.pagadoHoy = false;
        let yaPagado = false;

        if (s.tipo === 'deuda') {
            yaPagado = movimientosHoy.some(m => m.tipo === 'gasto' && m.desc === `Abono: ${s.desc}`);
        } else {
            yaPagado = movimientosHoy.some(m => m.tipo === 'gasto' && m.desc === s.desc);
        }

        let idealTeorico = 0;
        
        if (s.frecuencia === 'Diario') {
            idealTeorico = s.meta;
        } else if (s.frecuencia === 'Semanal') {
            const diaPago = parseInt(s.diaPago) || 7; 
            let diasTranscurridos = 0;
            if (hoyIdx === diaPago) diasTranscurridos = 7; 
            else if (hoyIdx > diaPago) diasTranscurridos = hoyIdx - diaPago;
            else diasTranscurridos = (7 - diaPago) + hoyIdx;
            
            const cuotaDiaria = s.meta / 7;
            idealTeorico = cuotaDiaria * diasTranscurridos;
        } else if (s.frecuencia === 'Mensual') {
             idealTeorico = (s.meta / 30) * diaMes;
        }
        
        if (yaPagado) {
            s.pagadoHoy = true;
            if (s.frecuencia === 'Diario') {
                s.objetivoHoy = 0;
            } else {
                s.objetivoHoy = idealTeorico;
            }
        } else {
            s.objetivoHoy = Math.min(idealTeorico, s.meta);
        }
        
        if (s.frecuencia !== 'Diario') {
            if (s.acumulado < s.objetivoHoy) {
                deficitAcumulado += (s.objetivoHoy - s.acumulado);
            }
        }
    });

    store.parametros.deficitTotal = deficitAcumulado;
    store.parametros.metaBase = metaEstaticaBase + (120 * safeFloat(store.parametros.costoPorKm));
    store.parametros.metaDiaria = store.parametros.metaBase + deficitAcumulado;
                                                              }
/* -------------------------------------------------------------
   SECCIÓN 3: ACCIONES
   ------------------------------------------------------------- */
function actionFinalizarTurno(kmFinal, ganancia) {
    const kF = safeFloat(kmFinal);
    if (kF < store.parametros.ultimoKM) return alert(`⛔ Error: KM actual es ${store.parametros.ultimoKM}. No puedes bajarlo.`);
    
    const fin = Date.now();
    const inicio = (store.turnoActivo && store.turnoActivo.inicio) ? store.turnoActivo.inicio : fin;
    const kmIni = (store.turnoActivo && store.turnoActivo.kmInicial) ? store.turnoActivo.kmInicial : store.parametros.ultimoKM;

    const duracionMin = (fin - inicio) / 60000;
    const duracionHoras = duracionMin / 60;

    const nuevoTurno = {
        id: uuid(),
        inicio: inicio,
        fin: fin,
        fecha: new Date(fin).toISOString(),
        duracionMin: duracionMin,
        duracionHoras: duracionHoras,
        ganancia: safeFloat(ganancia),
        kmInicial: kmIni,
        kmFinal: kF,
        kmRecorrido: kF - kmIni
    };

    store.turnos.push(nuevoTurno);
    store.movimientos.push({ id: uuid(), fecha: new Date().toISOString(), tipo: 'ingreso', desc: 'Turno Finalizado', monto: safeFloat(ganancia) });
    store.parametros.ultimoKM = kF; 
    store.turnoActivo = null; 
    sanearDatos(); renderAdmin();
}

function actionGasolina(l, c, k) {
    const km = safeFloat(k);
    if(km < store.parametros.ultimoKM && km > 0) return alert("⛔ KM inválido. No puedes bajar el kilometraje.");
    
    store.cargasCombustible.push({ id: uuid(), fecha: new Date().toISOString(), litros: l, costo: c, km: km });
    store.movimientos.push({ id: uuid(), fecha: new Date().toISOString(), tipo: 'gasto', desc: '⛽ Gasolina', monto: safeFloat(c), categoria: 'Operativo' });
    if(km > store.parametros.ultimoKM) store.parametros.ultimoKM = km;
    sanearDatos(); alert("✅ Registrado");
}

function actionNuevoGasto(desc, monto, cat, freq) {
    const id = uuid();
    if(freq !== 'Unico') store.gastosFijosMensuales.push({ id, desc, monto, categoria: cat, frecuencia: freq });
    store.movimientos.push({ id, fecha: new Date().toISOString(), tipo: 'gasto', desc, monto, categoria: cat });
    sanearDatos();
}

function actionNuevaDeuda(desc, total, cuota, freq, dp) {
    store.deudas.push({ id: uuid(), desc, montoTotal: total, montoCuota: cuota, frecuencia: freq, diaPago: dp, saldo: total });
    sanearDatos();
    alert("✅ Deuda creada");
}

function actionAbonarDeuda(id) {
    const d = store.deudas.find(x => x.id === id); if(!d) return alert("Error");
    d.saldo -= d.montoCuota; if(d.saldo < 0) d.saldo = 0;
    const s = store.wallet.sobres.find(x => x.refId === id); if(s) s.acumulado = 0;
    store.movimientos.push({ id: uuid(), fecha: new Date().toISOString(), tipo: 'gasto', desc: `Abono: ${d.desc}`, monto: d.montoCuota, categoria: 'Deuda' });
    sanearDatos();
    alert("✅ Abono registrado");
    renderAdmin();
}

function actionPagarRecurrente(id) {
    const gf = store.gastosFijosMensuales.find(x => x.id === id); if(!gf) return;
    store.movimientos.push({ id: uuid(), fecha: new Date().toISOString(), tipo: 'gasto', desc: gf.desc, monto: gf.monto, categoria: gf.categoria });
    const s = store.wallet.sobres.find(x => x.refId === id);
    if(s) { s.acumulado -= gf.monto; if(s.acumulado < 0) s.acumulado = 0; }
    sanearDatos(); alert("✅ Pagado");
}

function actionConfigurarKM(nuevoKM) {
    if(store.parametros.kmInicialConfigurado || store.parametros.ultimoKM > 0) return alert("⛔ ACCIÓN DENEGADA. El kilometraje ya existe.");
    const km = safeFloat(nuevoKM); if(km <= 0) return alert("❌ El kilometraje debe ser mayor a 0.");
    store.parametros.ultimoKM = km; store.parametros.kmInicialConfigurado = true;
    saveData(); renderAdmin(); alert("✅ Kilometraje base establecido. Modo automático activado.");
}

function actionSaldoInicial(monto) {
    if(store.parametros.saldoInicialConfigurado) return alert("⛔ ACCIÓN DENEGADA. El saldo inicial ya fue configurado.");
    const inicial = safeFloat(monto); if(inicial < 0) return alert("❌ El saldo no puede ser negativo.");
    store.movimientos.push({ id: uuid(), fecha: new Date().toISOString(), tipo: 'ingreso', desc: 'Saldo Inicial', monto: inicial, categoria: 'Sistema' });
    store.parametros.saldoInicialConfigurado = true;
    sanearDatos(); renderAdmin(); alert("✅ Capital inicial registrado. Billetera activada.");
}
/* -------------------------------------------------------------
   SECCIÓN 4: RENDERIZADO (UI V8.7.1 - MODELO MENTAL CORRECTO)
   ------------------------------------------------------------- */
const Modal = {
    show: (t, inputs, cb) => {
        const m = $('appModal'), b = $('modalBody'); $('modalTitle').innerText = t; b.innerHTML = '';
        inputs.forEach(f => {
            const d = document.createElement('div');
            d.innerHTML = `<label style="display:block;font-size:0.8rem;color:#666;margin-top:5px">${f.label}</label>`;
            const i = document.createElement(f.type==='select'?'select':'input');
            i.className = 'input-control'; i.dataset.k = f.key;
            if(f.type==='select') f.options.forEach(o => { const opt=document.createElement('option'); opt.value=o.val||o.value; opt.text=o.txt||o.text; i.add(opt); });
            else i.type = f.type || 'text';
            d.appendChild(i); b.appendChild(d);
        });
        $('modalConfirm').onclick = () => {
            const data = {}; b.querySelectorAll('.input-control').forEach(el => data[el.dataset.k] = el.value);
            cb(data); m.style.display='none';
        };
        $('modalCancel').onclick = () => m.style.display='none'; m.style.display='flex';
    }
};

function renderIndex() {
    if (!$('resGananciaBruta')) return;
    const hoy = new Date().toDateString();
    const gan = store.turnos.filter(t => new Date(t.fecha).toDateString() === hoy).reduce((a, b) => a + b.ganancia, 0);
    $('resGananciaBruta').innerText = fmtMoney(gan);

    // 1. ANÁLISIS DE CAJA REAL
    const saldo = store.wallet.saldo;
    
    // 2. ANÁLISIS ESTRUCTURAL (¿Hay mora real o solo ciclo?)
    let moraReal = 0;
    let obligacionesHoy = 0; // Suma de lo que el sistema pide HOY

    const hoyIdx = MAPA_DIAS[new Date().getDay()];
    const diaMes = new Date().getDate();

    store.wallet.sobres.forEach(s => {
        // Resguardado por estructura: sumamos el objetivoHoy
        if (!s.pagadoHoy) {
            obligacionesHoy += s.objetivoHoy;
        }

        // Detección de Mora Real (Fix V8.7.1)
        if (s.frecuencia !== 'Diario') {
            const diaPago = parseInt(s.diaPago || 7);
            let cicloVencido = false;

            if (s.frecuencia === 'Semanal') cicloVencido = (hoyIdx > diaPago);
            else if (s.frecuencia === 'Mensual') cicloVencido = (diaMes > diaPago);

            if (cicloVencido && s.acumulado < s.meta) {
                moraReal += (s.meta - s.acumulado); // Falta total de ciclo vencido
            }
        }
    });

    const disponible = saldo - obligacionesHoy;

    let estadoHTML = '';
    
    // LÓGICA DE ESTADOS DEL PANEL (PRIORIDAD: CAJA > MORA > ESTRUCTURA)
    
    // CASO 1: FALTA DINERO FÍSICO (ROJO CRÍTICO)
    if (disponible < -5) {
        estadoHTML = `
        <div class="card" style="border-left: 4px solid var(--danger); background:#fef2f2;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="color:#991b1b;">📉 Déficit de Caja</strong>
                <div style="font-weight:bold; color:#7f1d1d;">${fmtMoney(Math.abs(disponible))}</div>
            </div>
            <small style="color:#7f1d1d;">Falta efectivo para cubrir estructura.</small>
        </div>`;
    } 
    // CASO 2: HAY MORA REAL VENCIDA (ROJO ESTRUCTURAL)
    else if (moraReal > 0) {
        estadoHTML = `
        <div class="card" style="border-left: 4px solid var(--danger); background:#fff1f2;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="color:#be123c;">⚠️ Mora Vencida</strong>
                <div style="font-weight:bold; color:#be123c;">${fmtMoney(moraReal)}</div>
            </div>
            <small style="color:#9f1239;">Obligaciones expiradas sin cubrir.</small>
        </div>`;
    } 
    // CASO 3: CICLO EN CURSO (VERDE OPERATIVO)
    else {
        estadoHTML = `
        <div class="card" style="border-left: 4px solid var(--success); background:#f0fdf4;">
            <strong style="color:#166534;">✨ Operativamente Activo</strong>
            <small style="color:#14532d; display:block;">Ciclos vigentes en orden.</small>
        </div>`;
    }

    const html = `
    <div class="card" style="padding:20px; text-align:center;">
        <small style="color:var(--text-sec); text-transform:uppercase; font-size:0.75rem; letter-spacing:1px;">Saldo Real en Caja</small>
        <div style="font-size:2.8rem; font-weight:800; color:var(--text-main); line-height:1.2;">${fmtMoney(saldo)}</div>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:15px; border-top:1px solid #f1f5f9; padding-top:10px;">
            <div>
                <small style="color:var(--primary); font-weight:bold;">🔒 Resguardado</small>
                <div style="font-weight:600; font-size:1rem;">${fmtMoney(obligacionesHoy)}</div>
                <small style="font-size:0.7rem; color:#64748b;">(Estructura Hoy)</small>
            </div>
            <div>
                <small style="color:var(--text-sec);">🪙 Disponible</small>
                <div style="font-weight:600; font-size:1rem; color:${disponible>=0?'var(--text-main)':'var(--danger)'}">${fmtMoney(disponible)}</div>
            </div>
        </div>
    </div>

    ${estadoHTML}
    `;
    
    const container = $('resumenHumanoContainer'); if(container) container.innerHTML = html;
}

function renderWallet() {
    if (!$('valWallet')) return;
    const saldo = store.wallet.saldo;
    
    // Header consistente con Panel
    let obligacionesHoy = 0;
    store.wallet.sobres.forEach(s => { if (!s.pagadoHoy) obligacionesHoy += s.objetivoHoy; });
    const disponible = saldo - obligacionesHoy;

    $('valWallet').innerHTML = `
        ${fmtMoney(saldo)}
        <div style="display:flex; justify-content:center; gap:15px; margin-top:5px; font-size:0.85rem;">
            <span style="opacity:0.9">🔒 Estructura: <strong>${fmtMoney(obligacionesHoy)}</strong></span>
            <span style="opacity:0.9">🪙 Disponible: <strong>${fmtMoney(disponible)}</strong></span>
        </div>
    `;
    
    const container = $('sobresContainer'); 
    if(!container) return;
    container.innerHTML = '';
    
    const hoyIdx = MAPA_DIAS[new Date().getDay()];
    const diaMes = new Date().getDate();

    store.wallet.sobres.forEach(s => {
        // 1. Gastos Diarios Pagados (Minimizados)
        if (s.frecuencia === 'Diario' && s.pagadoHoy) {
            container.innerHTML += `
            <div class="card" style="padding:12px 15px; border-left:4px solid var(--success); background:#f8fafc; opacity:0.7;">
                <div style="display:flex; justify-content:space-between; align-items: center;">
                    <span style="color:#64748b;">${s.desc}</span>
                    <span style="font-size:0.8rem; color:var(--success); font-weight:bold;">✔ Cubierto hoy</span>
                </div>
            </div>`;
            return;
        }

        // 2. Análisis de Ciclo vs Mora
        let esMora = false;
        if (s.frecuencia !== 'Diario') {
            const diaPago = parseInt(s.diaPago || 7);
            if (s.frecuencia === 'Semanal') esMora = (hoyIdx > diaPago && s.acumulado < s.meta);
            else if (s.frecuencia === 'Mensual') esMora = (diaMes > diaPago && s.acumulado < s.meta);
        }

        let valorMostrado = s.objetivoHoy > 0 ? s.objetivoHoy : s.meta;
        let valorFisico = s.acumulado;
        
        const pctFisico = Math.min((valorFisico/s.meta)*100, 100); 
        
        let colorEstado = s.tipo==='deuda'?'#dc2626':'#2563eb';
        let mensajeEstado = "";
        
        if (s.frecuencia === 'Diario') {
            mensajeEstado = `<div style="font-size:0.75rem; color:#64748b;">Ciclo diario activo</div>`;
        } else {
            if (esMora) {
                // ROJO: Mora Real
                mensajeEstado = `<div style="font-size:0.75rem; color:var(--danger); font-weight:bold;">⚠️ Atraso Vencido</div>`;
                colorEstado = '#dc2626'; // Forzamos rojo
            } else if (s.acumulado < s.objetivoHoy) {
                // GRIS/AZUL: Ciclo en progreso (Normal)
                mensajeEstado = `<div style="font-size:0.75rem; color:#64748b;">Ciclo en progreso</div>`;
            } else {
                // VERDE: Cubierto
                mensajeEstado = `<div style="font-size:0.75rem; color:var(--success);">Cubierto por tiempo</div>`;
            }
        }

        container.innerHTML += `
        <div class="card" style="padding:15px; border-left:5px solid ${colorEstado}">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px; align-items: flex-start;">
                <div>
                    <strong>${s.desc}</strong>
                    <div style="font-size:0.75rem; color:#666;">Meta Total: ${fmtMoney(s.meta)}</div>
                </div>
                <div style="text-align:right;">
                    <small style="display:block; font-weight:bold; font-size:1.1rem;">${fmtMoney(valorMostrado)}</small>
                    ${mensajeEstado}
                </div>
            </div>
            <div style="height:12px; background:#e2e8f0; border-radius:6px; position:relative; overflow:hidden; margin-top:8px;">
                <div style="width:${pctFisico}%; background:${colorEstado}; height:100%;"></div>
            </div>
            <div style="font-size:0.65rem; color:#94a3b8; text-align:right; margin-top:2px;">Acumulado físico: ${fmtMoney(valorFisico)}</div>
        </div>`;
    });
                       }

function renderHistorial() {
    if (!$('tablaBody')) return;
    if (!store.movimientos || store.movimientos.length === 0) {
         $('tablaBody').innerHTML = '<tr><td colspan="3" class="text-center" style="padding:20px;">Sin datos recientes</td></tr>';
         return;
    }
    const movs = [...store.movimientos].sort((a,b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 50);
    $('tablaBody').innerHTML = movs.map(m => `
        <tr>
            <td style="color:#64748b; font-size:0.8rem;">${new Date(m.fecha).toLocaleDateString('es-MX', {month:'short', day:'numeric'})}</td>
            <td><strong>${m.desc}</strong><br><small>${m.categoria||''}</small></td>
            <td style="text-align:right; font-weight:bold; color:${m.tipo==='ingreso'?'#16a34a':'#dc2626'}">
                ${m.tipo==='ingreso'?'+':'-'}${fmtMoney(m.monto)}
            </td>
        </tr>
    `).join('');
}

function renderAdmin() {
    if (!$('kmActual')) return;
    
    $('kmActual').innerText = `${store.parametros.ultimoKM} km`;
    const btnKM = $('btnConfigKM');
    
    if (store.parametros.kmInicialConfigurado || store.parametros.ultimoKM > 0) {
        btnKM.innerText = "🔒 Auto"; btnKM.className = "btn btn-outline"; btnKM.style.opacity = "0.7";
        btnKM.onclick = () => alert("🔒 El kilometraje es automático. Se actualiza con Turnos y Gasolina.");
    } else {
        btnKM.innerText = "🔓 Configurar"; btnKM.className = "btn btn-primary"; btnKM.style.opacity = "1";
        btnKM.onclick = () => Modal.show("Configurar KM Inicial", [{label:"Kilometraje Real Tablero",key:"km",type:"number"}], d => actionConfigurarKM(d.km));
    }

    const saldo = store.wallet.saldo;
    let obligacionesHoy = 0;
    store.wallet.sobres.forEach(s => { if (!s.pagadoHoy) obligacionesHoy += s.objetivoHoy; });
    
    if($('valSaldoAdmin')) $('valSaldoAdmin').innerText = fmtMoney(saldo);
    if($('valDesgloseAdmin')) $('valDesgloseAdmin').innerText = `(${fmtMoney(obligacionesHoy)} estructura hoy)`;

    const btnSaldo = $('btnConfigSaldo');
    if (store.parametros.saldoInicialConfigurado) {
        btnSaldo.innerText = "🔒 Auto"; btnSaldo.className = "btn btn-outline"; btnSaldo.style.opacity = "0.7";
        btnSaldo.onclick = () => alert("🔒 El saldo es automático. Se actualiza con tus operaciones diarias.");
    } else {
        btnSaldo.innerText = "🔓 Registrar capital inicial"; btnSaldo.className = "btn btn-primary"; btnSaldo.style.opacity = "1";
        btnSaldo.onclick = () => Modal.show("Capital Inicial", [{label:"¿Cuánto dinero tienes actualmente?",key:"s",type:"number"}], d => actionSaldoInicial(d.s));
    }

    // UI ADMIN: COPY NEUTRAL
    const metaValor = $('metaDiariaValor');
    if (metaValor) {
        const meta = safeFloat(store.parametros.metaDiaria);
        metaValor.innerText = fmtMoney(meta);
        
        const cardTitle = metaValor.previousElementSibling;
        if(cardTitle) cardTitle.innerText = "🎯 Objetivo Producción Hoy";

        const descDiv = metaValor.nextElementSibling;
        if(descDiv && descDiv.className === 'hero-desc') {
            const base = safeFloat(store.parametros.metaBase);
            // Cálculo local de Mora para UI Admin
            let moraReal = 0;
            const hoyIdx = MAPA_DIAS[new Date().getDay()];
            const diaMes = new Date().getDate();
            store.wallet.sobres.forEach(s => {
                if(s.frecuencia !== 'Diario') {
                    const diaPago = parseInt(s.diaPago || 7);
                    let cv = (s.frecuencia === 'Semanal') ? (hoyIdx > diaPago) : (diaMes > diaPago);
                    if(cv && s.acumulado < s.meta) moraReal += (s.meta - s.acumulado);
                }
            });

            let extraText = "";
            if (moraReal > 0) {
                extraText = `+ Mora Vencida: <span style="color:#ef4444; font-weight:bold;">${fmtMoney(moraReal)}</span>`;
            } else {
                extraText = "+ Ciclo vigente";
            }
            descDiv.innerHTML = `Base Operativa: ${fmtMoney(base)} <br> ${extraText}`;
        }
    }

    const activo = !!store.turnoActivo;
    const btnIni = $('btnTurnoIniciar');
    const btnFin = $('btnTurnoFinalizar');
    
    if(activo) {
        $('turnoEstado').innerHTML = '<span class="text-green">🟢 EN CURSO</span>';
        btnIni.classList.add('hidden');
        btnFin.classList.remove('hidden');
        if(!window.timerInterval) {
            window.timerInterval = setInterval(() => {
                if(!store.turnoActivo) return;
                const diff = Date.now() - store.turnoActivo.inicio;
                const h = Math.floor(diff/3600000);
                const m = Math.floor((diff%3600000)/60000);
                if($('turnoTimer')) $('turnoTimer').innerText = `${h}h ${m}m`;
            }, 1000);
        }
        if(btnFin.offsetParent === null) $('turnoEstado').innerHTML += ` <a href="#" onclick="actionFinalizarTurno(prompt('KM'), prompt('$$'))" style="color:red; font-size:0.8rem">[FORZAR]</a>`;
    } else {
        $('turnoEstado').innerHTML = '🔴 Detenido';
        if($('turnoTimer')) $('turnoTimer').innerText = "00:00:00";
        btnIni.classList.remove('hidden');
        btnFin.classList.add('hidden');
        if(window.timerInterval) { clearInterval(window.timerInterval); window.timerInterval = null; }
    }

    if(!document.getElementById('zoneRecurrentes') && $('btnGastoHogar')) {
        const div = document.createElement('div'); div.id = 'zoneRecurrentes';
        div.className = 'card'; div.style.padding = '10px'; div.style.background = '#f8fafc';
        div.innerHTML = `<h4 style="font-size:0.9rem; color:#64748b; margin-bottom:5px;">Pagar Recurrente</h4><div style="display:flex; gap:5px;"><select id="selRecurrente" class="input-control" style="margin:0"></select><button id="btnDoPay" class="btn btn-success" style="width:auto">OK</button></div>`;
        $('btnGastoHogar').parentElement.parentElement.insertBefore(div, $('btnGastoHogar').parentElement);
        div.querySelector('#btnDoPay').onclick = () => { const v=$('selRecurrente').value; if(v && confirm("¿Pagar?")) actionPagarRecurrente(v); };
    }
    const selR = $('selRecurrente');
    if(selR) {
        selR.innerHTML = '<option value="">Seleccionar...</option>';
        store.gastosFijosMensuales.forEach(g => { const opt = document.createElement('option'); opt.value = g.id; opt.innerText = `${g.desc} (${fmtMoney(g.monto)})`; selR.add(opt); });
    }

    const ul = $('listaDeudasAdmin');
    if(ul) {
        ul.innerHTML = store.deudas.map(d => `<li style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #eee;"><span>${d.desc}</span><span style="font-weight:bold; color:${d.saldo>0?'var(--danger)':'var(--success)'}">${fmtMoney(d.saldo)}</span></li>`).join('');
    }
    const selD = $('abonoDeudaSelect');
    if(selD) {
        selD.innerHTML = '<option value="">Seleccionar...</option>';
        store.deudas.forEach(d => {
            if(d.saldo < 1) return;
            const opt = document.createElement('option'); opt.value = d.id; opt.innerText = `${d.desc} (${fmtMoney(d.montoCuota)})`;
            selD.add(opt);
        });
    }
}

function renderStats() {
    if (!document.getElementById('statIngresoHora')) return;

    const hoy = new Date();
    const limite = new Date();
    limite.setDate(hoy.getDate() - 7);

    const turnosRecientes = store.turnos.filter(t => new Date(t.fecha) >= limite);
    
    let totalIngresos = 0;
    let totalHoras = 0;
    const diasUnicos = new Set();

    turnosRecientes.forEach(t => {
        totalIngresos += safeFloat(t.ganancia);
        let horas = 0;
        if (typeof t.duracionHoras === 'number') {
            horas = t.duracionHoras;
        } else {
             const fin = new Date(t.fecha).getTime();
             const inicio = t.inicio ? new Date(t.inicio).getTime() : fin; 
             horas = (fin - inicio) / 3600000;
        }
        totalHoras += horas;
        diasUnicos.add(new Date(t.fecha).toDateString());
    });

    const diasTrabajados = diasUnicos.size;
    const ingresoPromedioHora = totalHoras > 0 ? (totalIngresos / totalHoras) : 0;
    const horasPromedioDia = diasTrabajados > 0 ? (totalHoras / diasTrabajados) : 0;
    const ingresoDiarioProm = diasTrabajados > 0 ? (totalIngresos / diasTrabajados) : 0;
    const metaDiaria = safeFloat(store.parametros.metaDiaria);

    $('statIngresoHora').innerText = totalHoras > 0 ? fmtMoney(ingresoPromedioHora) : "—";
    $('statHorasTotal').innerText = totalHoras.toFixed(1) + "h";
    $('statDiasTrabajados').innerText = diasTrabajados;

    $('statMetaDiaria').innerText = fmtMoney(metaDiaria);
    $('statIngresoDiario').innerText = fmtMoney(ingresoDiarioProm);
    
    const diff = ingresoDiarioProm - metaDiaria;
    const elDiff = $('statDiferencia');
    elDiff.innerText = (diff >= 0 ? "+" : "") + fmtMoney(diff);
    elDiff.style.color = diff >= 0 ? "var(--success)" : "var(--danger)";

    let horasNecesarias = 0;
    let estado = "NEUTRO";
    const elHorasNec = $('statHorasNecesarias');
    
    if (ingresoPromedioHora > 0 && metaDiaria > 0) {
        horasNecesarias = metaDiaria / ingresoPromedioHora;
        elHorasNec.innerText = horasNecesarias.toFixed(1) + "h";
        if (horasNecesarias <= (horasPromedioDia + 1)) { estado = "VERDE"; elHorasNec.style.color = "var(--success)"; }
        else if (horasNecesarias <= 9) { estado = "AMARILLO"; elHorasNec.style.color = "var(--warning)"; }
        else { estado = "ROJO"; elHorasNec.style.color = "var(--danger)"; }
    } else {
        elHorasNec.innerText = "—";
        elHorasNec.style.color = "var(--text-sec)";
        estado = "INVALIDO";
    }
    $('statHorasPromedio').innerText = horasPromedioDia.toFixed(1) + "h";

    const elDiag = $('statsDiagnostico');
    if (estado === "INVALIDO") {
        elDiag.innerText = "Información insuficiente para generar diagnóstico.";
    } else {
        // COPY STATS ACTUALIZADO
        let textoBase = `Con tu ritmo actual, necesitas trabajar aprox. ${horasNecesarias.toFixed(1)}h diarias para cubrir Base Operativa + Ciclos Activos. `;
        if (estado === "VERDE") textoBase += "Vas a buen ritmo.";
        else if (estado === "AMARILLO") textoBase += "Requiere esfuerzo sostenido.";
        else if (estado === "ROJO") textoBase += "Estás debajo del umbral de estructura.";
        elDiag.innerText = textoBase;
    }
}

// CONTEXTO DE PANEL (LIMPIO)
function renderDashboardContext() {
    if (!document.getElementById('uiTurnosHoy')) return;

    const hoyStr = new Date().toDateString();
    const turnosHoy = store.turnos.filter(t => new Date(t.fecha).toDateString() === hoyStr);

    let totalGanancia = 0;
    let totalHoras = 0;

    turnosHoy.forEach(t => {
        totalGanancia += safeFloat(t.ganancia);
        let horas = 0;
        if (typeof t.duracionHoras === 'number') {
            horas = t.duracionHoras;
        } else {
            const fin = new Date(t.fecha).getTime();
            const inicio = t.inicio ? new Date(t.inicio).getTime() : fin;
            horas = (fin - inicio) / 3600000;
        }
        totalHoras += horas;
    });

    $('uiTurnosHoy').innerText = turnosHoy.length;
    $('uiHorasHoy').innerText = totalHoras > 0 ? totalHoras.toFixed(1) + 'h' : '0h';
    $('uiIngresoHoraHoy').innerText = totalHoras > 0 ? fmtMoney(totalGanancia / totalHoras) : '—';
    
    // Eliminamos UI de compromisos en panel para no duplicar información
    const lista = $('uiCompromisos');
    lista.innerHTML = ''; 
    lista.parentElement.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 V8.7.1 FINTECH SEMANTICS UI");
    loadData();
    
    const page = document.body.dataset.page;
    if (page === 'index') {
        renderIndex();
        renderDashboardContext(); 
    }
    if (page === 'wallet') renderWallet();
    if (page === 'historial') renderHistorial();
    if (page === 'stats') renderStats();
    if (page === 'admin') {
        renderAdmin();
        
        $('btnTurnoIniciar').onclick = () => { 
            store.turnoActivo = { 
                inicio: Date.now(),
                kmInicial: store.parametros.ultimoKM 
            }; 
            saveData(); 
            renderAdmin(); 
        };
        
        $('btnTurnoFinalizar').onclick = () => Modal.show("Fin Turno", [{label:"KM Final",key:"k",type:"number"},{label:"Ganancia Total",key:"g",type:"number"}], d => actionFinalizarTurno(d.k, d.g));
        $('btnGasolina').onclick = () => Modal.show("Gasolina", [{label:"Litros",key:"l",type:"number"},{label:"Costo ($)",key:"c",type:"number"},{label:"KM Actual",key:"k",type:"number"}], d => actionGasolina(d.l, d.c, d.k));
        
        const gastoWiz = (g) => {
            const typeKey = g.toLowerCase();
            const customCats = (store.categoriasPersonalizadas && store.categoriasPersonalizadas[typeKey]) ? store.categoriasPersonalizadas[typeKey] : [];
            const allCats = [...CATEGORIAS_BASE[typeKey], ...customCats, "➕ Crear nueva..."];

            Modal.show(`Nuevo ${g}`, [
                {label:"Descripción",key:"d"},
                {label:"Monto",key:"m",type:"number"},
                {label:"Categoría",key:"c",type:"select",options:allCats.map(x=>({val:x,txt:x}))},
                {label:"Frecuencia",key:"f",type:"select",options:Object.keys(FRECUENCIAS).map(x=>({val:x,txt:x}))}
            ], d => {
                let catFinal = d.c;
                if (catFinal === "➕ Crear nueva...") {
                    const nueva = prompt(`Escribe el nombre de la nueva categoría para ${g}:`);
                    if (!nueva || nueva.trim() === "") return alert("Cancelado: Nombre inválido");
                    catFinal = nueva.trim();
                    if (!store.categoriasPersonalizadas) store.categoriasPersonalizadas = { operativo: [], hogar: [] };
                    if (!store.categoriasPersonalizadas[typeKey]) store.categoriasPersonalizadas[typeKey] = [];
                    store.categoriasPersonalizadas[typeKey].push(catFinal);
                    saveData();
                }
                actionNuevoGasto(d.d, d.m, catFinal, d.f);
            });
        };

        $('btnGastoHogar').onclick = () => gastoWiz('Hogar');
        $('btnGastoOperativo').onclick = () => gastoWiz('Operativo');
        
        $('btnDeudaNueva').onclick = () => Modal.show("Nueva Deuda", [
            {label:"Nombre",key:"d"},
            {label:"Total Deuda",key:"t",type:"number"},
            {label:"Cuota Mensual",key:"c",type:"number"},
            {label:"Frecuencia",key:"f",type:"select",options:Object.keys(FRECUENCIAS).map(x=>({val:x,txt:x}))},
            {label:"Día de Pago",key:"dp",type:"select",options:DIAS_SEMANA}
        ], d => actionNuevaDeuda(d.d, d.t, d.c, d.f, d.dp));
        
        $('btnAbonoCuota').onclick = () => { 
            const v = $('abonoDeudaSelect').value; 
            if(!v) return alert("⚠️ Selecciona una deuda");
            if(confirm("¿Confirmar abono de cuota?")) actionAbonarDeuda(v); 
        };

        $('btnExportJSON').onclick = () => navigator.clipboard.writeText(JSON.stringify(store)).then(() => alert("Copiado"));
        $('btnRestoreBackup').onclick = () => Modal.show("Restaurar", [{label:"Pegar JSON",key:"j"}], d => { try { store = {...INITIAL_STATE, ...JSON.parse(d.j)}; sanearDatos(); location.reload(); } catch(e){ alert("JSON Inválido"); } });
    }
});
   
