/* =========================================
   APP.JS - ARCHIVO MAESTRO V3.4 (CALENDARIO SINCRONIZADO)
   ========================================= */

// --- CONSTANTES ---
const STORAGE_KEY = "moto_finanzas_vFinal";
const SCHEMA_VERSION = 3;

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

// Utilidades
const $ = (id) => document.getElementById(id);
const safeFloat = (val) => { const n = parseFloat(val); return isFinite(n) ? n : 0; };
const fmtMoney = (amount) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount || 0);
const uuid = () => Date.now().toString(36) + Math.random().toString(36).substr(2);
const getFechaHoy = () => new Date().toISOString().split('T')[0];

// --- STATE ---
const INITIAL_STATE = {
    schemaVersion: SCHEMA_VERSION,
    turnos: [], movimientos: [], cargasCombustible: [], 
    deudas: [], gastosFijosMensuales: [],
    wallet: { saldo: 0, sobres: [], historial: [] },
    parametros: { 
        metaDiaria: 0, ultimoKM: 0, costoPorKm: 0, 
        promedioDiarioKm: 120, ultimoProcesamiento: null 
    },
    turnoActivo: null
};

let store = JSON.parse(JSON.stringify(INITIAL_STATE));

// --- MOTOR DE INTEGRIDAD Y SANEAMIENTO ---
function sanearDatos() {
    // Protección anti-crash
    if(!Array.isArray(store.movimientos)) store.movimientos = [];
    if(!Array.isArray(store.cargasCombustible)) store.cargasCombustible = [];
    if(!Array.isArray(store.turnos)) store.turnos = [];
    if(!Array.isArray(store.deudas)) store.deudas = [];
    if(!store.wallet) store.wallet = { saldo: 0, sobres: [], historial: [] };
    if(!Array.isArray(store.wallet.sobres)) store.wallet.sobres = [];
    
    // 1. RECALCULAR SALDO REAL (Fuente Matemática)
    let saldoCalculado = 0;
    store.movimientos.forEach(m => {
        if(m.tipo === 'ingreso') saldoCalculado += safeFloat(m.monto);
        if(m.tipo === 'gasto') saldoCalculado -= safeFloat(m.monto);
    });
    store.cargasCombustible.forEach(c => saldoCalculado -= safeFloat(c.costo));
    store.wallet.saldo = saldoCalculado;

    // 2. EFICIENCIA REAL GASOLINA
    const totalGas = store.cargasCombustible.reduce((a,b)=>a+safeFloat(b.costo),0);
    const kmsGas = store.cargasCombustible.length > 1 ? 
        (Math.max(...store.cargasCombustible.map(c=>c.km)) - Math.min(...store.cargasCombustible.map(c=>c.km))) : 0;
    if(kmsGas > 100) store.parametros.costoPorKm = (totalGas / kmsGas).toFixed(2);

    // 3. BLINDAJE KM
    const maxTurno = store.turnos.length > 0 ? Math.max(...store.turnos.map(t=>t.kmFinal||0)) : 0;
    const maxGas = store.cargasCombustible.length > 0 ? Math.max(...store.cargasCombustible.map(c=>c.km||0)) : 0;
    const maxLogico = Math.max(store.parametros.ultimoKM || 0, maxTurno, maxGas);
    store.parametros.ultimoKM = maxLogico;

    // 4. SINCRONIZAR ESTRUCTURA DE SOBRES
    actualizarSobresEstructural();

    // 5. RECALCULAR ACUMULADOS POR CALENDARIO (CORRECCIÓN UBER)
    recalcularSobresPorCalendario();
}

