/* =========================================
   APP.JS - V6.0 RECUPERACIÓN DE DESASTRES (DATA RECOVERY)
   ========================================= */

// --- 1. CONFIGURACIÓN ---
const STORAGE_KEY = "moto_finanzas_vFinal"; 
const KEYS_LEGACY = ["moto_finanzas_v3", "moto_finanzas", "app_moto_data"]; // Posibles keys antiguas
const SCHEMA_VERSION = 6; 

const FRECUENCIAS = {
    'Diario': 1, 'Semanal': 7, 'Quincenal': 15, 
    'Mensual': 30, 'Bimestral': 60, 'Anual': 365, 'Unico': 0
};

const DIAS_SEMANA = [
    {value: "", text: "Seleccionar..."},
    {value: "1", text: "Lunes"}, {value: "2", text: "Martes"},
    {value: "3", text: "Miércoles"}, {value: "4", text: "Jueves"},
    {value: "5", text: "Viernes"}, {value: "6", text: "Sábado"},
    {value: "0", text: "Domingo"}
];

const CATEGORIAS = {
    operativo: ["Gasolina", "Mantenimiento", "Reparación", "Equipo", "Seguro"],
    hogar: ["Renta", "Comida", "Servicios", "Internet", "Salud", "Deudas", "Otro"]
};

// --- 2. UTILIDADES ---
const $ = (id) => document.getElementById(id);
const safeFloat = (val) => { const n = parseFloat(val); return isFinite(n) ? n : 0; };
const fmtMoney = (amount) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount || 0);
const uuid = () => Date.now().toString(36) + Math.random().toString(36).substr(2);
const getFechaHoy = () => new Date().toISOString().split('T')[0];

// --- 3. ESTADO INICIAL (SOLO REFERENCIA, NO SOBREESCRIBIR) ---
const INITIAL_STATE = {
    schemaVersion: SCHEMA_VERSION,
    turnos: [], 
    movimientos: [], 
    cargasCombustible: [], 
    deudas: [], 
    gastosFijosMensuales: [],
    wallet: { saldo: 0, sobres: [], historial: [] },
    parametros: { metaDiaria: 0, ultimoKM: 0, costoPorKm: 0, promedioDiarioKm: 120 },
    turnoActivo: null
};

let store = JSON.parse(JSON.stringify(INITIAL_STATE));

// --- 4. MOTOR DE RECUPERACIÓN Y SANEAMIENTO ---

function loadData() {
    console.log("♻️ INICIANDO PROTOCOLO DE RECUPERACIÓN...");
    
    // 1. INTENTO DE CARGA PRINCIPAL
    let raw = localStorage.getItem(STORAGE_KEY);
    
    // 2. BÚSQUEDA DE LEGADO (Si el principal está vacío o es muy nuevo/vacío)
    if (!raw || raw.length < 50) {
        console.warn("⚠️ Data principal vacía. Buscando en copias antiguas...");
        for (const key of KEYS_LEGACY) {
            const legacyRaw = localStorage.getItem(key);
            if (legacyRaw && legacyRaw.length > 50) {
                console.log(`✅ DATA ENCONTRADA EN: ${key}. Migrando...`);
                raw = legacyRaw;
                break;
            }
        }
    }

    if (raw) { 
        try { 
            const saved = JSON.parse(raw);
            
            // 3. FUSIÓN NO DESTRUCTIVA (DEEP MERGE MANUAL)
            // Esto evita que INITIAL_STATE aplaste tus arrays llenos
            
            // Arrays: Prioridad a lo guardado. Si no existe, usa array vacío.
            store.movimientos = Array.isArray(saved.movimientos) ? saved.movimientos : [];
            store.turnos = Array.isArray(saved.turnos) ? saved.turnos : [];
            store.cargasCombustible = Array.isArray(saved.cargasCombustible) ? saved.cargasCombustible : [];
            store.deudas = Array.isArray(saved.deudas) ? saved.deudas : [];
            store.gastosFijosMensuales = Array.isArray(saved.gastosFijosMensuales) ? saved.gastosFijosMensuales : [];
            
            // Objetos: Fusión de propiedades
            if (saved.wallet) {
                store.wallet = { 
                    ...INITIAL_STATE.wallet, 
                    ...saved.wallet,
                    sobres: Array.isArray(saved.wallet.sobres) ? saved.wallet.sobres : [] 
                };
            }
            
            if (saved.parametros) {
                store.parametros = { ...INITIAL_STATE.parametros, ...saved.parametros };
            }

            if (saved.turnoActivo) store.turnoActivo = saved.turnoActivo;

            console.log(`📦 DATOS CARGADOS: ${store.movimientos.length} movs, ${store.turnos.length} turnos.`);
            
            // Ejecutar saneamiento INMEDIATAMENTE después de cargar
            sanearDatos(); 

        } catch (e) { 
            console.error("❌ ERROR CRÍTICO CARGANDO DATOS:", e); 
            // No hacemos nada más para no dañar lo que haya.
        } 
    } else {
        console.log("ℹ️ No se encontraron datos previos. Iniciando app limpia.");
    }
}

