/* =========================================
   APP.JS - BLOQUE 1/3 (CEREBRO V3)
   ========================================= */

// --- CONSTANTES ---
const STORAGE_KEY = "moto_finanzas_vFinal";
const SCHEMA_VERSION = 2;

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

// --- STATE ---
const INITIAL_STATE = {
    schemaVersion: SCHEMA_VERSION,
    turnos: [], movimientos: [], cargasCombustible: [], 
    deudas: [], gastosFijosMensuales: [],
    wallet: { saldo: 0, sobres: [], historial: [] },
    parametros: { metaDiaria: 0, ultimoKM: 0, costoPorKm: 0, promedioDiarioKm: 120 },
    turnoActivo: null
};

let store = JSON.parse(JSON.stringify(INITIAL_STATE));

// --- MOTOR DE INTEGRIDAD Y CÁLCULOS ---
function sanearDatos() {
    // 1. Validaciones de Arrays
    if(!Array.isArray(store.movimientos)) store.movimientos = [];
    if(!Array.isArray(store.cargasCombustible)) store.cargasCombustible = [];
    if(!Array.isArray(store.turnos)) store.turnos = [];
    if(!Array.isArray(store.deudas)) store.deudas = [];
    if(!store.wallet) store.wallet = { saldo: 0, sobres: [], historial: [] };
    if(!Array.isArray(store.wallet.sobres)) store.wallet.sobres = [];

    // 2. RECALCULAR SALDO REAL (Fuente de Verdad)
    let saldoCalculado = 0;
    store.movimientos.forEach(m => {
        if(m.tipo === 'ingreso') saldoCalculado += safeFloat(m.monto);
        if(m.tipo === 'gasto') saldoCalculado -= safeFloat(m.monto);
    });
    store.cargasCombustible.forEach(c => {
        saldoCalculado -= safeFloat(c.costo);
    });
    store.wallet.saldo = saldoCalculado;

    // 3. BLINDAJE KM Y EFICIENCIA REAL DE GASOLINA
    const maxTurno = store.turnos.length > 0 ? Math.max(...store.turnos.map(t=>t.kmFinal||0)) : 0;
    const maxGas = store.cargasCombustible.length > 0 ? Math.max(...store.cargasCombustible.map(c=>c.km||0)) : 0;
    const maxLogico = Math.max(store.parametros.ultimoKM || 0, maxTurno, maxGas);
    store.parametros.ultimoKM = maxLogico;

    // Cálculo de Eficiencia Real ($/KM)
    // costoRealKm = totalGasolinaPagada / kmRecorridos
    const totalGas = store.cargasCombustible.reduce((a, b) => a + safeFloat(b.costo), 0);
    // Aproximación de KM recorridos totales basada en la diferencia histórica
    // Si no hay historial suficiente, mantenemos el manual o default
    if(store.cargasCombustible.length >= 2) {
        const minKM = Math.min(...store.cargasCombustible.map(c=>c.km));
        const maxKM_Gas = Math.max(...store.cargasCombustible.map(c=>c.km));
        const deltaKM = maxKM_Gas - minKM;
        if(deltaKM > 100 && totalGas > 0) {
             // Ajuste simple: Costo total / Delta KM (excluyendo la primera carga "base")
             store.parametros.costoPorKm = (totalGas / deltaKM).toFixed(2);
        }
    }

    // 4. GENERAR/ACTUALIZAR SOBRES
    store.deudas.forEach(d => {
        let sobre = store.wallet.sobres.find(s => s.refId === d.id);
        if(!sobre) {
            sobre = { id: uuid(), refId: d.id, tipo: 'deuda', desc: d.desc, acumulado: 0 };
            store.wallet.sobres.push(sobre);
        }
        sobre.meta = safeFloat(d.montoCuota); // La meta es la cuota
        if(d.frecuencia === 'Semanal' && !d.diaPago) d.diaPago = "0";
    });

    store.gastosFijosMensuales.forEach(g => {
        let sobre = store.wallet.sobres.find(s => s.refId === g.id);
        if(!sobre) {
            sobre = { id: uuid(), refId: g.id, tipo: 'gasto', desc: g.desc, acumulado: 0 };
            store.wallet.sobres.push(sobre);
        }
        sobre.meta = safeFloat(g.monto);
    });

    recalcularMetaDiaria();
}