function actualizarSobresEstructural() {
    const crearSobre = (refId, tipo, desc, meta, freq, diaPago) => {
        let s = store.wallet.sobres.find(x => x.refId === refId);
        if(!s) {
            s = { id: uuid(), refId, tipo, desc, acumulado: 0, ultimoCalculo: getFechaHoy() };
            store.wallet.sobres.push(s);
        }
        s.meta = safeFloat(meta);
        s.frecuencia = freq;
        s.diaPago = diaPago;
        // Corrección de nombre si cambió en la deuda
        s.desc = desc;
    };

    store.deudas.forEach(d => {
        if(d.saldo > 0) crearSobre(d.id, 'deuda', d.desc, d.montoCuota, d.frecuencia, d.diaPago);
    });
    store.gastosFijosMensuales.forEach(g => {
        crearSobre(g.id, 'gasto', g.desc, g.monto, g.frecuencia);
    });
    
    // Eliminar sobres de deudas pagadas o gastos borrados
    store.wallet.sobres = store.wallet.sobres.filter(s => {
        if(s.tipo === 'deuda') return store.deudas.some(d => d.id === s.refId && d.saldo > 0.1);
        if(s.tipo === 'gasto') return store.gastosFijosMensuales.some(g => g.id === s.refId);
        return false;
    });
}

function recalculareSobresPorCalendario() {
    // Esta función fuerza el acumulado correcto según el día de la semana
    const hoyObj = new Date();
    const hoyIndex = hoyObj.getDay(); // 0 Dom - 6 Sab
    const diaDelMes = hoyObj.getDate();

    store.wallet.sobres.forEach(s => {
        // Solo recalcular deudas semanales o gastos mensuales, no diarios (diarios se reinician al gasto)
        if (s.frecuencia === 'Semanal' && s.diaPago) {
            const pagoIndex = parseInt(s.diaPago);
            
            // Lógica: Cuántos días han pasado desde el inicio del ciclo (día posterior al pago)
            // Ciclo: Si pago Domingo(0), ciclo empieza Lunes(1).
            // Si hoy es Miércoles(3): Pasaron Lunes, Martes, Miércoles = 3 días.
            let diasTranscurridos = hoyIndex - pagoIndex;
            if (diasTranscurridos <= 0) diasTranscurridos += 7;
            
            // Si hoy es el día de pago, debería estar al 100%
            // Si es el día siguiente, debería estar al 1/7
            
            const montoIdeal = (s.meta / 7) * diasTranscurridos;
            
            // Solo actualizamos si el cálculo matemático es mayor a lo que tiene
            // Esto corrige el déficit, pero respeta si metiste dinero extra manual (si existiera esa función)
            // Para ser estrictos con tu regla: IMPONEMOS el cálculo matemático.
            s.acumulado = montoIdeal;
            
            if(s.acumulado > s.meta) s.acumulado = s.meta;
        }
        
        if (s.frecuencia === 'Mensual') {
             // Lógica lineal simple: (Meta / 30) * Día del mes
             // Esto asume corte a fin de mes.
             const montoIdeal = (s.meta / 30) * diaDelMes;
             s.acumulado = montoIdeal;
             if(s.acumulado > s.meta) s.acumulado = s.meta;
        }
        
        // Diarios: Se llenan al 100% cada día hasta que se gastan
        if (s.frecuencia === 'Diario') {
             if(s.acumulado < s.meta) s.acumulado = s.meta;
        }
    });
    saveData();
}

function loadData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw) {
        try {
            store = { ...INITIAL_STATE, ...JSON.parse(raw) };
            sanearDatos();
        } catch(e) { console.error(e); }
    }
}
function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }


// --- REPORTES ---

function generarResumenHumanoHoy(store) {
    const saldoTotal = safeFloat(store.wallet.saldo);
    let saldoComprometido = 0;
    store.wallet.sobres.forEach(s => saldoComprometido += safeFloat(s.acumulado));
    const saldoLibre = saldoTotal - saldoComprometido;
    
    let recomendacionesHTML = '';
    
    // Generar recomendaciones solo para lo que falta
    store.wallet.sobres.forEach(s => {
        const pendiente = s.meta - s.acumulado;
        if (pendiente > 1) {
             recomendacionesHTML += `<li style="margin-bottom:6px; font-size:0.9rem;">Faltan <strong>${fmtMoney(pendiente)}</strong> para completar <em>${s.desc}</em>.</li>`;
        }
    });

    if (!recomendacionesHTML) recomendacionesHTML = '<li>¡Sobres al día según calendario!</li>';

    return `
        <div style="background:#f8fafc; padding:15px; border-radius:12px; margin-bottom:20px; border:1px solid #e2e8f0; margin-top:15px;">
            <h3 style="margin:0 0 10px 0; font-size:1.1rem; color:#1e293b;">Resumen Financiero</h3>
            <p style="margin-bottom:10px; font-size:0.95rem; line-height:1.5;">
                Tienes un total de <strong>${fmtMoney(saldoTotal)}</strong>.<br>
                Comprometido (Calculado por fecha): <span style="color:#f59e0b; font-weight:bold;">${fmtMoney(saldoComprometido)}</span>.<br>
                Saldo Libre Real: <span style="color:${saldoLibre>=0?'#16a34a':'#dc2626'}; font-weight:bold;">${fmtMoney(saldoLibre)}</span>.
            </p>
            <div style="background:#fff; padding:10px; border-radius:8px; border:1px solid #cbd5e1;">
                <strong style="color:#334155; font-size:0.85rem; text-transform:uppercase;">Estado de Metas:</strong>
                <ul style="margin:5px 0 0 20px; color:#475569;">${recomendacionesHTML}</ul>
            </div>
        </div>
    `;
}

