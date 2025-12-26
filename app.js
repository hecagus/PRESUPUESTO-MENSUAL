/* =============================================================
   APP.JS - V7.2 (FIX DEUDAS Y ABONOS)
   ============================================================= */

/* -------------------------------------------------------------
   SECCIÓN 1: CONFIGURACIÓN
   ------------------------------------------------------------- */
const STORAGE_KEY = "moto_finanzas_vFinal";
const LEGACY_KEYS = ["moto_finanzas_v3", "moto_finanzas", "app_moto_data"];
const SCHEMA_VERSION = 7.2;

const FRECUENCIAS = { 'Diario': 1, 'Semanal': 7, 'Quincenal': 15, 'Mensual': 30, 'Bimestral': 60, 'Anual': 365, 'Unico': 0 };
const DIAS_SEMANA = [
    {val:"", txt:"Seleccionar..."}, {val:"1", txt:"Lunes"}, {val:"2", txt:"Martes"},
    {val:"3", txt:"Miércoles"}, {val:"4", txt:"Jueves"}, {val:"5", txt:"Viernes"},
    {val:"6", txt:"Sábado"}, {val:"0", txt:"Domingo"}
];
const CATEGORIAS = {
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
    parametros: { ultimoKM: 0, costoPorKm: 0, metaDiaria: 0 },
    turnoActivo: null
};

let store = JSON.parse(JSON.stringify(INITIAL_STATE));

function loadData() {
    console.log("♻️ [V7.2] Cargando datos...");
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

            sanearDatos();
        } catch (e) { console.error("❌ Error carga:", e); }
    }
}

function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }

function sanearDatos() {
    // 1. Saldo
    let saldo = 0;
    store.movimientos.forEach(m => {
        if (m.tipo === 'ingreso') saldo += safeFloat(m.monto);
        if (m.tipo === 'gasto') saldo -= safeFloat(m.monto);
    });
    store.wallet.saldo = saldo;

    // 2. KM
    const kms = [
        store.parametros.ultimoKM || 0,
        ...store.turnos.map(t => t.kmFinal || 0),
        ...store.cargasCombustible.map(c => c.km || 0)
    ];
    store.parametros.ultimoKM = Math.max(...kms);

    // 3. Turno
    if (store.turnoActivo && (!store.turnoActivo.inicio || !Number.isFinite(store.turnoActivo.inicio))) {
        store.turnoActivo = null;
    }

    // 4. Sobres
    reconstruirSobres();
    calcularObjetivosYMeta();
    saveData();
}

function reconstruirSobres() {
    // AHORA ACEPTA DIA DE PAGO (dp)
    const ensureSobre = (refId, tipo, desc, meta, freq, dp) => {
        let s = store.wallet.sobres.find(x => x.refId === refId);
        if (!s) {
            s = { id: uuid(), refId, tipo, desc, acumulado: 0, objetivoHoy: 0 };
            store.wallet.sobres.push(s);
        }
        s.meta = safeFloat(meta); s.frecuencia = freq; s.desc = desc; 
        if(dp) s.diaPago = dp; // Guardamos el día de pago en el sobre
    };
    // Pasamos d.diaPago al sobre
    store.deudas.forEach(d => { if(d.saldo > 0) ensureSobre(d.id, 'deuda', d.desc, d.montoCuota, d.frecuencia, d.diaPago); });
    store.gastosFijosMensuales.forEach(g => ensureSobre(g.id, 'gasto', g.desc, g.monto, g.frecuencia));
}

function calcularObjetivosYMeta() {
    const hoyIdx = new Date().getDay(); 
    const diaMes = new Date().getDate();
    let sumaMetasDiarias = 0;

    store.wallet.sobres.forEach(s => {
        let ideal = 0;
        // Lógica simple de acumulación lineal
        if(s.frecuencia === 'Semanal') ideal = (s.meta / 7) * (hoyIdx === 0 ? 7 : hoyIdx);
        else if(s.frecuencia === 'Mensual') ideal = (s.meta / 30) * diaMes;
        else if(s.frecuencia === 'Diario') ideal = s.meta;
        
        s.objetivoHoy = Math.min(ideal, s.meta);
        
        let aporteDiario = 0;
        if(s.frecuencia === 'Semanal') aporteDiario = s.meta / 7;
        else if(s.frecuencia === 'Mensual') aporteDiario = s.meta / 30;
        else if(s.frecuencia === 'Diario') aporteDiario = s.meta;
        
        if(s.acumulado < s.meta) sumaMetasDiarias += aporteDiario;
    });

    store.parametros.metaDiaria = sumaMetasDiarias + (120 * safeFloat(store.parametros.costoPorKm));
}

/* -------------------------------------------------------------
   SECCIÓN 3: ACCIONES
   ------------------------------------------------------------- */