function sanearDatos() {
    try {
        // A. RECALCULAR SALDO REAL (Fuente de verdad: Movimientos)
        // No confiamos en wallet.saldo guardado, lo recalculamos.
        let saldoCalculado = 0;
        store.movimientos.forEach(m => {
            if (m.tipo === 'ingreso') saldoCalculado += safeFloat(m.monto);
            if (m.tipo === 'gasto') saldoCalculado -= safeFloat(m.monto);
        });
        store.wallet.saldo = saldoCalculado;

        // B. RECUPERAR KILOMETRAJE
        // Buscamos el valor más alto registrado en la historia
        const maxTurno = store.turnos.length > 0 ? Math.max(...store.turnos.map(t => t.kmFinal || 0)) : 0;
        const maxGas = store.cargasCombustible.length > 0 ? Math.max(...store.cargasCombustible.map(c => c.km || 0)) : 0;
        const maxGuardado = safeFloat(store.parametros.ultimoKM);
        
        store.parametros.ultimoKM = Math.max(maxGuardado, maxTurno, maxGas);

        // C. REPARAR ESTRUCTURA DE SOBRES
        // Si se borraron, los regeneramos desde las definiciones de deuda/gasto
        actualizarSobresEstructural();
        
        // D. CALCULAR OBJETIVOS (Sin borrar dinero acumulado)
        recalcularObjetivosCalendario();

    } catch (e) { console.error("Error saneando datos:", e); }
}

function actualizarSobresEstructural() {
    const crearSobre = (refId, tipo, desc, meta, freq, diaPago) => {
        let s = store.wallet.sobres.find(x => x.refId === refId);
        if (!s) {
            // Si no existe, lo creamos, pero con acumulado 0 (recuperación conservadora)
            s = { id: uuid(), refId, tipo, desc, acumulado: 0, objetivoHoy: 0 };
            store.wallet.sobres.push(s);
        }
        // Restauramos configuración
        s.meta = safeFloat(meta); s.frecuencia = freq; s.diaPago = diaPago; s.desc = desc;
    };
    
    store.deudas.forEach(d => { if (d.saldo > 0) crearSobre(d.id, 'deuda', d.desc, d.montoCuota, d.frecuencia, d.diaPago); });
    store.gastosFijosMensuales.forEach(g => { crearSobre(g.id, 'gasto', g.desc, g.monto, g.frecuencia); });
}

function recalcularObjetivosCalendario() {
    const hoyIndex = new Date().getDay();
    const diaDelMes = new Date().getDate();

    store.wallet.sobres.forEach(s => {
        let montoIdeal = 0;
        if (s.frecuencia === 'Semanal') {
            const dia = hoyIndex === 0 ? 7 : hoyIndex;
            montoIdeal = (s.meta / 7) * dia;
        } else if (s.frecuencia === 'Mensual') {
            montoIdeal = (s.meta / 30) * diaDelMes;
        } else if (s.frecuencia === 'Diario') {
            montoIdeal = s.meta;
        }
        if (montoIdeal > s.meta) montoIdeal = s.meta;
        s.objetivoHoy = montoIdeal;
        // NOTA: No tocamos s.acumulado. Ese es dinero sagrado.
    });
    saveData();
}