function generarReporteSemanal() {
    const saldoTotal = safeFloat(store.wallet.saldo);
    let comprometido = 0;
    store.wallet.sobres.forEach(s => comprometido += safeFloat(s.acumulado));
    const libre = saldoTotal - comprometido;
    const eficiencia = store.parametros.costoPorKm || 0;

    let barrasHTML = '';
    store.wallet.sobres.forEach(s => {
        const pct = Math.min((s.acumulado / s.meta) * 100, 100);
        const color = s.tipo === 'deuda' ? '#ef4444' : '#3b82f6';
        barrasHTML += `
            <div style="margin-bottom:8px; font-size:0.8rem;">
                <div style="display:flex; justify-content:space-between;">
                    <span>${s.desc}</span>
                    <span>${fmtMoney(s.acumulado)} / ${fmtMoney(s.meta)}</span>
                </div>
                <div style="background:#e2e8f0; height:8px; border-radius:4px; margin-top:2px;">
                    <div style="width:${pct}%; background:${color}; height:100%; border-radius:4px;"></div>
                </div>
            </div>`;
    });

    const html = `
        <div style="font-family:sans-serif; color:#334155;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; text-align:center; margin-bottom:15px;">
                <div style="background:#f0fdf4; padding:10px; border-radius:8px; border:1px solid #bbf7d0;">
                    <small>Libre</small><br><strong style="color:#16a34a; font-size:1.1rem">${fmtMoney(libre)}</strong>
                </div>
                <div style="background:#fff7ed; padding:10px; border-radius:8px; border:1px solid #fed7aa;">
                    <small>Comprometido</small><br><strong style="color:#f97316; font-size:1.1rem">${fmtMoney(comprometido)}</strong>
                </div>
            </div>
            <div style="margin-bottom:15px; font-size:0.9rem;"><strong>⛽ Eficiencia:</strong> $${eficiencia} / km</div>
            <h4 style="margin:0 0 10px 0;">Estado de Sobres (Hoy)</h4>
            <div style="margin-bottom:20px;">${barrasHTML || 'Sin sobres activos'}</div>
        </div>
    `;
    Modal.showHtml("Reporte Semanal", html);
}

function renderHistorialBlindado(store) {
    const tbody = document.getElementById('tablaBody');
    if (!tbody) return;
    if (!store.movimientos || store.movimientos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:20px; color:#94a3b8;">Sin movimientos registrados</td></tr>`;
        return;
    }
    const movs = [...store.movimientos].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 50);
    tbody.innerHTML = movs.map(m => {
        const fecha = new Date(m.fecha).toLocaleDateString('es-MX', {day: '2-digit', month: 'short'});
        const esIngreso = m.tipo === 'ingreso';
        const color = esIngreso ? '#16a34a' : '#ef4444'; 
        const signo = esIngreso ? '+' : '-';
        return `<tr><td style="color:#64748b; font-size:0.85rem;">${fecha}</td><td><div style="font-weight:600; font-size:0.9rem; color:#334155;">${m.desc}</div><div style="font-size:0.75rem; color:#94a3b8;">${m.categoria || 'General'}</div></td><td style="text-align:right; font-weight:bold; color:${color};">${signo}${fmtMoney(m.monto)}</td></tr>`;
    }).join('');
}

// --- OPERACIONES ---