function loadData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            store = { ...INITIAL_STATE, ...parsed };
            sanearDatos(); 
        } catch (e) { 
            console.error("Error datos", e);
            // No borramos datos automáticamente para evitar pérdida accidental, solo alertamos
            alert("⚠️ Error en datos. Se intentará recuperar.");
        }
    }
}

function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
/* FIN PARTE 1 - SIGUE PARTE 2 */
/* =========================================
   APP.JS - BLOQUE 2/3 (LÓGICA Y REPORTES)
   ========================================= */

function recalcularMetaDiaria() {
    let costoFijo = 0;
    store.gastosFijosMensuales.forEach(g => {
        const dias = FRECUENCIAS[g.frecuencia] || 30;
        if(dias > 0) costoFijo += (safeFloat(g.monto) / dias);
    });
    store.deudas.forEach(d => {
        if(d.saldo > 0.1) { 
            const dias = FRECUENCIAS[d.frecuencia] || 30;
            if(dias > 0) costoFijo += (safeFloat(d.montoCuota) / dias);
        }
    });
    const pKm = safeFloat(store.parametros.promedioDiarioKm);
    const cKm = safeFloat(store.parametros.costoPorKm);
    store.parametros.metaDiaria = costoFijo + (pKm * cKm);
    saveData();
}

// Generador de Reporte Semanal Definitivo
function verReporteSemanal() {
    const saldoTotal = safeFloat(store.wallet.saldo);
    
    // Cálculo Saldo Comprometido: Suma de (Meta - Acumulado) de sobres activos
    // En este modelo simplificado, asumimos que la 'Meta' es lo que debes tener apartado.
    // Si no has apartado nada, todo el monto de la meta es "dinero necesario" (comprometido virtualmente).
    let saldoComprometido = 0;
    store.wallet.sobres.forEach(s => {
        // Cuánto me falta para llenar el sobre
        saldoComprometido += safeFloat(s.meta); 
    });
    
    // Ajuste: El saldo comprometido no puede exceder la realidad de las deudas
    // Pero para simplificar visualización: Comprometido = Suma de Cuotas/Gastos inminentes
    
    const saldoLibre = saldoTotal - saldoComprometido;
    const colorLibre = saldoLibre >= 0 ? 'green' : 'red';

    // Eficiencia Gasolina
    const gasCost = safeFloat(store.parametros.costoPorKm);

    // HTML del Reporte
    const html = `
        <div style="font-family:sans-serif; color:#334155;">
            <div style="margin-bottom:20px; text-align:center;">
                <h2 style="margin:0; font-size:1.5rem;">${fmtMoney(saldoTotal)}</h2>
                <small style="color:#64748b">Saldo Total en Wallet</small>
            </div>

            <div style="background:#f1f5f9; padding:15px; border-radius:12px; margin-bottom:20px;">
                <h4 style="margin:0 0 10px 0; font-size:0.9rem;">Distribución de Capital</h4>
                
                <div style="display:flex; align-items:center; margin-bottom:5px; font-size:0.8rem;">
                    <div style="width:80px;">Ingresos</div>
                    <div style="flex:1; background:#e2e8f0; height:10px; border-radius:5px; overflow:hidden;">
                        <div style="width:100%; background:#2563eb; height:100%;"></div>
                    </div>
                </div>

                <div style="display:flex; align-items:center; margin-bottom:5px; font-size:0.8rem;">
                    <div style="width:80px;">Comprometido</div>
                    <div style="flex:1; background:#e2e8f0; height:10px; border-radius:5px; overflow:hidden;">
                        <div style="width:${Math.min((saldoComprometido/saldoTotal)*100, 100)}%; background:#f59e0b; height:100%;"></div>
                    </div>
                    <div style="width:70px; text-align:right; font-weight:bold;">${fmtMoney(saldoComprometido)}</div>
                </div>

                <div style="display:flex; align-items:center; font-size:0.8rem;">
                    <div style="width:80px;">Libre</div>
                    <div style="flex:1; background:#e2e8f0; height:10px; border-radius:5px; overflow:hidden;">
                        <div style="width:${Math.min((Math.max(0, saldoLibre)/saldoTotal)*100, 100)}%; background:${colorLibre}; height:100%;"></div>
                    </div>
                    <div style="width:70px; text-align:right; font-weight:bold; color:${colorLibre}">${fmtMoney(saldoLibre)}</div>
                </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px;">
                <div style="border:1px solid #e2e8f0; padding:10px; border-radius:8px; text-align:center;">
                    <div style="font-size:0.8rem; color:#64748b">Eficiencia Motor</div>
                    <div style="font-weight:bold; font-size:1.1rem;">$${gasCost}/km</div>
                </div>
                <div style="border:1px solid #e2e8f0; padding:10px; border-radius:8px; text-align:center;">
                    <div style="font-size:0.8rem; color:#64748b">Estado</div>
                    <div style="font-weight:bold; font-size:1.1rem; color:${saldoLibre<0?'red':'green'}">${saldoLibre<0?'DÉFICIT':'SANO'}</div>
                </div>
            </div>

            <div style="background:#fff7ed; border-left:4px solid #f59e0b; padding:10px; font-size:0.9rem;">
                <strong>⚠️ Alerta de Sobres:</strong><br>
                Tienes <strong>${fmtMoney(saldoComprometido)}</strong> comprometidos en Sobres (Deudas y Gastos) para esta semana/periodo.
            </div>
        </div>
    `;

    Modal.showHtml("Reporte Semanal", html);
}

