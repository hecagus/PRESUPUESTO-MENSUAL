 /* =============================================================
   APP.JS - V9.4 (UX & VISUAL STATE PATCH)
   ============================================================= */

/* -------------------------------------------------------------
   SECCIÓN 1: CONFIGURACIÓN
   ------------------------------------------------------------- */
const STORAGE_KEY = "moto_finanzas_vFinal";
const LEGACY_KEYS = ["moto_finanzas_v3", "moto_finanzas", "app_moto_data"];
const SCHEMA_VERSION = 9.4;

const FRECUENCIAS = { 'Diario': 1, 'Semanal': 7, 'Quincenal': 15, 'Mensual': 30, 'Bimestral': 60, 'Anual': 365, 'Unico': 0 };
const MAPA_DIAS = { 1:1, 2:2, 3:3, 4:4, 5:5, 6:6, 0:7 }; 
const DIAS_SEMANA = [
    {val:"", txt:"Seleccionar..."}, {val:"1", txt:"Lunes"}, {val:"2", txt:"Martes"},
    {val:"3", txt:"Miércoles"}, {val:"4", txt:"Jueves"}, {val:"5", txt:"Viernes"},
    {val:"6", txt:"Sábado"}, {val:"0", txt:"Domingo"}
];

const CATEGORIAS_BASE = {
    operativo: ["Gasolina", "Mantenimiento", "Reparación", "Equipo", "Seguro"],
    hogar: ["Renta", "Comida", "Servicios", "Internet", "Salud", "Deudas", "Otro", "Ahorro", "Meta"]
};

// Utils
const $ = id => document.getElementById(id);
const safeFloat = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const fmtMoney = n => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(safeFloat(n));
const uuid = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