function finalizarTurno(kmFinal, ganancia) {
    const kF = safeFloat(kmFinal);
    if(kF < store.parametros.ultimoKM) return alert("⛔ El KM no puede ser menor al actual.");
    store.turnos.push({ id: uuid(), fecha: new Date().toISOString(), ganancia: safeFloat(ganancia), kmRecorrido: kF - store.parametros.ultimoKM, kmFinal: kF });
    store.movimientos.push({ id: uuid(), fecha: new Date().toISOString(), tipo: 'ingreso', desc: 'Turno', monto: safeFloat(ganancia) });
    store.parametros.ultimoKM = kF;
    store.turnoActivo = null;
    sanearDatos();
}

function abonarDeuda(id, monto) {
    if(!id) return;
    const d = store.deudas.find(x => x.id == id);
    if(!d) return;
    const val = safeFloat(monto);
    d.saldo -= val;
    if(d.saldo < 0) d.saldo = 0;
    
    // Al pagar, el sobre se vacía porque la obligación se cumplió (o se reduce proporcionalmente)
    // En este modelo, si pagas, el acumulado se reinicia para el siguiente ciclo
    const s = store.wallet.sobres.find(x => x.refId === id);
    if(s) s.acumulado = 0;

    store.movimientos.push({ id: uuid(), fecha: new Date().toISOString(), tipo: 'gasto', desc: `Pago: ${d.desc}`, monto: val, categoria: 'Deuda' });
    sanearDatos();
}

function registrarGasolina(l, c, k) {
    store.cargasCombustible.push({ id: uuid(), fecha: new Date().toISOString(), litros:l, costo:c, km:k });
    if(k > store.parametros.ultimoKM) store.parametros.ultimoKM = k;
    sanearDatos();
}

function procesarGasto(desc, monto, grupo, cat, freq) {
    const id = uuid();
    const m = safeFloat(monto);
    if(freq !== 'Unico') store.gastosFijosMensuales.push({ id, desc, monto: m, categoria: cat, frecuencia: freq });
    store.movimientos.push({ id, fecha: new Date().toISOString(), tipo: 'gasto', desc, monto: m, categoria: cat });
    
    // VACIADO INTELIGENTE
    store.wallet.sobres.forEach(s => {
        if(s.tipo === 'gasto') {
            const gastoFijo = store.gastosFijosMensuales.find(gf => gf.id === s.refId);
            if(gastoFijo && gastoFijo.categoria === cat) {
                s.acumulado -= m;
                if(s.acumulado < 0) s.acumulado = 0;
            }
        }
    });
    sanearDatos();
}

function agregarDeuda(desc, total, cuota, freq, diaPago) {
    store.deudas.push({ id: uuid(), desc, montoTotal: total, montoCuota: cuota, frecuencia: freq, diaPago, saldo: total });
    sanearDatos();
}

function updateConfigVehiculo(km, costo) { 
    if(safeFloat(km) < store.parametros.ultimoKM) return alert("⛔ KM inválido");
    store.parametros.ultimoKM = safeFloat(km);
    if(store.cargasCombustible.length < 2) store.parametros.costoPorKm = safeFloat(costo);
    sanearDatos(); 
}


// --- UI ---

const Modal = {
    showInput: (title, inputsConfig, onConfirm) => {
        const modal = $('appModal');
        $('modalTitle').innerText = title;
        $('modalBody').innerHTML = '';
        const values = {};
        inputsConfig.forEach(conf => {
            const div = document.createElement('div');
            div.innerHTML = `<label style="display:block;font-size:0.8rem;color:#666;margin-top:5px">${conf.label}</label>`;
            const input = document.createElement(conf.type === 'select' ? 'select' : 'input');
            input.className = 'input-control'; input.style.width = '100%'; input.style.padding='8px';
            if(conf.type === 'select') conf.options.forEach(o => { const op=document.createElement('option'); op.value=o.value; op.innerText=o.text; input.appendChild(op); });
            else { input.type = conf.type || 'text'; if(conf.value !== undefined) input.value = conf.value; }
            input.onchange = (e) => values[conf.key] = e.target.value;
            div.appendChild(input); $('modalBody').appendChild(div);
        });
        $('modalConfirm').onclick = () => {
            const inputs = $('modalBody').querySelectorAll('input, select');
            inputs.forEach((inp, i) => values[inputsConfig[i].key] = inp.value);
            if(onConfirm(values) !== false) modal.style.display = 'none';
        };
        $('modalCancel').style.display = 'block'; $('modalCancel').onclick = () => modal.style.display = 'none';
        modal.style.display = 'flex';
    },
    showHtml: (title, html) => {
        const modal = $('appModal');
        $('modalTitle').innerText = title;
        $('modalBody').innerHTML = html;
        $('modalConfirm').onclick = () => modal.style.display = 'none';
        $('modalCancel').style.display = 'none';
        modal.style.display = 'flex';
    }
};