function updateConfigVehiculo(km, costo) { 
    if (safeFloat(km) < store.parametros.ultimoKM) {
        alert("⛔ BLOQUEADO: No puedes bajar el kilometraje.");
        return false;
    }
    store.parametros.ultimoKM = safeFloat(km); 
    // Si el usuario edita manual, respetamos su input, aunque el sistema calcula el real
    store.parametros.costoPorKm = safeFloat(costo);
    recalcularMetaDiaria();
    return true;
}

function finalizarTurno(kmFinal, ganancia) {
    const kF = safeFloat(kmFinal);
    if(kF < store.parametros.ultimoKM) { alert("❌ Error: KM menor al actual."); return; }

    store.turnos.push({
        id: uuid(), fecha: new Date().toISOString(), horas: (Date.now() - (store.turnoActivo?.inicio || Date.now())) / 36e5,
        ganancia: safeFloat(ganancia), kmRecorrido: kF - store.parametros.ultimoKM, kmFinal: kF
    });
    store.movimientos.push({
        id: uuid(), fecha: new Date().toISOString(), tipo: 'ingreso', desc: 'Turno', monto: safeFloat(ganancia)
    });

    store.parametros.ultimoKM = kF;
    store.turnoActivo = null;
    sanearDatos();
}

function registrarGasolina(l, c, k) {
    store.cargasCombustible.push({ id: uuid(), fecha: new Date().toISOString(), litros:l, costo:c, km:k });
    if(k > store.parametros.ultimoKM) store.parametros.ultimoKM = k;
    sanearDatos();
}

function abonarDeuda(id, monto) {
    if(!id) return;
    const d = store.deudas.find(x => x.id == id);
    if(!d) return;

    // REGLA: NO BLOQUEAR, SOLO AVISAR (Pagos adelantados permitidos)
    if(d.frecuencia === 'Semanal' && d.diaPago) {
        const hoy = new Date().getDay().toString();
        if(d.diaPago !== hoy) {
            if(!confirm(`📅 Esta deuda toca el ${DIAS_SEMANA.find(x=>x.value==d.diaPago)?.text}.\n¿Quieres adelantar el pago?`)) return;
        }
    }
    
    const val = safeFloat(monto);
    d.saldo -= val;
    if(d.saldo < 0) d.saldo = 0;
    
    store.movimientos.push({
        id: uuid(), fecha: new Date().toISOString(), tipo: 'gasto', 
        desc: `Pago: ${d.desc}`, monto: val, categoria: 'Deuda'
    });
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
            input.className = 'input-control';
            input.style.width = '100%'; input.style.padding='8px';
            if(conf.type === 'select') {
                conf.options.forEach(opt => { const o = document.createElement('option'); o.value = opt.value; o.innerText = opt.text; input.appendChild(o); });
            } else { input.type = conf.type || 'text'; if(conf.value !== undefined) input.value = conf.value; }
            input.onchange = (e) => values[conf.key] = e.target.value;
            values[conf.key] = conf.value || (conf.type==='select'?conf.options[0].value:'');
            div.appendChild(input); $('modalBody').appendChild(div);
        });

        const btnOk = $('modalConfirm');
        btnOk.onclick = () => {
            const inputs = $('modalBody').querySelectorAll('input, select');
            inputs.forEach((inp, i) => values[inputsConfig[i].key] = inp.value);
            if(onConfirm(values) !== false) modal.style.display = 'none';
        };
        $('modalCancel').onclick = () => modal.style.display = 'none';
        modal.style.display = 'flex';
    },
    showHtml: (title, html) => {
        const modal = $('appModal');
        $('modalTitle').innerText = title;
        $('modalBody').innerHTML = html;
        $('modalConfirm').onclick = () => modal.style.display = 'none';
        $('modalCancel').style.display = 'none'; // Solo confirmar para cerrar
        modal.style.display = 'flex';
    }
};
/* FIN PARTE 2 - SIGUE PARTE 3 */
/* =========================================
   APP.JS - BLOQUE 3/3 (UI Y ARRANQUE)
   ========================================= */