function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }


// --- 5. OPERACIONES (CORE) ---

function finalizarTurno(kmFinal, ganancia) {
    const kF = safeFloat(kmFinal);
    if (kF < store.parametros.ultimoKM) return alert(`⛔ Error: KM actual (${store.parametros.ultimoKM}) es mayor al ingresado.`);
    
    store.turnos.push({ id: uuid(), fecha: new Date().toISOString(), ganancia: safeFloat(ganancia), kmRecorrido: kF - store.parametros.ultimoKM, kmFinal: kF });
    store.movimientos.push({ id: uuid(), fecha: new Date().toISOString(), tipo: 'ingreso', desc: 'Turno Finalizado', monto: safeFloat(ganancia) });
    
    store.parametros.ultimoKM = kF; 
    store.turnoActivo = null; 
    sanearDatos();
    updateAdminUI();
}

function registrarGasolina(l, c, k) {
    const km = safeFloat(k);
    if (km < store.parametros.ultimoKM && km > 0) return alert(`⛔ Error KM.`);

    store.cargasCombustible.push({ id: uuid(), fecha: new Date().toISOString(), litros: l, costo: c, km: km });
    store.movimientos.push({ id: uuid(), fecha: new Date().toISOString(), tipo: 'gasto', desc: '⛽ Gasolina', monto: safeFloat(c), categoria: 'Operativo' });

    if (km > store.parametros.ultimoKM) store.parametros.ultimoKM = km;
    sanearDatos();
    alert("✅ Gasolina registrada");
}

function procesarNuevoGasto(desc, monto, grupo, cat, freq) {
    const existe = store.gastosFijosMensuales.find(g => g.desc.toLowerCase() === desc.toLowerCase());
    if (existe) return alert("⚠️ Gasto ya existe.");
    const id = uuid(); const m = safeFloat(monto);
    if (freq !== 'Unico') store.gastosFijosMensuales.push({ id, desc, monto: m, categoria: cat, frecuencia: freq });
    store.movimientos.push({ id, fecha: new Date().toISOString(), tipo: 'gasto', desc, monto: m, categoria: cat });
    sanearDatos();
}

function pagarGastoRecurrente(id) {
    const gf = store.gastosFijosMensuales.find(x => x.id === id);
    if (!gf) return;
    store.movimientos.push({ id: uuid(), fecha: new Date().toISOString(), tipo: 'gasto', desc: gf.desc, monto: safeFloat(gf.monto), categoria: gf.categoria });
    const s = store.wallet.sobres.find(x => x.refId === id);
    if (s) { s.acumulado -= safeFloat(gf.monto); if (s.acumulado < 0) s.acumulado = 0; }
    sanearDatos();
    alert("✅ Pagado");
}

function agregarDeuda(desc, total, cuota, freq, diaPago) {
    store.deudas.push({ id: uuid(), desc, montoTotal: total, montoCuota: cuota, frecuencia: freq, diaPago, saldo: total }); 
    sanearDatos();
}

function abonarDeuda(id, monto) {
    const d = store.deudas.find(x => x.id == id); if (!d) return;
    const val = safeFloat(monto);
    d.saldo -= val; if (d.saldo < 0) d.saldo = 0;
    const s = store.wallet.sobres.find(x => x.refId === id); 
    if (s) s.acumulado = 0; 
    store.movimientos.push({ id: uuid(), fecha: new Date().toISOString(), tipo: 'gasto', desc: `Pago Deuda: ${d.desc}`, monto: val, categoria: 'Deuda' });
    sanearDatos();
}

/* FIN PARTE 1 */
       /* =========================================
   APP.JS - V6.0 PARTE 2 (UI RESTAURADA)
   ========================================= */

// --- 6. REPORTES HUMANOS ---