function updateAdminUI() {
    if($('kmActual')) $('kmActual').innerText = `${store.parametros.ultimoKM} km`;
    // Meta diaria dinámica (sobres + gasolina)
    const metaHoy = store.wallet.sobres.reduce((a,b) => a + (b.meta - b.acumulado > 0 ? (b.meta/7) : 0), 0) + (120 * safeFloat(store.parametros.costoPorKm));
    if($('metaDiariaValor')) $('metaDiariaValor').innerText = fmtMoney(metaHoy);
    if($('turnoEstado')) $('turnoEstado').innerHTML = store.turnoActivo ? `<span style="color:green">🟢 EN CURSO</span>` : `🔴 Detenido`;
    
    const zone = document.querySelector('#btnExportJSON')?.parentNode;
    if(zone && !document.getElementById('btnVerReporte')) {
        const btn = document.createElement('button');
        btn.id = 'btnVerReporte'; btn.className = 'btn btn-primary'; btn.style.marginBottom='10px';
        btn.innerText = '📈 Ver Reporte';
        btn.onclick = generarReporteSemanal;
        zone.prepend(btn);
    }
    
    const list = $('listaDeudasAdmin'); const sel = $('abonoDeudaSelect');
    if(list && sel) {
        list.innerHTML = ''; sel.innerHTML = '<option value="">-- Pagar Deuda --</option>';
        store.deudas.forEach(d => {
            if(d.saldo < 1) return;
            const li = document.createElement('li'); li.className = 'list-item';
            li.innerHTML = `<span>${d.desc}</span> <strong>${fmtMoney(d.saldo)}</strong>`;
            list.appendChild(li);
            const opt = document.createElement('option'); opt.value = d.id; opt.innerText = d.desc; sel.appendChild(opt);
        });
    }
}