function updateAdminUI() {
    if($('kmActual')) $('kmActual').innerText = `${store.parametros.ultimoKM} km`;
    if($('metaDiariaValor')) $('metaDiariaValor').innerText = fmtMoney(store.parametros.metaDiaria);

    if($('turnoEstado')) {
        const t = store.turnoActivo;
        $('turnoEstado').innerHTML = t ? `<span style="color:green;font-weight:bold">🟢 EN CURSO</span>` : `🔴 Detenido`;
        $('btnTurnoIniciar').classList.toggle('hidden', !!t);
        $('btnTurnoFinalizar').classList.toggle('hidden', !t);
    }
    
    // Inyectar Botón de Reporte si no existe
    const dataZone = document.querySelector('#btnExportJSON')?.parentNode;
    if(dataZone && !document.getElementById('btnVerReporte')) {
        const btn = document.createElement('button');
        btn.id = 'btnVerReporte';
        btn.className = 'btn btn-primary';
        btn.style.marginBottom = '10px';
        btn.innerText = '📈 Ver Reporte Semanal';
        btn.onclick = verReporteSemanal;
        dataZone.prepend(btn); // Poner al principio de la zona de datos
    }

    const list = $('listaDeudasAdmin');
    const sel = $('abonoDeudaSelect');
    if(list && sel) {
        list.innerHTML = '';
        sel.innerHTML = '<option value="">-- Seleccionar Deuda --</option>';
        store.deudas.forEach(d => {
            if(d.saldo < 1) return;
            const li = document.createElement('li');
            li.className = 'list-item';
            li.innerHTML = `<span>${d.desc}</span> <strong>${fmtMoney(d.saldo)}</strong>`;
            list.appendChild(li);
            const opt = document.createElement('option');
            opt.value = d.id; opt.innerText = `${d.desc} (${fmtMoney(d.montoCuota)})`;
            sel.appendChild(opt);
        });
    }
}

