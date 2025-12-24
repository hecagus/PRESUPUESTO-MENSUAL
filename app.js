/* =========================================
   APP.JS - BLOQUE 1/3 (CORE & ACUMULACIÓN)
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

// --- MOTOR DE INTEGRIDAD ---
function sanearDatos() {
    if(!Array.isArray(store.movimientos)) store.movimientos = [];
    if(!Array.isArray(store.cargasCombustible)) store.cargasCombustible = [];
    if(!Array.isArray(store.deudas)) store.deudas = [];
    if(!store.wallet) store.wallet = { saldo: 0, sobres: [], historial: [] };
    
    // 1. RECALCULAR SALDO REAL (Fuente Matemática)
    let saldoCalculado = 0;
    store.movimientos.forEach(m => {
        if(m.tipo === 'ingreso') saldoCalculado += safeFloat(m.monto);
        if(m.tipo === 'gasto') saldoCalculado -= safeFloat(m.monto);
    });
    store.cargasCombustible.forEach(c => saldoCalculado -= safeFloat(c.costo));
    store.wallet.saldo = saldoCalculado;

    // 2. EFICIENCIA REAL GASOLINA (Histórica)
    const totalGas = store.cargasCombustible.reduce((a,b)=>a+safeFloat(b.costo),0);
    const kmsGas = store.cargasCombustible.length > 1 ? 
        (Math.max(...store.cargasCombustible.map(c=>c.km)) - Math.min(...store.cargasCombustible.map(c=>c.km))) : 0;
    if(kmsGas > 100) store.parametros.costoPorKm = (totalGas / kmsGas).toFixed(2);

    // 3. GENERAR SOBRES (Modelo V3)
    actualizarSobresEstructural();

    // 4. ACUMULACIÓN DIARIA
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
        // Actualizar datos base
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
    if (store.parametros.ultimoProcesamiento === hoy) return; // Ya se procesó hoy

    console.log("🔄 Procesando acumulación diaria...");
    
    store.wallet.sobres.forEach(s => {
        if(s.acumulado >= s.meta) return; // Ya está lleno

        let diasRestantes = 1; // Default
        const hoyObj = new Date();
        const diaSemana = hoyObj.getDay(); // 0 Dom - 6 Sab

        if(s.frecuencia === 'Semanal' && s.diaPago) {
            let target = parseInt(s.diaPago);
            let diff = target - diaSemana;
            if(diff < 0) diff += 7;
            diasRestantes = diff === 0 ? 1 : diff + 1; // +1 para incluir hoy
        } else if(s.frecuencia === 'Mensual') {
             diasRestantes = 30; // Simplificado para mensual
        } else if(s.frecuencia === 'Diario') {
             diasRestantes = 1;
        }

        // Cálculo Cuota Diaria
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
        } catch(e) { console.error(e); alert("Datos recuperados parcialmente."); }
    }
}
function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
/* FIN PARTE 1 - SIGUE PARTE 2 */
/* =========================================
   APP.JS - BLOQUE 2/3 (LÓGICA Y REPORTES)
   ========================================= */