function actionFinalizarTurno(kmFinal, ganancia) {
    const kF = safeFloat(kmFinal);
    if (kF < store.parametros.ultimoKM) return alert(`⛔ Error: KM actual es ${store.parametros.ultimoKM}`);
    
    store.turnos.push({ id: uuid(), fecha: new Date().toISOString(), ganancia: safeFloat(ganancia), kmRecorrido: kF - store.parametros.ultimoKM, kmFinal: kF });
    store.movimientos.push({ id: uuid(), fecha: new Date().toISOString(), tipo: 'ingreso', desc: 'Turno Finalizado', monto: safeFloat(ganancia) });
    store.parametros.ultimoKM = kF; store.turnoActivo = null; 
    sanearDatos(); renderAdmin();
}

function actionGasolina(l, c, k) {
    const km = safeFloat(k);
    if(km < store.parametros.ultimoKM && km > 0) return alert("⛔ KM inválido");
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

// CORREGIDO: Acepta día de pago (dp)
function actionNuevaDeuda(desc, total, cuota, freq, dp) {
    store.deudas.push({ 
        id: uuid(), 
        desc, 
        montoTotal: total, 
        montoCuota: cuota, 
        frecuencia: freq, 
        diaPago: dp, // Guardamos el día
        saldo: total 
    });
    sanearDatos();
    alert("✅ Deuda creada correctamente");
}

// CORREGIDO: Lógica de abono y feedback
function actionAbonarDeuda(id) {
    const d = store.deudas.find(x => x.id === id); 
    if(!d) return alert("❌ Error: Deuda no encontrada");
    
    // Descontar saldo y crear movimiento
    d.saldo -= d.montoCuota; 
    if(d.saldo < 0) d.saldo = 0;
    
    // Vaciar el sobre asociado (ya se pagó)
    const s = store.wallet.sobres.find(x => x.refId === id); 
    if(s) s.acumulado = 0;
    
    store.movimientos.push({ 
        id: uuid(), 
        fecha: new Date().toISOString(), 
        tipo: 'gasto', 
        desc: `Abono: ${d.desc}`, 
        monto: d.montoCuota, 
        categoria: 'Deuda' 
    });
    
    sanearDatos();
    alert(`✅ Abono de ${fmtMoney(d.montoCuota)} registrado para ${d.desc}`);
    renderAdmin(); // Refrescar UI inmediatamente
}

function actionPagarRecurrente(id) {
    const gf = store.gastosFijosMensuales.find(x => x.id === id); if(!gf) return;
    store.movimientos.push({ id: uuid(), fecha: new Date().toISOString(), tipo: 'gasto', desc: gf.desc, monto: gf.monto, categoria: gf.categoria });
    const s = store.wallet.sobres.find(x => x.refId === id);
    if(s) { s.acumulado -= gf.monto; if(s.acumulado < 0) s.acumulado = 0; }
    sanearDatos(); alert("✅ Pagado");
}

/* -------------------------------------------------------------
   SECCIÓN 4: RENDERIZADO (UI)
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
    const comprometido = store.wallet.sobres.reduce((a,b)=>a+b.acumulado,0);
    const libre = saldo - comprometido;
    
    let avisos = store.wallet.sobres
        .filter(s => (s.objetivoHoy - s.acumulado) > 10)
        .map(s => `<li style="color:#d97706; margin-bottom:4px;">Separa <strong>${fmtMoney(s.objetivoHoy - s.acumulado)}</strong> para ${s.desc}</li>`);

    const html = `
    <div class="card" style="border-left: 4px solid ${libre>=0?'var(--success)':'var(--danger)'}">
        <p><strong>Caja Total:</strong> ${fmtMoney(saldo)}</p>
        <p><strong>En Sobres:</strong> ${fmtMoney(comprometido)}</p>
        <hr style="margin:10px 0; border:0; border-top:1px dashed #ccc;">
        <p style="font-size:1.1rem; color:${libre>=0?'var(--success)':'var(--danger)'}; font-weight:bold;">
            ${libre>=0?'✅ Libre: ':'⚠️ Déficit: '} ${fmtMoney(libre)}
        </p>
        <ul style="margin-top:10px; font-size:0.85rem; padding-left:20px;">
            ${avisos.length ? avisos.join('') : '<li style="color:var(--success)">✨ Todo al día.</li>'}
        </ul>
    </div>`;
    const container = $('resumenHumanoContainer'); if(container) container.innerHTML = html;
}

function renderWallet() {
    if (!$('valWallet')) return;
    const saldo = store.wallet.saldo;
    const comprometido = store.wallet.sobres.reduce((a,b)=>a+b.acumulado,0);
    const libre = saldo - comprometido;
    $('valWallet').innerHTML = `${fmtMoney(saldo)}<br><small style="font-size:0.9rem; opacity:0.9; font-weight:normal">(${fmtMoney(comprometido)} en sobres / ${fmtMoney(libre)} libre)</small>`;
    
    const container = $('sobresContainer'); if(!container) return;
    container.innerHTML = '';
    
    store.wallet.sobres.forEach(s => {
        const pct = Math.min((s.acumulado/s.meta)*100, 100);
        const pctIdeal = Math.min((s.objetivoHoy/s.meta)*100, 100);
        // Mostramos el día de pago si existe
        const diaTxt = s.diaPago ? ` (Día ${s.diaPago})` : '';
        
        container.innerHTML += `
        <div class="card" style="padding:15px; border-left:5px solid ${s.tipo==='deuda'?'#dc2626':'#2563eb'}">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <strong>${s.desc}${diaTxt}</strong>
                <small>${fmtMoney(s.acumulado)} / ${fmtMoney(s.meta)}</small>
            </div>
            <div style="height:10px; background:#e2e8f0; border-radius:5px; position:relative; overflow:hidden;">
                <div style="width:${pct}%; background:${s.tipo==='deuda'?'#dc2626':'#2563eb'}; height:100%;"></div>
                <div style="position:absolute; top:0; left:${pctIdeal}%; width:2px; height:100%; background:rgba(0,0,0,0.4);" title="Objetivo Hoy"></div>
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
    $('kmActual').innerText = `${store.parametros.ultimoKM} km`;
    if ($('metaDiariaValor')) $('metaDiariaValor').innerText = fmtMoney(store.parametros.metaDiaria || 0);
    
    // Turno
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

    // Recurrentes UI
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

    // Deudas UI
    const ul = $('listaDeudasAdmin');
    if(ul) {
        ul.innerHTML = store.deudas.map(d => `<li style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #eee;"><span>${d.desc}</span><span style="font-weight:bold; color:${d.saldo>0?'var(--danger)':'var(--success)'}">${fmtMoney(d.saldo)}</span></li>`).join('');
    }
    
    // Select Deudas (CORREGIDO PARA QUE EL BOTÓN FUNCIONE)
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

/* -------------------------------------------------------------
   SECCIÓN 5: ORQUESTADOR
   ------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 V7.2 DEBT FIX INITIALIZED");
    loadData();
    
    const page = document.body.dataset.page;
    if (page === 'index') renderIndex();
    if (page === 'wallet') renderWallet();
    if (page === 'historial') renderHistorial();
    if (page === 'admin') {
        renderAdmin();
        $('btnTurnoIniciar').onclick = () => { store.turnoActivo = { inicio: Date.now() }; saveData(); renderAdmin(); };
        $('btnTurnoFinalizar').onclick = () => Modal.show("Fin Turno", [{label:"KM Final",key:"k",type:"number"},{label:"Ganancia Total",key:"g",type:"number"}], d => actionFinalizarTurno(d.k, d.g));
        $('btnGasolina').onclick = () => Modal.show("Gasolina", [{label:"Litros",key:"l",type:"number"},{label:"Costo ($)",key:"c",type:"number"},{label:"KM Actual",key:"k",type:"number"}], d => actionGasolina(d.l, d.c, d.k));
        
        const gastoWiz = (g) => Modal.show(`Nuevo ${g}`, [{label:"Descripción",key:"d"},{label:"Monto",key:"m",type:"number"},{label:"Categoría",key:"c",type:"select",options:CATEGORIAS[g.toLowerCase()].map(x=>({val:x,txt:x}))},{label:"Frecuencia",key:"f",type:"select",options:Object.keys(FRECUENCIAS).map(x=>({val:x,txt:x}))}], d => actionNuevoGasto(d.d, d.m, d.c, d.f));
        $('btnGastoHogar').onclick = () => gastoWiz('Hogar');
        $('btnGastoOperativo').onclick = () => gastoWiz('Operativo');
        
        // CORREGIDO: Botón Nueva Deuda con Día de Pago (dp)
        $('btnDeudaNueva').onclick = () => Modal.show("Nueva Deuda", [
            {label:"Nombre",key:"d"},
            {label:"Total Deuda",key:"t",type:"number"},
            {label:"Cuota Mensual",key:"c",type:"number"},
            {label:"Frecuencia",key:"f",type:"select",options:Object.keys(FRECUENCIAS).map(x=>({val:x,txt:x}))},
            {label:"Día de Pago",key:"dp",type:"select",options:DIAS_SEMANA} // NUEVO CAMPO
        ], d => actionNuevaDeuda(d.d, d.t, d.c, d.f, d.dp));
        
             // CORREGIDO: Botón Abono con Validación
        $('btnAbonoCuota').onclick = () => { 
            const v = $('abonoDeudaSelect').value; 
            if(!v) return alert("⚠️ Selecciona una deuda primero");
            if(confirm("¿Confirmar abono de cuota?")) actionAbonarDeuda(v); 
        };

        $('btnExportJSON').onclick = () => navigator.clipboard.writeText(JSON.stringify(store)).then(() => alert("Copiado"));
        $('btnRestoreBackup').onclick = () => Modal.show("Restaurar", [{label:"Pegar JSON",key:"j"}], d => { try { store = {...INITIAL_STATE, ...JSON.parse(d.j)}; sanearDatos(); location.reload(); } catch(e){ alert("JSON Inválido"); } });
        $('btnConfigKM').onclick = () => alert("🔒 El kilometraje se actualiza automáticamente.");
    }
});
