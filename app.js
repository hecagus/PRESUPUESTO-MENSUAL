/* =========================================
   APP.JS - ARCHIVO MAESTRO DEFINITIVO (V3.2)
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
    // Validar Arrays
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
    // La gasolina se resta porque sale del bolsillo (wallet)
    store.cargasCombustible.forEach(c => saldoCalculado -= safeFloat(c.costo));
    store.wallet.saldo = saldoCalculado;

    // 2. EFICIENCIA REAL GASOLINA (Histórica)
    const totalGas = store.cargasCombustible.reduce((a,b)=>a+safeFloat(b.costo),0);
    const kmsGas = store.cargasCombustible.length > 1 ? 
        (Math.max(...store.cargasCombustible.map(c=>c.km)) - Math.min(...store.cargasCombustible.map(c=>c.km))) : 0;
    if(kmsGas > 100) store.parametros.costoPorKm = (totalGas / kmsGas).toFixed(2);

    // 3. BLINDAJE KM
    const maxTurno = store.turnos.length > 0 ? Math.max(...store.turnos.map(t=>t.kmFinal||0)) : 0;
    const maxGas = store.cargasCombustible.length > 0 ? Math.max(...store.cargasCombustible.map(c=>c.km||0)) : 0;
    const maxLogico = Math.max(store.parametros.ultimoKM || 0, maxTurno, maxGas);
    store.parametros.ultimoKM = maxLogico;

    // 4. SINCRONIZAR SOBRES
    actualizarSobresEstructural();

    // 5. ACUMULACIÓN DIARIA
    procesarAcumulacionDiaria();
}

function actualizarSobresEstructural() {
    // Sincroniza deudas/gastos con sobres
    const crearSobre = (refId, tipo, desc, meta, freq, diaPago) => {
        let s = store.wallet.sobres.find(x => x.refId === refId);
        if(!s) {
            s = { id: uuid(), refId, tipo, desc, acumulado: 0, ultimoCalculo: getFechaHoy() };
            store.wallet.sobres.push(s);
        }
        s.meta = safeFloat(meta);
        s.frecuencia = freq;
        s.diaPago = diaPago;
    };

    store.deudas.forEach(d => {
        if(d.saldo > 0) crearSobre(d.id, 'deuda', d.desc, d.montoCuota, d.frecuencia, d.diaPago);
    });
    store.gastosFijosMensuales.forEach(g => {
        crearSobre(g.id, 'gasto', g.desc, g.monto, g.frecuencia);
    });
    
    // Limpieza de sobres huérfanos
    store.wallet.sobres = store.wallet.sobres.filter(s => {
        if(s.tipo === 'deuda') return store.deudas.some(d => d.id === s.refId && d.saldo > 0);
        if(s.tipo === 'gasto') return store.gastosFijosMensuales.some(g => g.id === s.refId);
        return false;
    });
}

function procesarAcumulacionDiaria() {
    const hoy = getFechaHoy();
    if (store.parametros.ultimoProcesamiento === hoy) return; 

    store.wallet.sobres.forEach(s => {
        if(s.acumulado >= s.meta) return; 

        let diasRestantes = 1; 
        const hoyObj = new Date();
        const diaSemana = hoyObj.getDay(); 

        if(s.frecuencia === 'Semanal' && s.diaPago) {
            let target = parseInt(s.diaPago);
            let diff = target - diaSemana;
            if(diff < 0) diff += 7;
            diasRestantes = diff === 0 ? 1 : diff + 1; 
        } else if(s.frecuencia === 'Mensual') {
             diasRestantes = 30; 
        }

        const faltante = s.meta - s.acumulado;
        const aporteHoy = faltante / diasRestantes;
        
        s.acumulado += safeFloat(aporteHoy);
        if(s.acumulado > s.meta) s.acumulado = s.meta;
    });

    store.parametros.ultimoProcesamiento = hoy;
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


// --- LÓGICA DE REPORTES (TEXTO Y VISUAL) ---

function generarResumenHumanoHoy(store) {
    const saldoTotal = safeFloat(store.wallet.saldo);
    let saldoComprometido = 0;
    store.wallet.sobres.forEach(s => saldoComprometido += safeFloat(s.acumulado));
    const saldoLibre = saldoTotal - saldoComprometido;
    
    let recomendacionesHTML = '';
    const hoyDia = new Date().getDay(); 

    store.wallet.sobres.forEach(s => {
        const meta = safeFloat(s.meta);
        const acumulado = safeFloat(s.acumulado);
        const pendiente = meta - acumulado;

        if (pendiente <= 1) return; 

        let diasRestantes = 1;
        if (s.frecuencia === 'Semanal') {
            const target = parseInt(s.diaPago || 0); 
            let diff = target - hoyDia;
            if (diff < 0) diff += 7;
            diasRestantes = diff === 0 ? 1 : diff; 
        } else if (s.frecuencia === 'Mensual') {
            diasRestantes = 30; 
        }

        const guardarHoy = pendiente / diasRestantes;
        recomendacionesHTML += `<li style="margin-bottom:6px; font-size:0.9rem;">Guardar <strong>${fmtMoney(guardarHoy)}</strong> para <em>${s.desc}</em>.</li>`;
    });

    if (!recomendacionesHTML) recomendacionesHTML = '<li>¡Todo cubierto!</li>';

    return `
        <div style="background:#f8fafc; padding:15px; border-radius:12px; margin-bottom:20px; border:1px solid #e2e8f0; margin-top:15px;">
            <h3 style="margin:0 0 10px 0; font-size:1.1rem; color:#1e293b;">Resumen Financiero</h3>
            <p style="margin-bottom:10px; font-size:0.95rem; line-height:1.5;">
                Tienes un total de <strong>${fmtMoney(saldoTotal)}</strong>.<br>
                Comprometido en sobres: <span style="color:#f59e0b; font-weight:bold;">${fmtMoney(saldoComprometido)}</span>.<br>
                Tu saldo real libre es: <span style="color:${saldoLibre>=0?'#16a34a':'#dc2626'}; font-weight:bold;">${fmtMoney(saldoLibre)}</span>.
            </p>
            <div style="background:#fff; padding:10px; border-radius:8px; border:1px solid #cbd5e1;">
                <strong style="color:#334155; font-size:0.85rem; text-transform:uppercase;">Meta de Ahorro para HOY:</strong>
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
            <h4 style="margin:0 0 10px 0;">Estado de Sobres</h4>
            <div style="margin-bottom:20px;">${barrasHTML || 'Sin sobres activos'}</div>
        </div>
    `;
    Modal.showHtml("Reporte Semanal", html);
}

function renderHistorialBlindado(store) {
    const tbody = document.getElementById('tablaBody');
    if (!tbody) return;

    // FUENTE DE VERDAD: store.movimientos
    if (!store.movimientos || store.movimientos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:20px; color:#94a3b8;">Sin movimientos registrados</td></tr>`;
        return;
    }

    // Ordenar descendente y mostrar últimos 50
    const movs = [...store.movimientos]
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .slice(0, 50);

    tbody.innerHTML = movs.map(m => {
        const fecha = new Date(m.fecha).toLocaleDateString('es-MX', {day: '2-digit', month: 'short'});
        const esIngreso = m.tipo === 'ingreso';
        const color = esIngreso ? '#16a34a' : '#ef4444'; 
        const signo = esIngreso ? '+' : '-';
        
        return `
            <tr>
                <td style="color:#64748b; font-size:0.85rem;">${fecha}</td>
                <td>
                    <div style="font-weight:600; font-size:0.9rem; color:#334155;">${m.desc}</div>
                    <div style="font-size:0.75rem; color:#94a3b8;">${m.categoria || 'General'}</div>
                </td>
                <td style="text-align:right; font-weight:bold; color:${color};">
                    ${signo}${fmtMoney(m.monto)}
                </td>
            </tr>
        `;
    }).join('');
}


// --- OPERACIONES ---

function finalizarTurno(kmFinal, ganancia) {
    const kF = safeFloat(kmFinal);
    if(kF < store.parametros.ultimoKM) return alert("⛔ El KM no puede ser menor al actual.");
    
    store.turnos.push({
        id: uuid(), fecha: new Date().toISOString(),
        ganancia: safeFloat(ganancia), kmRecorrido: kF - store.parametros.ultimoKM, kmFinal: kF
    });
    store.movimientos.push({
        id: uuid(), fecha: new Date().toISOString(), tipo: 'ingreso', desc: 'Turno', monto: safeFloat(ganancia)
    });
    store.parametros.ultimoKM = kF;
    store.turnoActivo = null;
    sanearDatos();
}

function abonarDeuda(id, monto) {
    if(!id) return;
    const d = store.deudas.find(x => x.id == id);
    if(!d) return;

    // Pago permitido siempre
    const val = safeFloat(monto);
    d.saldo -= val;
    if(d.saldo < 0) d.saldo = 0;

    // Resetear acumulado del sobre correspondiente
    const s = store.wallet.sobres.find(x => x.refId === id);
    if(s) {
        s.acumulado = 0; // Reiniciar
        s.ultimoCalculo = getFechaHoy();
    }

    store.movimientos.push({
        id: uuid(), fecha: new Date().toISOString(), tipo: 'gasto',
        desc: `Pago: ${d.desc}`, monto: val, categoria: 'Deuda'
    });
    sanearDatos();
}

function registrarGasolina(l, c, k) {
    store.cargasCombustible.push({ id: uuid(), fecha: new Date().toISOString(), litros:l, costo:c, km:k });
    if(k > store.parametros.ultimoKM) store.parametros.ultimoKM = k;
    sanearDatos();
}

function procesarGasto(desc, monto, grupo, cat, freq) {
    const id = uuid();
    if(freq !== 'Unico') store.gastosFijosMensuales.push({ id, desc, monto, categoria: cat, frecuencia: freq });
    store.movimientos.push({ id, fecha: new Date().toISOString(), tipo: 'gasto', desc, monto, categoria: cat });
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

// --- UI Y ARRANQUE ---

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
    
    // Meta diaria ahora es dinámica basada en sobres
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
    console.log("🚀 APP V3.2 DEFINITIVA");
    loadData();
    const page = document.body.dataset.page;
    document.querySelectorAll('.nav-link').forEach(l => { if(l.getAttribute('href').includes(page)) l.classList.add('active'); });

    // --- PANEL (INDEX) ---
    if(page === 'index') {
        const hoy = new Date().toDateString();
        const gan = store.turnos.filter(t => new Date(t.fecha).toDateString() === hoy).reduce((a,b)=>a+b.ganancia,0);
        if($('resGananciaBruta')) $('resGananciaBruta').innerText = fmtMoney(gan);

        // Inyectar Resumen Humano
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

    // --- HISTORIAL ---
    if(page === 'historial') {
        renderHistorialBlindado(store);
    }

    // --- ADMIN ---
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
    
    // --- WALLET ---
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