function init() {
    console.log("🚀 APP V3 DEFINITIVA INICIADA");
    loadData();
    const page = document.body.dataset.page;
    
    document.querySelectorAll('.nav-link').forEach(l => {
        if(l.getAttribute('href').includes(page)) l.classList.add('active');
    });

    if(page === 'admin') {
        updateAdminUI();
        
        // Timer visual
        setInterval(() => {
            const el = $('turnoTimer');
            if(el && store.turnoActivo) {
                const diff = Date.now() - store.turnoActivo.inicio;
                const h = Math.floor(diff/3600000);
                const m = Math.floor((diff%3600000)/60000);
                el.innerText = `${h}h ${m}m`;
            }
        }, 1000);

        if(store.parametros.ultimoKM === 0) {
            Modal.showInput("Configuración Inicial", [{label:"KM Tablero", key:"km", type:"number"}], d=>{
                if(safeFloat(d.km)>0) { updateConfigVehiculo(d.km, 1.5); updateAdminUI(); return true; } return false;
            });
        }

        const bind = (id, fn) => { const el=$(id); if(el) el.onclick = (e) => { e.preventDefault(); fn(); updateAdminUI(); }; };

        bind('btnConfigKM', () => Modal.showInput("Ajustar Vehículo", [{label:"KM (Solo subir)", key:"k", type:"number", value:store.parametros.ultimoKM}], d=>updateConfigVehiculo(d.k, store.parametros.costoPorKm)));
        bind('btnTurnoIniciar', () => { if(!store.turnoActivo) iniciarTurno(); });
        bind('btnTurnoFinalizar', () => Modal.showInput("Fin Turno", [{label:"KM Final", key:"km", type:"number"}, {label:"Ganancia", key:"g", type:"number"}], d=>finalizarTurno(d.km, d.g)));
        
        const wiz = (grp) => Modal.showInput(`Gasto ${grp}`, [{label:"Desc", key:"d"}, {label:"$$", key:"m", type:"number"}, {label:"Cat", key:"c", type:"select", options:CATEGORIAS[grp.toLowerCase()].map(x=>({value:x, text:x}))}, {label:"Freq", key:"f", type:"select", options:Object.keys(FRECUENCIAS).map(x=>({value:x, text:x}))}], d=>procesarGasto(d.d, d.m, grp, d.c, d.f));
        bind('btnGastoHogar', () => wiz('Hogar'));
        bind('btnGastoOperativo', () => wiz('Operativo'));
        bind('btnGasolina', () => Modal.showInput("Gasolina", [{label:"Litros", key:"l", type:"number"}, {label:"$$ Total", key:"c", type:"number"}, {label:"KM", key:"k", type:"number"}], d=>registrarGasolina(d.l, d.c, d.k)));
        bind('btnDeudaNueva', () => Modal.showInput("Nueva Deuda", [{label:"Nombre", key:"n"}, {label:"Total", key:"t", type:"number"}, {label:"Cuota", key:"c", type:"number"}, {label:"Freq", key:"f", type:"select", options:Object.keys(FRECUENCIAS).map(x=>({value:x, text:x}))}, {label:"Día Pago", key:"dp", type:"select", options:DIAS_SEMANA}], d=>agregarDeuda(d.n, d.t, d.c, d.f, d.dp)));
        bind('btnAbonoCuota', () => { const id = $('abonoDeudaSelect').value; if(id) abonarDeuda(id, store.deudas.find(x=>x.id==id)?.montoCuota); });
        bind('btnExportJSON', () => navigator.clipboard.writeText(JSON.stringify(store)).then(()=>alert("Copiado")));
        bind('btnRestoreBackup', () => Modal.showInput("Pegar JSON", [{label:"JSON", key:"j"}], d=>{ try { store = {...INITIAL_STATE, ...JSON.parse(d.j)}; sanearDatos(); saveData(); location.reload(); } catch(e){alert("Error JSON");} }));
    }

    if(page === 'index') {
        const hoy = new Date().toDateString();
        const gan = store.turnos.filter(t => new Date(t.fecha).toDateString() === hoy).reduce((a,b)=>a+b.ganancia,0);
        if($('resGananciaBruta')) $('resGananciaBruta').innerText = fmtMoney(gan);
    }
    
    if(page === 'wallet') {
        const saldo = store.wallet.saldo;
        // Calculo visual de libre vs comprometido
        let comprometido = 0;
        store.wallet.sobres.forEach(s => comprometido += safeFloat(s.meta));
        const libre = saldo - comprometido;

        if($('valWallet')) $('valWallet').innerHTML = `
            ${fmtMoney(saldo)}<br>
            <span style="font-size:0.8rem; color:${libre>=0?'green':'red'}">Libre: ${fmtMoney(libre)}</span>
        `;
        
        // Render Sobres
        const main = document.querySelector('main.container');
        let container = document.getElementById('sobresContainer');
        if(!container && main) { container=document.createElement('div'); container.id='sobresContainer'; main.appendChild(container); }
        if(container) {
            container.innerHTML = store.wallet.sobres.map(s => `
                <div class="card" style="padding:10px; margin-top:10px; border-left:4px solid ${s.tipo==='deuda'?'#ef4444':'#3b82f6'}">
                    <div style="display:flex; justify-content:space-between">
                        <strong>${s.desc}</strong>
                        <small>${s.tipo.toUpperCase()}</small>
                    </div>
                    <div style="text-align:right; font-weight:bold; color:#64748b">Meta: ${fmtMoney(s.meta)}</div>
                </div>
            `).join('');
        }
    }
}

document.addEventListener('DOMContentLoaded', init);
             