function generarResumenHumanoHoy(store) {
    const saldoTotal = safeFloat(store.wallet.saldo);
    let dineroEnSobres = 0;
    store.wallet.sobres.forEach(s => dineroEnSobres += safeFloat(s.acumulado));
    const dineroLibreReal = saldoTotal - dineroEnSobres;
    
    let alertas = [];
    store.wallet.sobres.forEach(s => {
        const objetivo = safeFloat(s.objetivoHoy);
        const real = safeFloat(s.acumulado);
        if ((objetivo - real) > 10) {
            alertas.push(`<li style="margin-bottom:4px; color:#d97706">Separa <strong>${fmtMoney(objetivo - real)}</strong> para ${s.desc}</li>`);
        }
    });

    const mensajeEstado = dineroLibreReal < 0 
        ? `<p style="color:#ef4444; font-weight:bold; margin-top:5px;">⚠️ Déficit: $${fmtMoney(Math.abs(dineroLibreReal))}</p>` 
        : `<p style="color:#16a34a; margin-top:5px;">✅ Libre: <strong>${fmtMoney(dineroLibreReal)}</strong></p>`;

    const htmlAlertas = alertas.length > 0 ? `<ul style="margin:10px 0 0 20px; font-size:0.85rem;">${alertas.join('')}</ul>` : `<p style="color:#16a34a; font-size:0.9rem; margin-top:10px;">✨ Al día con ahorros.</p>`;

    return `<div style="background:#f8fafc; padding:15px; border-radius:12px; margin:15px 0; border:1px solid #e2e8f0;">
        <p style="font-size:0.9rem">Caja: <strong>${fmtMoney(saldoTotal)}</strong> | Sobres: <strong>${fmtMoney(dineroEnSobres)}</strong></p>
        <hr style="margin:8px 0; border:0; border-top:1px dashed #ccc;">
        ${mensajeEstado}
        <div style="margin-top:10px; border-top:1px solid #eee; padding-top:10px;">${htmlAlertas}</div>
    </div>`;
}

function generarReporteSemanal() {
    let dineroEnSobres = 0;
    store.wallet.sobres.forEach(s => dineroEnSobres += safeFloat(s.acumulado));
    const libre = store.wallet.saldo - dineroEnSobres;
    
    let barras = store.wallet.sobres.map(s => {
        const pct = Math.min((s.acumulado / s.meta) * 100, 100);
        const pctIdeal = Math.min((s.objetivoHoy / s.meta) * 100, 100);
        return `<div style="margin-bottom:12px; font-size:0.8rem;">
            <div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>${s.desc}</span><span>${fmtMoney(s.acumulado)} / ${fmtMoney(s.meta)}</span></div>
            <div style="position:relative; background:#e2e8f0; height:8px; border-radius:4px;">
                <div style="width:${pct}%; background:${s.tipo === 'deuda' ? '#ef4444' : '#3b82f6'}; height:100%; border-radius:4px;"></div>
                <div style="position:absolute; top:0; left:${pctIdeal}%; width:2px; height:100%; background:rgba(0,0,0,0.5);" title="Objetivo"></div>
            </div>
        </div>`;
    }).join('');

    const html = `<div style="text-align:center; margin-bottom:15px;">Libre Real: <strong style="color:#16a34a; font-size:1.2rem">${fmtMoney(libre)}</strong></div><h4>Estado Sobres</h4><div>${barras}</div>`;
    Modal.showHtml("Reporte", html);
}

function renderHistorialBlindado(store) {
    const tbody = document.getElementById('tablaBody');
    if (!tbody) return;
    
    if (!store.movimientos || store.movimientos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:20px; color:#94a3b8;">Sin movimientos</td></tr>`;
        return;
    }

    const movs = [...store.movimientos].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 50);
    tbody.innerHTML = movs.map(m => `
        <tr>
            <td style="color:#64748b; font-size:0.85rem;">${new Date(m.fecha).toLocaleDateString('es-MX', {day:'2-digit', month:'short'})}</td>
            <td><div style="font-weight:600; font-size:0.9rem;">${m.desc}</div><div style="font-size:0.75rem; color:#94a3b8;">${m.categoria || 'General'}</div></td>
            <td style="text-align:right; font-weight:bold; color:${m.tipo === 'ingreso' ? '#16a34a' : '#ef4444'};">${m.tipo === 'ingreso' ? '+' : '-'}${fmtMoney(m.monto)}</td>
        </tr>`).join('');
}