/* -------------------------------------------------------------
   SECCIÓN 2: ESTADO Y RECUPERACIÓN (MOTOR V8.8)
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
        moraVencida: 0,
        kmInicialConfigurado: false, 
        saldoInicialConfigurado: false 
    },
    categoriasPersonalizadas: { operativo: [], hogar: [] },
    turnoActivo: null
};

let store = JSON.parse(JSON.stringify(INITIAL_STATE));

function loadData() {
    console.log("♻️ [V9.4] UX Patch Loaded (Engine V8.8).");
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
    const ensureSobre = (refId, tipo, desc, meta, freq, dp, cat) => {
        let s = store.wallet.sobres.find(x => x.refId === refId);
        if (!s) {
            s = { id: uuid(), refId, tipo, desc, acumulado: 0, objetivoHoy: 0 };
            store.wallet.sobres.push(s);
        }
        s.meta = safeFloat(meta); s.frecuencia = freq; s.desc = desc; 
        if(dp) s.diaPago = dp;
        if(cat) s.categoria = cat;
    };
    store.deudas.forEach(d => { if(d.saldo > 0) ensureSobre(d.id, 'deuda', d.desc, d.montoCuota, d.frecuencia, d.diaPago); });
    store.gastosFijosMensuales.forEach(g => ensureSobre(g.id, 'gasto', g.desc, g.monto, g.frecuencia, null, g.categoria));
}

function calcularObjetivosYMeta() {
    const fechaHoy = new Date();
    const hoyIdx = MAPA_DIAS[fechaHoy.getDay()];
    const diaMes = fechaHoy.getDate();
    const fechaHoyStr = fechaHoy.toDateString();
    
    let metaEstaticaBase = 0;
    const sumarCuotaBase = (monto, freq) => {
        if(freq === 'Diario') return safeFloat(monto);
        if(freq === 'Semanal') return safeFloat(monto) / 7;
        if(freq === 'Mensual') return safeFloat(monto) / 30;
        return 0;
    };

    store.deudas.forEach(d => { if(d.saldo > 0) metaEstaticaBase += sumarCuotaBase(d.montoCuota, d.frecuencia); });
    store.gastosFijosMensuales.forEach(g => { 
        if(g.categoria !== 'Ahorro' && g.categoria !== 'Meta') {
            metaEstaticaBase += sumarCuotaBase(g.monto, g.frecuencia); 
        }
    });
    
    const movimientosHoy = store.movimientos.filter(m => new Date(m.fecha).toDateString() === fechaHoyStr);
    
    let deficitTotalTeorico = 0; 
    let moraVencidaReal = 0;     

    store.wallet.sobres.forEach(s => {
        if(s.categoria === 'Ahorro' || s.categoria === 'Meta') return;

        s.pagadoHoy = false;
        let yaPagado = false;

        if (s.tipo === 'deuda') yaPagado = movimientosHoy.some(m => m.tipo === 'gasto' && m.desc === `Abono: ${s.desc}`);
        else yaPagado = movimientosHoy.some(m => m.tipo === 'gasto' && m.desc === s.desc);

        let idealTeorico = 0;
        if (s.frecuencia === 'Diario') idealTeorico = s.meta;
        else if (s.frecuencia === 'Semanal') {
            const diaPago = parseInt(s.diaPago || 7); 
            let diasTranscurridos = (hoyIdx === diaPago) ? 7 : (hoyIdx > diaPago ? hoyIdx - diaPago : (7 - diaPago) + hoyIdx);
            idealTeorico = (s.meta / 7) * diasTranscurridos;
        } else if (s.frecuencia === 'Mensual') idealTeorico = (s.meta / 30) * diaMes;
        
        if (yaPagado) {
            s.pagadoHoy = true;
            s.objetivoHoy = (s.frecuencia === 'Diario') ? 0 : idealTeorico;
        } else {
            s.objetivoHoy = Math.min(idealTeorico, s.meta);
        }
        
        if (s.frecuencia !== 'Diario') {
            if (s.acumulado < s.objetivoHoy) {
                deficitTotalTeorico += (s.objetivoHoy - s.acumulado);
            }
            const diaPago = parseInt(s.diaPago || 7);
            let cicloVencido = false;
            if (s.frecuencia === 'Semanal') cicloVencido = (hoyIdx > diaPago);
            else if (s.frecuencia === 'Mensual') cicloVencido = (diaMes > diaPago);
            
            if (cicloVencido && s.acumulado < s.meta) {
                moraVencidaReal += (s.meta - s.acumulado);
            }
        }
    });

    store.parametros.deficitTotal = deficitTotalTeorico; 
    store.parametros.moraVencida = moraVencidaReal;      
    store.parametros.metaBase = metaEstaticaBase;
    store.parametros.metaDiaria = store.parametros.metaBase + moraVencidaReal;
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
    const kmRecorridos = kF - kmIni;
    
    const duracionMin = (fin - inicio) / 60000;
    const duracionHoras = duracionMin / 60;

    const nuevoTurno = {
        id: uuid(), inicio: inicio, fin: fin, fecha: new Date(fin).toISOString(),
        duracionMin: duracionMin, duracionHoras: duracionHoras,
        ganancia: safeFloat(ganancia), kmInicial: kmIni, kmFinal: kF, kmRecorrido: kmRecorridos
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
    const costoGas = safeFloat(c);

    store.cargasCombustible.push({ id: uuid(), fecha: new Date().toISOString(), litros: l, costo: costoGas, km: km });
    store.movimientos.push({ id: uuid(), fecha: new Date().toISOString(), tipo: 'gasto', desc: '⛽ Gasolina', monto: costoGas, categoria: 'Operativo' });
    
    const sobreGas = store.wallet.sobres.find(s => s.categoria === 'Operativo' && (s.desc.toLowerCase().includes('gas') || s.desc.toLowerCase().includes('combustible')));
    if (sobreGas && sobreGas.acumulado > 0) {
        sobreGas.acumulado -= costoGas;
        if(sobreGas.acumulado < 0) sobreGas.acumulado = 0;
    }

    if(km > store.parametros.ultimoKM) store.parametros.ultimoKM = km;
    sanearDatos(); alert("✅ Registrado");
}

function actionNuevaMetaAhorro(desc, montoObjetivo) {
    actionNuevoGasto(desc, montoObjetivo, 'Ahorro', 'Unico');
}

function actionAbonarAhorro(id, monto) {
    const s = store.wallet.sobres.find(x => x.id === id);
    if(!s) return;
    store.movimientos.push({ 
        id: uuid(), fecha: new Date().toISOString(), tipo: 'gasto', desc: `Ahorro: ${s.desc}`, monto: safeFloat(monto), categoria: 'Ahorro' 
    });
    s.acumulado += safeFloat(monto);
    sanearDatos();
    alert("💎 Ahorro registrado");
}

function actionNuevoGasto(desc, monto, cat, freq) {
    const id = uuid();
    if(freq !== 'Unico' || cat === 'Ahorro') {
        store.gastosFijosMensuales.push({ id, desc, monto, categoria: cat, frecuencia: freq });
    }
    if (freq === 'Unico' && cat !== 'Ahorro') {
        store.movimientos.push({ id, fecha: new Date().toISOString(), tipo: 'gasto', desc, monto, categoria: cat });
    }
    sanearDatos();
}

function actionNuevaDeuda(desc, total, cuota, freq, dp) {
    store.deudas.push({ id: uuid(), desc, montoTotal: total, montoCuota: cuota, frecuencia: freq, diaPago: dp, saldo: total });
    sanearDatos(); alert("✅ Deuda creada");
}

function actionAbonarDeuda(id) {
    const d = store.deudas.find(x => x.id === id); if(!d) return alert("Error");
    d.saldo -= d.montoCuota; if(d.saldo < 0) d.saldo = 0;
    const s = store.wallet.sobres.find(x => x.refId === id); if(s) s.acumulado = 0;
    store.movimientos.push({ id: uuid(), fecha: new Date().toISOString(), tipo: 'gasto', desc: `Abono: ${d.desc}`, monto: d.montoCuota, categoria: 'Deuda' });
    sanearDatos(); alert("✅ Abono registrado"); renderAdmin();
}

function actionPagarRecurrente(id) {
    const gf = store.gastosFijosMensuales.find(x => x.id === id); if(!gf) return;
    store.movimientos.push({ id: uuid(), fecha: new Date().toISOString(), tipo: 'gasto', desc: gf.desc, monto: gf.monto, categoria: gf.categoria });
    const s = store.wallet.sobres.find(x => x.refId === id);
    if(s) { s.acumulado -= gf.monto; if(s.acumulado < 0) s.acumulado = 0; }
    sanearDatos(); alert("✅ Pagado");
}

function actionConfigurarKM(nuevoKM) {
    if(store.parametros.kmInicialConfigurado || store.parametros.ultimoKM > 0) return alert("⛔ ACCIÓN DENEGADA.");
    const km = safeFloat(nuevoKM); if(km <= 0) return alert("❌ Error.");
    store.parametros.ultimoKM = km; store.parametros.kmInicialConfigurado = true;
    saveData(); renderAdmin(); alert("✅ Configurado.");
}

function actionSaldoInicial(monto) {
    if(store.parametros.saldoInicialConfigurado) return alert("⛔ ACCIÓN DENEGADA.");
    const inicial = safeFloat(monto); if(inicial < 0) return alert("❌ Error.");
    store.movimientos.push({ id: uuid(), fecha: new Date().toISOString(), tipo: 'ingreso', desc: 'Saldo Inicial', monto: inicial, categoria: 'Sistema' });
    store.parametros.saldoInicialConfigurado = true;
    sanearDatos(); renderAdmin(); alert("✅ Capital inicial registrado.");
                                        }

/* -------------------------------------------------------------
   SECCIÓN 4: RENDERIZADO (UI V9.4 - UX PATCHED)
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

    const saldo = store.wallet.saldo;
    let obligacionesHoy = 0; 
    let ahorroTotal = 0;
    let tieneSobreGas = false;

    store.wallet.sobres.forEach(s => { 
        if (s.categoria === 'Ahorro' || s.categoria === 'Meta') {
            ahorroTotal += s.acumulado;
        } else {
            if (!s.pagadoHoy) obligacionesHoy += s.objetivoHoy; 
            if (s.categoria === 'Operativo' && (s.desc.toLowerCase().includes('gas') || s.desc.toLowerCase().includes('combustible'))) {
                tieneSobreGas = true;
            }
        }
    });
    
    const moraVencida = store.parametros.moraVencida || 0;
    const deficitRitmo = (store.parametros.deficitTotal || 0) - moraVencida;
    const disponible = saldo - obligacionesHoy - ahorroTotal;
    const metaExigible = safeFloat(store.parametros.metaDiaria); 
    const ritmoMsg = deficitRitmo > 1 ? `+${fmtMoney(deficitRitmo)} para ritmo ideal` : "Ritmo óptimo";
    
    let libreLabel = "Libre";
    let libreColor = "var(--text-sec)";
    let libreValColor = "var(--text-main)";
    
    if (disponible < 0) {
        libreLabel = "⚠️ Déficit de Caja";
        libreColor = "var(--danger)";
        libreValColor = "var(--danger)";
    }

    const html = `
    <div class="card" style="padding:20px; text-align:center;">
        <small style="color:var(--text-sec); text-transform:uppercase; font-size:0.75rem; letter-spacing:1px;">Saldo Real en Caja</small>
        <div style="font-size:2.8rem; font-weight:800; color:var(--text-main); line-height:1.2;">${fmtMoney(saldo)}</div>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:5px; margin-top:15px; border-top:1px solid #f1f5f9; padding-top:10px;">
            <div style="text-align:center;">
                <small style="color:var(--primary); font-weight:bold;">🔒 Compromisos</small>
                <div style="font-weight:600; font-size:0.9rem;">${fmtMoney(obligacionesHoy)}</div>
            </div>
            <div style="text-align:center;">
                <small style="color:#6366f1; font-weight:bold;">💎 Ahorro</small>
                <div style="font-weight:600; font-size:0.9rem;">${fmtMoney(ahorroTotal)}</div>
            </div>
            <div style="text-align:center;">
                <small style="color:${libreColor}; font-size:0.7rem;">${libreLabel}</small>
                <div style="font-weight:600; font-size:0.9rem; color:${libreValColor}">${fmtMoney(disponible)}</div>
            </div>
        </div>
    </div>

    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:15px;">
        <div class="card" style="padding:12px; background:#fff1f2; border:1px solid #fda4af;">
            <strong style="color:#be123c; font-size:0.8rem;">🎯 EXIGIBLE HOY</strong>
            <div style="font-weight:800; color:#881337; font-size:1.1rem;">${fmtMoney(metaExigible)}</div>
            <small style="color:#9f1239; font-size:0.7rem;">Base Operativa + Mora</small>
        </div>
        <div class="card" style="padding:12px; background:#f0fdf4; border:1px solid #86efac;">
            <strong style="color:#15803d; font-size:0.8rem;">📈 RECOMENDADO</strong>
            <div style="font-weight:600; color:#14532d; font-size:0.9rem; margin-top:3px;">${ritmoMsg}</div>
            <small style="color:#166534; font-size:0.7rem;">Ciclos Vigentes</small>
        </div>
    </div>
    
    ${(!tieneSobreGas && store.parametros.ultimoKM > 0) ? `<div style="text-align:center; margin-bottom:10px;"><small style="color:#d97706; background:#fffbeb; padding:4px 8px; border-radius:10px; border:1px solid #fcd34d;">💡 Tip: Crea un sobre "Gasolina" en Admin.</small></div>` : ''}

    ${moraVencida > 0 ? `
    <div class="card" style="border-left: 4px solid var(--danger); background:#fff5f5; margin-bottom:15px;">
        <strong style="color:#c53030;">⚠️ Atención: Mora Vencida ${fmtMoney(moraVencida)}</strong>
    </div>` : ''}
    `;
    
    const container = $('resumenHumanoContainer'); if(container) container.innerHTML = html;
}

function renderWallet() {
    if (!$('valWallet')) return;
    const saldo = store.wallet.saldo;
    let ahorroTotal = 0;
    
    store.wallet.sobres.forEach(s => { if (s.categoria === 'Ahorro' || s.categoria === 'Meta') ahorroTotal += s.acumulado; });
    
    let heroHtml = '';
    if (ahorroTotal > 0) {
        heroHtml = `
        <div style="text-align:center; margin-bottom:15px;">
            <div style="font-size:0.8rem; color:#aaa;">PATRIMONIO ACUMULADO</div>
            <div style="font-size:2rem; font-weight:bold; color:#6366f1;">${fmtMoney(ahorroTotal)}</div>
        </div>`;
    } else {
        heroHtml = `<div style="text-align:center; padding:10px; color:#94a3b8; font-size:0.85rem; margin-bottom:10px;">Aún no tienes metas de ahorro activas.</div>`;
    }

    $('valWallet').innerHTML = heroHtml;
    
    const container = $('sobresContainer'); 
    if(!container) return;
    container.innerHTML = '';
    
    const hoyIdx = MAPA_DIAS[new Date().getDay()];
    const diaMes = new Date().getDate();

    store.wallet.sobres.forEach(s => {
        // CORRECCIÓN 4: BOTÓN DE ABONO CLICKEABLE (BUTTON REAL)
        if (s.categoria === 'Ahorro' || s.categoria === 'Meta') {
            const pct = s.meta > 0 ? Math.min((s.acumulado / s.meta) * 100, 100) : 0;
            container.innerHTML += `
            <div class="card" style="padding:15px; border:1px solid #e0e7ff; background:linear-gradient(to right, #fff, #f5f3ff);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                    <strong style="color:#4f46e5;">💎 ${s.desc}</strong>
                    <div style="font-weight:bold; color:#4338ca;">${fmtMoney(s.acumulado)}</div>
                </div>
                <div style="height:8px; background:#e0e7ff; border-radius:4px; overflow:hidden;">
                    <div style="width:${pct}%; background:#6366f1; height:100%;"></div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.7rem; color:#6366f1; margin-top:4px;">
                    <span>Meta: ${fmtMoney(s.meta)}</span>
                    <button class="btn btn-sm" style="background:#6366f1; color:white; border:none; padding:4px 8px; border-radius:4px; font-size:0.7rem; cursor:pointer; z-index:10; position:relative;" onclick="Modal.show('Abonar a ${s.desc}', [{label:'Monto',key:'m',type:'number'}], d => actionAbonarAhorro('${s.id}', d.m))">+ ABONAR</button>
                </div>
            </div>`;
            return;
        }

        const esGas = s.categoria === 'Operativo' && (s.desc.toLowerCase().includes('gas') || s.desc.toLowerCase().includes('combustible'));
        if (esGas) {
             const pct = s.meta > 0 ? Math.min((s.acumulado / s.meta) * 100, 100) : 100;
             container.innerHTML += `
            <div class="card" style="padding:15px; border-left:4px solid #d97706; background:#fffbf0;">
                <div style="display:flex; justify-content:space-between; align-items: center;">
                    <div><strong style="color:#b45309;">⛽ ${s.desc}</strong></div>
                    <div style="text-align:right;">
                        <div style="font-weight:bold; font-size:1.1rem; color:#78350f;">${fmtMoney(s.acumulado)}</div>
                        <small style="color:#b45309; font-weight:bold;">${s.acumulado < 50 ? 'Reserva Baja' : 'Reserva OK'}</small>
                    </div>
                </div>
            </div>`;
            return;
        }

        // CORRECCIÓN 2: COPY DE GASTO DIARIO
        if (s.frecuencia === 'Diario' && s.pagadoHoy) {
            container.innerHTML += `
            <div class="card" style="padding:10px 15px; border-left:4px solid #cbd5e1; background:#f8fafc; opacity:0.6;">
                <div style="display:flex; justify-content:space-between; align-items: center;">
                    <span style="color:#64748b; font-size:0.9rem;">${s.desc}</span>
                    <span style="font-size:0.75rem; color:#64748b;">✔ Auto-descontado</span>
                </div>
            </div>`;
            return;
        }

        // CORRECCIÓN 1: LÓGICA VISUAL DE VENCIMIENTO (Sin tocar motor)
        let colorEstado = '#3b82f6';
        let mensajeEstado = "";
        let badge = "";
        let esMoraVisual = false;
        let esHoy = false;

        if (s.frecuencia !== 'Diario') {
            const diaPago = parseInt(s.diaPago || 7); // Si es 0 (Domingo) el motor lo guarda como 0 string
            const diaPagoNormalizado = diaPago === 0 ? 7 : diaPago; // Normalizamos Domingo 0 a 7 para comparar
            
            if (s.frecuencia === 'Semanal') {
                if (hoyIdx > diaPagoNormalizado && s.acumulado < s.meta) esMoraVisual = true;
                if (hoyIdx === diaPagoNormalizado && s.acumulado < s.meta) esHoy = true;
            } 
            else if (s.frecuencia === 'Mensual') {
                 if (diaMes > diaPago && s.acumulado < s.meta) esMoraVisual = true;
                 if (diaMes === diaPago && s.acumulado < s.meta) esHoy = true;
            }
        }
        
        if (s.frecuencia === 'Diario') {
            mensajeEstado = "Gasto operativo diario";
        } else {
            if (esMoraVisual) {
                mensajeEstado = `<span style="color:#dc2626; font-weight:bold;">⚠️ Vencido</span>`;
                colorEstado = '#dc2626';
            } else if (esHoy) {
                 mensajeEstado = `<span style="color:#d97706; font-weight:bold;">⚠️ Vence HOY</span>`;
                 colorEstado = '#d97706';
            } else if (s.acumulado < s.objetivoHoy) {
                const gap = s.objetivoHoy - s.acumulado;
                mensajeEstado = `<span style="color:#64748b;">En progreso (+${fmtMoney(gap)})</span>`;
                badge = `<span style="background:#dbeafe; color:#1e40af; padding:2px 6px; border-radius:4px; font-size:0.65rem; margin-left:5px; border:1px solid #bfdbfe;">Ciclo Vigente</span>`;
            } else {
                mensajeEstado = `<span style="color:#16a34a;">Ciclo cubierto</span>`;
                colorEstado = '#16a34a';
            }
        }

        container.innerHTML += `
        <div class="card" style="padding:15px; border-left:4px solid ${colorEstado}">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <div>
                    <strong>${s.desc}</strong>
                    ${badge}
                </div>
                <div style="text-align:right;">
                    <strong style="display:block;">${fmtMoney(valorMostrado)}</strong>
                    <div style="font-size:0.7rem;">${mensajeEstado}</div>
                </div>
            </div>
            <div style="height:6px; background:#e2e8f0; border-radius:3px; overflow:hidden;">
                <div style="width:${pctFisico}%; background:${colorEstado}; height:100%;"></div>
            </div>
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
    
    // CORRECCIÓN 3: SELECTOR RECURRENTE INTELIGENTE
    const divRecur = document.getElementById('zoneRecurrentes');
    if(!divRecur && $('btnGastoHogar')) {
        const div = document.createElement('div'); div.id = 'zoneRecurrentes';
        div.className = 'card'; div.style.padding = '10px'; div.style.background = '#f8fafc';
        $('btnGastoHogar').parentElement.parentElement.insertBefore(div, $('btnGastoHogar').parentElement);
    }
    
    const divRecurrentes = document.getElementById('zoneRecurrentes');
    if(divRecurrentes) {
         const recurrentes = store.gastosFijosMensuales.filter(g => g.frecuencia !== 'Unico' && g.categoria !== 'Ahorro' && g.categoria !== 'Meta');
         
         if(recurrentes.length === 0) {
             divRecurrentes.innerHTML = `
                <h4 style="font-size:0.9rem; color:#64748b; margin-bottom:5px;">Pagar Recurrente</h4>
                <div style="font-size:0.8rem; color:#94a3b8; font-style:italic;">No tienes gastos recurrentes registrados. Usa los botones de arriba para agregar "Renta", "Celular", etc.</div>
             `;
         } else {
             divRecurrentes.innerHTML = `<h4 style="font-size:0.9rem; color:#64748b; margin-bottom:5px;">Pagar Recurrente</h4><div style="display:flex; gap:5px;"><select id="selRecurrente" class="input-control" style="margin:0"></select><button id="btnDoPay" class="btn btn-success" style="width:auto">OK</button></div>`;
             const selR = divRecurrentes.querySelector('#selRecurrente');
             selR.innerHTML = '<option value="">Seleccionar...</option>';
             recurrentes.forEach(g => {
                 const opt = document.createElement('option'); opt.value = g.id; opt.innerText = `${g.desc} (${fmtMoney(g.monto)})`; selR.add(opt);
             });
             divRecurrentes.querySelector('#btnDoPay').onclick = () => { const v=$('selRecurrente').value; if(v && confirm("¿Pagar?")) actionPagarRecurrente(v); };
         }
    }

    const ul = $('listaDeudasAdmin');
    if(ul) {
        if(store.deudas.length === 0) {
            ul.innerHTML = '<div style="text-align:center; padding:15px; color:#64748b; font-size:0.9rem;">🎉 No tienes deudas registradas</div>';
        } else {
            ul.innerHTML = store.deudas.map(d => {
                return `<li style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #eee;">
                    <span>${d.desc}</span>
                    <div style="text-align:right;">
                        <span style="font-weight:bold; color:#334155;">${fmtMoney(d.saldo)}</span>
                        <div style="font-size:0.7rem; color:#64748b;">Pendiente Total</div>
                    </div>
                </li>`;
            }).join('');
        }
    }
    
    const selD = $('abonoDeudaSelect');
    if(selD) {
        selD.innerHTML = '<option value="">Seleccionar...</option>';
        if(store.deudas.length === 0) {
            const opt = document.createElement('option'); opt.text = "Sin deudas activas"; selD.add(opt);
        } else {
            store.deudas.forEach(d => {
                if(d.saldo < 1) return;
                const opt = document.createElement('option'); opt.value = d.id; opt.innerText = `${d.desc} (${fmtMoney(d.montoCuota)})`;
                selD.add(opt);
            });
        }
    }

    $('kmActual').innerText = `${store.parametros.ultimoKM} km`;
    const btnKM = $('btnConfigKM');
    
    if (store.parametros.kmInicialConfigurado || store.parametros.ultimoKM > 0) {
        btnKM.innerText = "🔒 Auto"; btnKM.className = "btn btn-outline"; btnKM.style.opacity = "0.7";
        btnKM.onclick = () => alert("🔒 KM Automático.");
    } else {
        btnKM.innerText = "🔓 Configurar"; btnKM.className = "btn btn-primary"; btnKM.style.opacity = "1";
        btnKM.onclick = () => Modal.show("Configurar KM", [{label:"KM Real",key:"km",type:"number"}], d => actionConfigurarKM(d.km));
    }

    const saldo = store.wallet.saldo;
    if($('valSaldoAdmin')) $('valSaldoAdmin').innerText = fmtMoney(saldo);

    const metaValor = $('metaDiariaValor');
    if (metaValor) {
        const meta = safeFloat(store.parametros.metaDiaria); 
        metaValor.innerText = fmtMoney(meta);
        
        const cardTitle = metaValor.previousElementSibling;
        if(cardTitle) cardTitle.innerText = "🎯 Meta Diaria Exigible";
        const descDiv = metaValor.nextElementSibling;
        if(descDiv) {
             descDiv.innerHTML = `<small style="color:#64748b;">(Base Operativa + Mora Vencida)</small>`;
        }
    }

    const btnSaldo = $('btnConfigSaldo');
    if (store.parametros.saldoInicialConfigurado) {
        btnSaldo.innerText = "🔒 Auto"; btnSaldo.className = "btn btn-outline"; btnSaldo.style.opacity = "0.7";
        btnSaldo.onclick = () => alert("🔒 Saldo Automático.");
    } else {
        btnSaldo.innerText = "🔓 Registrar Capital"; btnSaldo.className = "btn btn-primary"; btnSaldo.style.opacity = "1";
        btnSaldo.onclick = () => Modal.show("Capital Inicial", [{label:"¿Dinero actual?",key:"s",type:"number"}], d => actionSaldoInicial(d.s));
    }
    
    const adminZone = document.querySelector('.container');
    if(adminZone && !document.getElementById('zoneAhorro')) {
        const div = document.createElement('div'); div.id = 'zoneAhorro';
        div.className = 'card'; div.style.padding = '15px'; div.style.marginTop = '15px'; div.style.borderLeft = '4px solid #6366f1';
        div.innerHTML = `
            <h3 style="color:#4f46e5; margin-top:0;">💎 Gestión de Ahorro</h3>
            <p style="font-size:0.85rem; color:#64748b; margin-bottom:10px;">Metas personales</p>
            <button class="btn btn-outline" id="btnNewAhorro" style="border-color:#6366f1; color:#6366f1;">+ Nueva Meta</button>
        `;
        const listaDeudas = $('listaDeudasAdmin');
        if(listaDeudas) listaDeudas.parentElement.parentElement.insertBefore(div, listaDeudas.parentElement);
        
        div.querySelector('#btnNewAhorro').onclick = () => Modal.show("Nueva Meta Ahorro", [
            {label:"Nombre",key:"d"}, {label:"Monto Objetivo",key:"m",type:"number"}
        ], d => actionNuevaMetaAhorro(d.d, d.m));
    }
    
    const btnIni = $('btnTurnoIniciar');
    const btnFin = $('btnTurnoFinalizar');
    
    if(btnIni) {
        btnIni.onclick = () => { 
            store.turnoActivo = { inicio: Date.now(), kmInicial: store.parametros.ultimoKM }; 
            saveData(); 
            renderAdmin();
        };
    }
    if(btnFin) {
        // CORRECCIÓN 6: MODAL CON TIP DE CIERRE
        btnFin.onclick = () => Modal.show("Fin Turno (Ingresa montos reales)", [{label:"KM Final",key:"k",type:"number"},{label:"Ganancia Total",key:"g",type:"number"}], d => actionFinalizarTurno(d.k, d.g));
    }

    const activo = !!store.turnoActivo;
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
    } else {
        $('turnoEstado').innerHTML = '🔴 Detenido';
        if($('turnoTimer')) $('turnoTimer').innerText = "00:00:00";
        btnIni.classList.remove('hidden');
        btnFin.classList.add('hidden');
        if(window.timerInterval) { clearInterval(window.timerInterval); window.timerInterval = null; }
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
    let totalGasolina = 0;

    turnosRecientes.forEach(t => {
        totalIngresos += safeFloat(t.ganancia);
        let horas = 0;
        if (typeof t.duracionHoras === 'number') { horas = t.duracionHoras; } 
        else { const fin = new Date(t.fecha).getTime(); const inicio = t.inicio ? new Date(t.inicio).getTime() : fin; horas = (fin - inicio) / 3600000; }
        totalHoras += horas;
    });

    store.movimientos.forEach(m => {
        if(new Date(m.fecha) >= limite && m.desc.toLowerCase().includes('gasolina')) totalGasolina += safeFloat(m.monto);
    });

    const diasTrabajados = new Set(turnosRecientes.map(t => new Date(t.fecha).toDateString())).size;
    const ingresoNeto = totalIngresos - totalGasolina;
    const ingresoPromedioHora = totalHoras > 0 ? (totalIngresos / totalHoras) : 0;
    const ingresoNetoHora = totalHoras > 0 ? (ingresoNeto / totalHoras) : 0;
    
    $('statIngresoHora').innerText = totalHoras > 0 ? fmtMoney(ingresoPromedioHora) : "—";
    
    const statCont = $('statIngresoHora').parentElement;
    if(!document.getElementById('statNeto')) {
        const div = document.createElement('div'); div.id = 'statNeto';
        div.style.fontSize = '0.75rem'; div.style.color = '#64748b'; div.style.marginTop = '4px';
        statCont.appendChild(div);
    }
    
    if(totalHoras > 0) {
        $('statNeto').innerText = `Neto (sin gas): ${fmtMoney(ingresoNetoHora)}/h`;
    } else {
        $('statNeto').innerText = "Sin datos recientes";
    }

    $('statHorasTotal').innerText = totalHoras.toFixed(1) + "h";
    $('statDiasTrabajados').innerText = diasTrabajados;
    
    const ingDiario = diasTrabajados > 0 ? totalIngresos / diasTrabajados : 0;
    $('statIngresoDiario').innerText = fmtMoney(ingDiario);

    const metaDiaria = safeFloat(store.parametros.metaDiaria);
    $('statMetaDiaria').innerText = fmtMoney(metaDiaria);
    
    // CORRECCIÓN 5: STATS "ANALIZANDO" ELIMINADO
    const elDiag = $('statsDiagnostico');
    if (totalHoras > 0) {
        let costoGasPorHora = totalGasolina / totalHoras;
        elDiag.innerHTML = `
            <strong>Análisis Operativo (7 días):</strong><br>
            • Costo combustible: ${fmtMoney(costoGasPorHora)} / hora.<br>
            • Margen operativo: <strong>${(100 - ((totalGasolina/totalIngresos)*100)).toFixed(1)}%</strong>.<br>
            <span style="color:#2563eb;">💡 Mantén tus ciclos vigentes para asegurar liquidez.</span>
        `;
    } else {
        elDiag.innerHTML = `<span style="color:#64748b;">Pendiente de datos: Registra turnos con duración y ganancia real para proyectar tu rendimiento.</span>`;
    }
}

function renderDashboardContext() {
    if (!document.getElementById('uiTurnosHoy')) return;
    const hoyStr = new Date().toDateString();
    const turnosHoy = store.turnos.filter(t => new Date(t.fecha).toDateString() === hoyStr);
    let totalGanancia = 0; let totalHoras = 0;

    turnosHoy.forEach(t => {
        totalGanancia += safeFloat(t.ganancia);
        let horas = 0;
        if (typeof t.duracionHoras === 'number') { horas = t.duracionHoras; } else { const fin = new Date(t.fecha).getTime(); const inicio = t.inicio ? new Date(t.inicio).getTime() : fin; horas = (fin - inicio) / 3600000; }
        totalHoras += horas;
    });

    $('uiTurnosHoy').innerText = turnosHoy.length;
    $('uiHorasHoy').innerText = totalHoras > 0 ? totalHoras.toFixed(1) + 'h' : '0h';
    $('uiIngresoHoraHoy').innerText = totalHoras > 0 ? fmtMoney(totalGanancia / totalHoras) : '—';
    const lista = $('uiCompromisos'); lista.innerHTML = ''; lista.parentElement.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 V9.4 UX & VISUAL STATE PATCH");
    loadData();
    const page = document.body.dataset.page;
    if (page === 'index') { renderIndex(); renderDashboardContext(); }
    if (page === 'wallet') renderWallet();
    if (page === 'historial') renderHistorial();
    if (page === 'stats') renderStats();
    if (page === 'admin') {
        renderAdmin();
        $('btnTurnoIniciar').onclick = () => { store.turnoActivo = { inicio: Date.now(), kmInicial: store.parametros.ultimoKM }; saveData(); renderAdmin(); };
        $('btnTurnoFinalizar').onclick = () => Modal.show("Fin Turno (Ingresa montos reales)", [{label:"KM Final",key:"k",type:"number"},{label:"Ganancia Total",key:"g",type:"number"}], d => actionFinalizarTurno(d.k, d.g));
        $('btnGasolina').onclick = () => Modal.show("Gasolina", [{label:"Litros",key:"l",type:"number"},{label:"Costo ($)",key:"c",type:"number"},{label:"KM Actual",key:"k",type:"number"}], d => actionGasolina(d.l, d.c, d.k));
        
        const gastoWiz = (g) => {
            const typeKey = g.toLowerCase();
            const customCats = (store.categoriasPersonalizadas && store.categoriasPersonalizadas[typeKey]) ? store.categoriasPersonalizadas[typeKey] : [];
            const allCats = [...CATEGORIAS_BASE[typeKey], ...customCats, "➕ Crear nueva..."];
            Modal.show(`Nuevo ${g}`, [{label:"Descripción",key:"d"},{label:"Monto",key:"m",type:"number"},{label:"Categoría",key:"c",type:"select",options:allCats.map(x=>({val:x,txt:x}))},{label:"Frecuencia",key:"f",type:"select",options:Object.keys(FRECUENCIAS).map(x=>({val:x,txt:x}))}], d => {
                let catFinal = d.c;
                if (catFinal === "➕ Crear nueva...") { const nueva = prompt(`Nueva categoría para ${g}:`); if (!nueva || nueva.trim() === "") return; catFinal = nueva.trim(); if (!store.categoriasPersonalizadas[typeKey]) store.categoriasPersonalizadas[typeKey] = []; store.categoriasPersonalizadas[typeKey].push(catFinal); saveData(); }
                actionNuevoGasto(d.d, d.m, catFinal, d.f);
            });
        };
        $('btnGastoHogar').onclick = () => gastoWiz('Hogar'); $('btnGastoOperativo').onclick = () => gastoWiz('Operativo');
        $('btnDeudaNueva').onclick = () => Modal.show("Nueva Deuda", [{label:"Nombre",key:"d"},{label:"Total",key:"t",type:"number"},{label:"Cuota",key:"c",type:"number"},{label:"Frecuencia",key:"f",type:"select",options:Object.keys(FRECUENCIAS).map(x=>({val:x,txt:x}))},{label:"Día Pago",key:"dp",type:"select",options:DIAS_SEMANA}], d => actionNuevaDeuda(d.d, d.t, d.c, d.f, d.dp));
        $('btnAbonoCuota').onclick = () => { const v = $('abonoDeudaSelect').value; if(!v) return alert("⚠️ Selecciona una deuda"); if(confirm("¿Confirmar abono?")) actionAbonarDeuda(v); };
        $('btnExportJSON').onclick = () => navigator.clipboard.writeText(JSON.stringify(store)).then(() => alert("Copiado"));
        $('btnRestoreBackup').onclick = () => Modal.show("Restaurar", [{label:"JSON",key:"j"}], d => { try { store = {...INITIAL_STATE, ...JSON.parse(d.j)}; sanearDatos(); location.reload(); } catch(e){ alert("Error"); } });
    }
});
                   