function init() {
    console.log("🚀 APP V3.4 DEFINITIVA (CALENDAR SYNC)");
    loadData();
    const page = document.body.dataset.page;
    document.querySelectorAll('.nav-link').forEach(l => { if(l.getAttribute('href').includes(page)) l.classList.add('active'); });

    if(page === 'index') {
        const hoy = new Date().toDateString();
        const gan = store.turnos.filter(t => new Date(t.fecha).toDateString() === hoy).reduce((a,b)=>a+b.ganancia,0);
        if($('resGananciaBruta')) $('resGananciaBruta').innerText = fmtMoney(gan);

        const main = document.querySelector('main.container');
        let resumenDiv = document.getElementById('resumenHumano');
        if (!resumenDiv && main) {
            resumenDiv = document.createElement('div');
            resumenDiv.id = 'resumenHumano';
            const primerCard = main.querySelector('.card');
            if(primerCard) primerCard.insertAdjacentElement('afterend', resumenDiv);
            else main.prepend(resumenDiv);
        }
        if (resumenDiv) resumenDiv.innerHTML = generarResumenHumanoHoy(store);
    }

    if(page === 'historial') {
        renderHistorialBlindado(store);
    }

    if(page === 'admin') {
        updateAdminUI();
        setInterval(() => { if($('turnoTimer') && store.turnoActivo) {
            const diff = Date.now() - store.turnoActivo.inicio;
            const h = Math.floor(diff/3600000); const m = Math.floor((diff%3600000)/60000);
            $('turnoTimer').innerText = `${h}h ${m}m`;
        }}, 1000);
        const bind = (id, fn) => { const el=$(id); if(el) el.onclick = (e) => { e.preventDefault(); fn(); updateAdminUI(); }; };
        bind('btnConfigKM', () => Modal.showInput("Ajustar", [{label:"KM", key:"k", type:"number", value:store.parametros.ultimoKM}], d=>updateConfigVehiculo(d.k, 0)));
        bind('btnTurnoIniciar', () => { if(!store.turnoActivo) { store.turnoActivo={inicio:Date.now()}; saveData(); updateAdminUI(); }});
        bind('btnTurnoFinalizar', () => Modal.showInput("Fin Turno", [{label:"KM Final", key:"km", type:"number"}, {label:"Ganancia", key:"g", type:"number"}], d=>finalizarTurno(d.km, d.g)));
        const wiz = (grp) => Modal.showInput(`Gasto ${grp}`, [{label:"Desc", key:"d"}, {label:"$$", key:"m", type:"number"}, {label:"Cat", key:"c", type:"select", options:CATEGORIAS[grp.toLowerCase()].map(x=>({value:x, text:x}))}, {label:"Freq", key:"f", type:"select", options:Object.keys(FRECUENCIAS).map(x=>({value:x, text:x}))}], d=>procesarGasto(d.d, d.m, grp, d.c, d.f));
        bind('btnGastoHogar', () => wiz('Hogar')); bind('btnGastoOperativo', () => wiz('Operativo'));
        bind('btnGasolina', () => Modal.showInput("Gasolina", [{label:"Litros", key:"l", type:"number"}, {label:"$$ Total", key:"c", type:"number"}, {label:"KM", key:"k", type:"number"}], d=>registrarGasolina(d.l, d.c, d.k)));
        bind('btnDeudaNueva', () => Modal.showInput("Deuda", [{label:"Nombre", key:"n"}, {label:"Total", key:"t", type:"number"}, {label:"Cuota", key:"c", type:"number"}, {label:"Freq", key:"f", type:"select", options:Object.keys(FRECUENCIAS).map(x=>({value:x, text:x}))}, {label:"Día Pago", key:"dp", type:"select", options:DIAS_SEMANA}], d=>agregarDeuda(d.n, d.t, d.c, d.f, d.dp)));
        bind('btnAbonoCuota', () => { const id = $('abonoDeudaSelect').value; if(id) abonarDeuda(id, store.deudas.find(x=>x.id==id)?.montoCuota); });
        bind('btnExportJSON', () => navigator.clipboard.writeText(JSON.stringify(store)).then(()=>alert("Copiado")));
        bind('btnRestoreBackup', () => Modal.showInput("Restaurar", [{label:"JSON", key:"j"}], d=>{ try{store={...INITIAL_STATE,...JSON.parse(d.j)};sanearDatos();saveData();location.reload();}catch(e){alert("Error");} }));
    }
    
    if(page === 'wallet') {
        let comprometido = 0;
        store.wallet.sobres.forEach(s => comprometido += safeFloat(s.acumulado));
        const libre = store.wallet.saldo - comprometido;
        if($('valWallet')) $('valWallet').innerHTML = `${fmtMoney(store.wallet.saldo)}<br><small style="color:${libre>=0?'green':'orange'}">Libre: ${fmtMoney(libre)}</small>`;
        
        const main = document.querySelector('main.container');
        let cont = document.getElementById('sobresContainer');
        if(!cont && main) { cont=document.createElement('div'); cont.id='sobresContainer'; main.appendChild(cont); }
        if(cont) {
            cont.innerHTML = store.wallet.sobres.map(s => {
                const pct = Math.min((s.acumulado/s.meta)*100, 100);
                return `
                <div class="card" style="padding:12px; margin-top:10px; border-left:4px solid ${s.tipo==='deuda'?'#ef4444':'#3b82f6'}">
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px">
                        <strong>${s.desc}</strong>
                        <small>${fmtMoney(s.acumulado)} / ${fmtMoney(s.meta)}</small>
                    </div>
                    <div style="background:#e2e8f0; height:8px; border-radius:4px;"><div style="width:${pct}%; background:${s.tipo==='deuda'?'#ef4444':'#3b82f6'}; height:100%; border-radius:4px;"></div></div>
                </div>`;
            }).join('');
        }
    }
}
document.addEventListener('DOMContentLoaded', init);