// --- 7. UI ADMIN ---

function updateAdminUI() {
    if ($('kmActual')) $('kmActual').innerText = `${store.parametros.ultimoKM} km`;
    
    // Recalcular meta diaria basada en costo actual y sobres
    const metaHoy = store.wallet.sobres.reduce((a, b) => a + (b.meta - b.acumulado > 0 ? (b.meta / 7) : 0), 0) + (120 * safeFloat(store.parametros.costoPorKm));
    if ($('metaDiariaValor')) $('metaDiariaValor').innerText = fmtMoney(metaHoy);

    const activo = !!store.turnoActivo;
    const btnIni = $('btnTurnoIniciar');
    const btnFin = $('btnTurnoFinalizar');
    
    if ($('turnoEstado')) {
        $('turnoEstado').innerHTML = activo 
            ? `<span style="color:green; font-weight:bold; animation:pulse 2s infinite">🟢 EN CURSO</span>` 
            : `<span style="color:#64748b; font-weight:bold">🔴 DETENIDO</span>`;
    }

    if (btnIni) btnIni.style.display = activo ? 'none' : 'block';
    
    if (btnFin) {
        btnFin.style.display = activo ? 'block' : 'none';
        btnFin.classList.remove('hidden');
        // Fail-safe button
        if(activo && btnFin.offsetParent === null && $('turnoEstado')) {
             $('turnoEstado').innerHTML += `<br><a href="#" onclick="Modal.showInput('Fin Forzado',[{label:'KM',key:'km',type:'number'},{label:'$$',key:'g',type:'number'}],d=>finalizarTurno(d.km,d.g));return false;" style="color:red;font-size:0.8rem;">[FORZAR FIN]</a>`;
        }
    }

    // Menú Recurrente
    const cardHogar = $('btnGastoHogar')?.closest('.card');
    if (cardHogar && !document.getElementById('zoneRecurrentes')) {
        const div = document.createElement('div');
        div.id = 'zoneRecurrentes';
        div.style = "background:#f1f5f9; padding:10px; border-radius:8px; margin-bottom:15px; border:1px solid #cbd5e1;";
        div.innerHTML = `<h4 style="margin-top:0; font-size:0.9rem; color:#475569">Pagar Gasto Recurrente</h4><div style="display:flex; gap:5px;"><select id="selRecurrente" class="input-control" style="flex:1;"><option value="">Seleccionar...</option></select><button id="btnPagarRecurrente" class="btn btn-success" style="padding:5px 10px;">Pagar</button></div>`;
        cardHogar.insertBefore(div, $('btnGastoHogar'));
        div.querySelector('#btnPagarRecurrente').onclick = () => { const id = $('selRecurrente').value; if (!id) return alert("Selecciona uno"); if (confirm("¿Pagar?")) pagarGastoRecurrente(id); };
    }
    const selR = $('selRecurrente');
    if (selR) {
        selR.innerHTML = '<option value="">Seleccionar...</option>';
        store.gastosFijosMensuales.forEach(g => {
            const opt = document.createElement('option'); opt.value = g.id; opt.innerText = `${g.desc} (${fmtMoney(g.monto)})`; selR.appendChild(opt);
        });
    }

    // Deudas
    const selDeuda = $('abonoDeudaSelect');
    if (selDeuda) {
        selDeuda.innerHTML = '<option value="">-- Pagar Deuda --</option>';
        store.deudas.forEach(d => {
            if (d.saldo < 1) return;
            const sobre = store.wallet.sobres.find(s => s.refId === d.id);
            const acumulado = sobre ? safeFloat(sobre.acumulado) : 0;
            const o = document.createElement('option'); o.value = d.id; o.innerText = `${d.desc} (Faltan ${fmtMoney(d.montoCuota - acumulado)})`; selDeuda.appendChild(o);
        });
    }
    
    const listaDeudas = $('listaDeudasAdmin');
    if(listaDeudas) {
        listaDeudas.style.display = store.deudas.length ? 'block' : 'none';
        listaDeudas.innerHTML = store.deudas.map(d => `<li style="padding:8px 0; border-bottom:1px solid #eee; display:flex; justify-content:space-between; font-size:0.85rem;"><span>${d.desc}</span><span style="color:${d.saldo>0?'#ef4444':'#16a34a'}; font-weight:bold;">${fmtMoney(d.saldo)}</span></li>`).join('');
    }

    const zone = document.querySelector('#btnExportJSON')?.parentNode;
    if (zone && !document.getElementById('btnVerReporte')) {
        const btn = document.createElement('button'); btn.id = 'btnVerReporte'; btn.className = 'btn btn-primary'; btn.style.marginBottom = '10px'; btn.innerText = '📈 Ver Reporte'; btn.onclick = generarReporteSemanal; zone.prepend(btn);
    }
}