// --- GENERADOR DE REPORTES ---
function generarReporteSemanal() {
    // 1. Datos Financieros
    const saldoTotal = safeFloat(store.wallet.saldo);
    let comprometido = 0;
    store.wallet.sobres.forEach(s => comprometido += safeFloat(s.acumulado)); // Lo acumulado es lo comprometido hoy
    const libre = saldoTotal - comprometido;
    
    // 2. Eficiencia
    const eficiencia = store.parametros.costoPorKm || 0;

    // 3. Generar Gráfica de Barras (HTML Puro)
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

    // 4. Generar Gráfica de Línea (SVG Simple) - Últimos 7 días
    // Recopilar ingresos vs gastos
    const ultimos7 = {};
    for(let i=6; i>=0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        ultimos7[d.toISOString().split('T')[0]] = {ing:0, gas:0};
    }
    store.movimientos.forEach(m => {
        const fecha = m.fecha.split('T')[0];
        if(ultimos7[fecha]) {
            if(m.tipo==='ingreso') ultimos7[fecha].ing += safeFloat(m.monto);
            else ultimos7[fecha].gas += safeFloat(m.monto);
        }
    });
    // Convertir a coordenadas SVG
    const puntosIng = Object.values(ultimos7).map((v, i) => `${i * 40},${100 - (v.ing/10)}`).join(' '); // Escala simple
    const puntosGas = Object.values(ultimos7).map((v, i) => `${i * 40},${100 - (v.gas/10)}`).join(' ');

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
            
            <div style="margin-bottom:15px; font-size:0.9rem;">
                <strong>⛽ Eficiencia:</strong> $${eficiencia} / km
            </div>

            <h4 style="margin:0 0 10px 0;">Estado de Sobres</h4>
            <div style="margin-bottom:20px;">${barrasHTML || 'Sin sobres activos'}</div>

            <h4 style="margin:0 0 10px 0;">Tendencia (7 días)</h4>
            <svg viewBox="0 0 240 100" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; width:100%;">
                <polyline fill="none" stroke="#22c55e" stroke-width="2" points="${puntosIng}" />
                <polyline fill="none" stroke="#ef4444" stroke-width="2" points="${puntosGas}" />
            </svg>
            <div style="display:flex; justify-content:center; gap:15px; font-size:0.75rem; margin-top:5px;">
                <span style="color:#22c55e">● Ingresos</span>
                <span style="color:#ef4444">● Gastos</span>
            </div>
        </div>
    `;
    Modal.showHtml("Reporte Semanal", html);
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

    // NO BLOQUEAR PAGOS
    const val = safeFloat(monto);
    d.saldo -= val;
    if(d.saldo < 0) d.saldo = 0;

    // Resetear acumulado del sobre correspondiente
    const s = store.wallet.sobres.find(x => x.refId === id);
    if(s) {
        s.acumulado = 0; // Reiniciar acumulación tras pago
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
    // Costo es histórico, pero permitimos ajuste manual si no hay historial
    if(store.cargasCombustible.length < 2) store.parametros.costoPorKm = safeFloat(costo);
    sanearDatos(); 
}

/* FIN PARTE 2 - SIGUE PARTE 3 */
/* =========================================
   /* =========================================
   APP.JS - BLOQUE 3/3 (UI Y ARRANQUE)
   ========================================= */

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
    // Meta diaria ahora es dinámica basada en sobres, no estática
    const metaHoy = store.wallet.sobres.reduce((a,b) => a + (b.meta - b.acumulado > 0 ? (b.meta/7) : 0), 0) + (120 * safeFloat(store.parametros.costoPorKm));
    if($('metaDiariaValor')) $('metaDiariaValor').innerText = fmtMoney(metaHoy);

    if($('turnoEstado')) $('turnoEstado').innerHTML = store.turnoActivo ? `<span style="color:green">🟢 EN CURSO</span>` : `🔴 Detenido`;
    
    // Inyectar Botón Reporte
    const zone = document.querySelector('#btnExportJSON')?.parentNode;
    if(zone && !document.getElementById('btnVerReporte')) {
        const btn = document.createElement('button');
        btn.id = 'btnVerReporte'; btn.className = 'btn btn-primary'; btn.style.marginBottom='10px';
        btn.innerText = '📈 Ver Reporte y Gráficas';
        btn.onclick = generarReporteSemanal;
        zone.prepend(btn);
    }
    
    // Render lista deudas admin
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
    console.log("🚀 APP V3 SOBRES AVANZADOS");
    loadData();
    const page = document.body.dataset.page;
    document.querySelectorAll('.nav-link').forEach(l => { if(l.getAttribute('href').includes(page)) l.classList.add('active'); });

    // --- ALERTAS INFORMATIVAS ---
    if(page === 'index' || page === 'admin') {
        const sobresUrgentes = store.wallet.sobres.filter(s => {
            // Lógica: Si faltan menos de 2 días para llenarlo y falta $
            if(s.acumulado >= s.meta) return false;
            if(s.frecuencia === 'Semanal') {
                const hoy = new Date().getDay();
                const target = parseInt(s.diaPago || 0);
                let diff = target - hoy; if(diff < 0) diff += 7;
                return diff <= 1; // Vence hoy o mañana
            }
            return false;
        });
        if(sobresUrgentes.length > 0) {
            // Inyectar alerta visual no intrusiva
            const main = document.querySelector('main');
            if(main && !document.getElementById('alertBox')) {
                const div = document.createElement('div'); div.id = 'alertBox';
                div.style = "background:#fff7ed; border:1px solid #f97316; padding:10px; margin:10px; border-radius:8px; font-size:0.9rem";
                div.innerHTML = `⚠️ <strong>Atención:</strong> ${sobresUrgentes.map(s => `${s.desc} vence pronto`).join(', ')}`;
                main.prepend(div);
            }
        }
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

    if(page === 'index') {
        const hoy = new Date().toDateString();
        const gan = store.turnos.filter(t => new Date(t.fecha).toDateString() === hoy).reduce((a,b)=>a+b.ganancia,0);
        if($('resGananciaBruta')) $('resGananciaBruta').innerText = fmtMoney(gan);
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
                           