// --- 8. UI HELPERS ---
const Modal = {
    showInput: (title, inputs, onConfirm) => {
        const m = $('appModal'), b = $('modalBody'), vals = {};
        $('modalTitle').innerText = title; b.innerHTML = '';
        inputs.forEach(c => {
            const d = document.createElement('div'); d.innerHTML = `<label style="display:block;font-size:0.8rem;color:#666;margin-top:5px">${c.label}</label>`;
            const i = document.createElement(c.type === 'select' ? 'select' : 'input'); i.className = 'input-control'; i.style.width = '100%'; i.style.padding = '8px';
            if (c.type === 'select') c.options.forEach(o => { const op = document.createElement('option'); op.value = o.value; op.innerText = o.text; i.appendChild(op) });
            else { i.type = c.type || 'text'; if (c.value !== undefined) i.value = c.value }
            i.onchange = e => vals[c.key] = e.target.value; d.appendChild(i); b.appendChild(d);
        });
        $('modalConfirm').onclick = () => { const is = b.querySelectorAll('input,select'); is.forEach((x, k) => vals[inputs[k].key] = x.value); if (onConfirm(vals) !== false) m.style.display = 'none' };
        $('modalCancel').style.display = 'block'; $('modalCancel').onclick = () => m.style.display = 'none'; m.style.display = 'flex';
    },
    showHtml: (t, h) => { const m = $('appModal'); $('modalTitle').innerText = t; $('modalBody').innerHTML = h; $('modalConfirm').onclick = () => m.style.display = 'none'; $('modalCancel').style.display = 'none'; m.style.display = 'flex'; }
};

// --- 9. INIT ---
function init() {
    console.log("🚀 V6.0 RECUPERACIÓN (DEEP MERGE)"); loadData();
    
    const page = document.body.dataset.page;
    document.querySelectorAll('.nav-link').forEach(l => { if (l.getAttribute('href').includes(page)) l.classList.add('active') });

    if (page === 'index') {
        const hoy = new Date().toDateString();
        const gan = store.turnos.filter(t => new Date(t.fecha).toDateString() === hoy).reduce((a, b) => a + b.ganancia, 0);
        if ($('resGananciaBruta')) $('resGananciaBruta').innerText = fmtMoney(gan);
        const m = document.querySelector('main.container'); let rd = $('resumenHumano');
        if (!rd && m) { rd = document.createElement('div'); rd.id = 'resumenHumano'; const c = m.querySelector('.card'); if (c) c.insertAdjacentElement('afterend', rd); else m.prepend(rd); }
        if (rd) rd.innerHTML = generarResumenHumanoHoy(store);
    }
    
    if (page === 'historial') renderHistorialBlindado(store);
    
    if (page === 'wallet') {
        let comp = 0; store.wallet.sobres.forEach(s => comp += safeFloat(s.acumulado));
        if ($('valWallet')) $('valWallet').innerHTML = `${fmtMoney(store.wallet.saldo)}<br><small style="color:${store.wallet.saldo - comp >= 0 ? 'green' : 'orange'}">Libre: ${fmtMoney(store.wallet.saldo - comp)}</small>`;
        const m = document.querySelector('main.container'); let c = $('sobresContainer');
        if (!c && m) { c = document.createElement('div'); c.id = 'sobresContainer'; m.appendChild(c); }
        if (c) c.innerHTML = store.wallet.sobres.map(s => `<div class="card" style="padding:12px; margin-top:10px; border-left:4px solid ${s.tipo === 'deuda' ? '#ef4444' : '#3b82f6'}"><div style="display:flex; justify-content:space-between; margin-bottom:5px"><strong>${s.desc}</strong><small>${fmtMoney(s.acumulado)} / ${fmtMoney(s.meta)}</small></div><div style="background:#e2e8f0; height:8px; border-radius:4px;"><div style="width:${Math.min((s.acumulado / s.meta) * 100, 100)}%; background:${s.tipo === 'deuda' ? '#ef4444' : '#3b82f6'}; height:100%; border-radius:4px;"></div></div></div>`).join('');
    }
    
    if (page === 'admin') {
        updateAdminUI();
        setInterval(() => { if ($('turnoTimer') && store.turnoActivo && store.turnoActivo.inicio) { const d = Date.now() - store.turnoActivo.inicio; const h = Math.floor(d / 3600000); const m = Math.floor((d % 3600000) / 60000); $('turnoTimer').innerText = `${h}h ${m}m`; } }, 1000);
        const bind = (i, f) => { const e = $(i); if (e) e.onclick = x => { x.preventDefault(); f(); updateAdminUI() } };

        if ($('btnConfigKM')) $('btnConfigKM').onclick = (e) => { e.preventDefault(); alert("🔒 El kilometraje se ajusta automáticamente."); };
        bind('btnTurnoIniciar', () => { if(!store.turnoActivo) { store.turnoActivo = { inicio: Date.now() }; saveData(); updateAdminUI(); } });
        bind('btnTurnoFinalizar', () => Modal.showInput("Finalizar Turno", [{ label: "KM Final", key: "km", type: "number" }, { label: "Ganancia", key: "g", type: "number" }], d => finalizarTurno(d.km, d.g)));
        
        const wiz = (g) => Modal.showInput(`Nuevo Gasto ${g}`, [{ label: "Desc", key: "d" }, { label: "$$", key: "m", type: "number" }, { label: "Cat", key: "c", type: "select", options: CATEGORIAS[g.toLowerCase()].map(x => ({ value: x, text: x })) }, { label: "Freq", key: "f", type: "select", options: Object.keys(FRECUENCIAS).map(x => ({ value: x, text: x })) }], d => procesarNuevoGasto(d.d, d.m, g, d.c, d.f));
        bind('btnGastoHogar', () => wiz('Hogar'));
        if ($('btnGastoOperativo')) $('btnGastoOperativo').onclick = (e) => { e.preventDefault(); wiz('Operativo'); updateAdminUI(); };

        bind('btnGasolina', () => Modal.showInput("Gas", [{ label: "L", key: "l", type: "number" }, { label: "$$", key: "c", type: "number" }, { label: "KM", key: "k", type: "number" }], d => registrarGasolina(d.l, d.c, d.k)));
        bind('btnDeudaNueva', () => Modal.showInput("Deuda", [{ label: "Nombre", key: "n" }, { label: "Total", key: "t", type: "number" }, { label: "Cuota", key: "c", type: "number" }, { label: "Frec", key: "f", type: "select", options: Object.keys(FRECUENCIAS).map(x => ({ value: x, text: x })) }, { label: "Día", key: "dp", type: "select", options: DIAS_SEMANA }], d => agregarDeuda(d.n, d.t, d.c, d.f, d.dp)));
        bind('btnAbonoCuota', () => { const id = $('abonoDeudaSelect').value; if(id) abonarDeuda(id, store.deudas.find(x => x.id == id)?.montoCuota); });
        
        bind('btnExportJSON', () => navigator.clipboard.writeText(JSON.stringify(store)).then(() => alert("Copiado")));
        bind('btnRestoreBackup', () => Modal.showInput("Restaurar", [{ label: "JSON", key: "j" }], d => { try { store = { ...INITIAL_STATE, ...JSON.parse(d.j) }; sanearDatos(); saveData(); location.reload() } catch (e) { alert("JSON Inválido") } }));
    }
}
document.addEventListener('DOMContentLoaded', init);
                                             
