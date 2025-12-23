/* =========================================
   APP.JS - BLOQUE 1/3 (CONSTANTES Y DATOS)
   ========================================= */

// --- CONSTANTES ---
const STORAGE_KEY = "moto_finanzas_vFinal";

const FRECUENCIAS = {
    'Diario': 1, 'Semanal': 7, 'Quincenal': 15, 
    'Mensual': 30, 'Bimestral': 60, 'Anual': 365, 'Unico': 0
};

const CATEGORIAS = {
    operativo: ["Gasolina", "Mantenimiento", "Reparación", "Equipo", "Seguro"],
    hogar: ["Renta", "Comida", "Servicios", "Internet", "Salud", "Deudas", "Otro"]
};

// Utilidades
const $ = (id) => document.getElementById(id);
const safeFloat = (val) => { const n = parseFloat(val); return isFinite(n) ? n : 0; };
const fmtMoney = (amount) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount || 0);
const uuid = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// --- LÓGICA DE DATOS (STATE) ---
const INITIAL_STATE = {
    turnos: [], movimientos: [], cargasCombustible: [], 
    deudas: [], gastosFijosMensuales: [],
    wallet: { saldo: 0, historial: [] },
    parametros: { metaDiaria: 0, ultimoKM: 0, costoPorKm: 0, promedioDiarioKm: 120 },
    turnoActivo: null
};

let store = JSON.parse(JSON.stringify(INITIAL_STATE));

function loadData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            store = { 
                ...INITIAL_STATE, ...parsed,
                parametros: { ...INITIAL_STATE.parametros, ...parsed.parametros },
                wallet: { ...INITIAL_STATE.wallet, ...parsed.wallet }
            };
        } catch (e) { console.error("Error carga", e); }
    }
    recalcularMetaDiaria();
}

function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
/* =========================================
   APP.JS - BLOQUE 2/3 (LÓGICA Y MODALES)
   ========================================= */

function recalcularMetaDiaria() {
    let costoFijo = 0;
    store.gastosFijosMensuales.forEach(g => {
        const dias = FRECUENCIAS[g.frecuencia] || 30;
        if(dias > 0) costoFijo += (safeFloat(g.monto) / dias);
    });
    store.deudas.forEach(d => {
        if(d.saldo > 0) {
            const dias = FRECUENCIAS[d.frecuencia] || 30;
            if(dias > 0) costoFijo += (safeFloat(d.montoCuota) / dias);
        }
    });
    const costoGas = store.parametros.promedioDiarioKm * store.parametros.costoPorKm;
    store.parametros.metaDiaria = costoFijo + costoGas;
    saveData();
}

// Operaciones
function setUltimoKM(km) { store.parametros.ultimoKM = safeFloat(km); saveData(); }

function iniciarTurno() {
    if(store.turnoActivo) return;
    store.turnoActivo = { inicio: Date.now(), kmInicial: store.parametros.ultimoKM };
    saveData();
}

function finalizarTurno(kmFinal, ganancia) {
    if(!store.turnoActivo) return;
    const kmRecorrido = safeFloat(kmFinal) - store.turnoActivo.kmInicial;
    const horas = (Date.now() - store.turnoActivo.inicio) / 36e5;
    store.turnos.push({
        id: uuid(), fecha: new Date().toISOString(), horas,
        ganancia: safeFloat(ganancia), kmRecorrido, kmFinal: safeFloat(kmFinal)
    });
    store.wallet.saldo += (safeFloat(ganancia) * 0.10); // 10% al wallet
    if(safeFloat(kmFinal) > store.parametros.ultimoKM) store.parametros.ultimoKM = safeFloat(kmFinal);
    store.turnoActivo = null;
    saveData();
}

function registrarGasolina(l, c, k) {
    store.cargasCombustible.push({ id: uuid(), fecha: new Date().toISOString(), litros:l, costo:c, km:k });
    store.wallet.saldo -= safeFloat(c);
    if(k > store.parametros.ultimoKM) store.parametros.ultimoKM = k;
    saveData();
}

function procesarGasto(desc, monto, grupo, cat, freq) {
    if(freq !== 'Unico') {
        store.gastosFijosMensuales.push({ id: uuid(), desc, monto, categoria: cat, frecuencia: freq });
        recalcularMetaDiaria();
    }
    store.movimientos.push({ id: uuid(), fecha: new Date().toISOString(), tipo: 'gasto', desc, monto, categoria: cat });
    saveData();
}

function agregarDeuda(desc, total, cuota, freq) {
    store.deudas.push({ id: uuid(), desc, montoTotal: total, montoCuota: cuota, frecuencia: freq, saldo: total });
    recalcularMetaDiaria();
}

function abonarDeuda(id, monto) {
    const d = store.deudas.find(x => x.id == id);
    if(d) {
        d.saldo -= safeFloat(monto);
        if(d.saldo < 0) d.saldo = 0;
        store.wallet.saldo -= safeFloat(monto);
        saveData();
    }
}

// UI: Modal Genérico
const Modal = {
    showInput: (title, inputsConfig, onConfirm) => {
        const modal = $('appModal');
        const body = $('modalBody');
        $('modalTitle').innerText = title;
        body.innerHTML = '';
        const values = {};
        
        inputsConfig.forEach(conf => {
            const div = document.createElement('div');
            div.innerHTML = `<label style="display:block;font-size:0.8rem;color:#666;margin-top:5px">${conf.label}</label>`;
            const input = document.createElement(conf.type === 'select' ? 'select' : 'input');
            input.className = 'input-control';
            input.style.width = '100%'; input.style.padding='8px'; input.style.marginBottom='5px';
            
            if(conf.type === 'select') {
                conf.options.forEach(opt => {
                    const o = document.createElement('option');
                    o.value = opt.value; o.innerText = opt.text;
                    input.appendChild(o);
                });
            } else {
                input.type = conf.type || 'text';
                if(conf.value) input.value = conf.value;
            }
            input.onchange = (e) => values[conf.key] = e.target.value;
            values[conf.key] = conf.value || (conf.type==='select'?conf.options[0].value:'');
            div.appendChild(input);
            body.appendChild(div);
        });

        const btnOk = $('modalConfirm');
        const btnNo = $('modalCancel');
        
        // Clonar botones para limpiar eventos previos
        const newOk = btnOk.cloneNode(true);
        const newNo = btnNo.cloneNode(true);
        btnOk.parentNode.replaceChild(newOk, btnOk);
        btnNo.parentNode.replaceChild(newNo, btnNo);

        newNo.onclick = () => modal.style.display = 'none';
        newOk.onclick = () => {
            const inputs = body.querySelectorAll('input, select');
            inputs.forEach((inp, i) => values[inputsConfig[i].key] = inp.value);
            if(onConfirm(values) !== false) modal.style.display = 'none';
        };
        modal.style.display = 'flex';
    }
};
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

let timerInterval = null;
function startTimer() {
    if(timerInterval) clearInterval(timerInterval);
    const el = $('turnoTimer');
    if(!el) return;
    timerInterval = setInterval(() => {
        if(store.turnoActivo) {
            const diff = Date.now() - store.turnoActivo.inicio;
            const h = Math.floor(diff/3600000);
            const m = Math.floor((diff%3600000)/60000);
            const s = Math.floor((diff%60000)/1000);
            el.innerText = `${h}h ${m}m ${s}s`;
        } else { el.innerText = "--:--:--"; }
    }, 1000);
}

function init() {
    console.log("🚀 APP INICIADA - MODO UNIFICADO");
    loadData();
    const page = document.body.dataset.page;
    
    // Navegación Activa
    document.querySelectorAll('.nav-link').forEach(l => {
        if(l.getAttribute('href').includes(page)) l.classList.add('active');
    });

    if(page === 'admin') {
        updateAdminUI();
        startTimer();

        // Onboarding KM
        if(store.parametros.ultimoKM === 0) {
            Modal.showInput("Bienvenido: Kilometraje Inicial", [{label:"KM Tablero", key:"km", type:"number"}], (d)=>{
                if(safeFloat(d.km) > 0) { setUltimoKM(d.km); updateAdminUI(); return true; }
                return false;
            });
        }

        // Bindeo de Botones
        const bind = (id, fn) => {
            const el = $(id);
            if(el) el.onclick = (e) => { e.preventDefault(); fn(); updateAdminUI(); };
        };

        bind('btnConfigKM', () => Modal.showInput("Ajustar KM", [{label:"KM", key:"k", type:"number", value:store.parametros.ultimoKM}], d=>setUltimoKM(d.k)));
        bind('btnTurnoIniciar', iniciarTurno);
        bind('btnTurnoFinalizar', () => Modal.showInput("Fin Turno", [{label:"KM Final", key:"km", type:"number"}, {label:"Ganancia", key:"g", type:"number"}], d=>finalizarTurno(d.km, d.g)));
        
        const wiz = (grp) => Modal.showInput(`Gasto ${grp}`, [
            {label:"Desc", key:"d"}, {label:"Monto", key:"m", type:"number"}, 
            {label:"Cat", key:"c", type:"select", options:CATEGORIAS[grp.toLowerCase()].map(x=>({value:x, text:x}))},
            {label:"Freq", key:"f", type:"select", options:Object.keys(FRECUENCIAS).map(x=>({value:x, text:x}))}
        ], d=>procesarGasto(d.d, d.m, grp, d.c, d.f));

        bind('btnGastoHogar', () => wiz( 'Hogar'));
        bind('btnGastoOperativo', () => wiz('Operativo'));
        
        bind('btnGasolina', () => Modal.showInput("Gasolina", [{label:"Litros", key:"l", type:"number"}, {label:"$$ Total", key:"c", type:"number"}, {label:"KM", key:"k", type:"number"}], d=>registrarGasolina(d.l, d.c, d.k)));
        
        bind('btnDeudaNueva', () => Modal.showInput("Nueva Deuda", [{label:"Nombre", key:"n"}, {label:"Total", key:"t", type:"number"}, {label:"Cuota", key:"c", type:"number"}, {label:"Freq", key:"f", type:"select", options:Object.keys(FRECUENCIAS).map(x=>({value:x, text:x}))}], d=>agregarDeuda(d.n, d.t, d.c, d.f)));
        
        bind('btnAbonoCuota', () => { const id = $('abonoDeudaSelect').value; if(id) abonarDeuda(id, store.deudas.find(x=>x.id==id).montoCuota); });
        
        bind('btnExportJSON', () => navigator.clipboard.writeText(JSON.stringify(store)).then(()=>alert("Copiado")));
        bind('btnRestoreBackup', () => Modal.showInput("Pegar JSON", [{label:"JSON", key:"j"}], d=>{ localStorage.setItem(STORAGE_KEY, d.j); location.reload(); }));
    }

    if(page === 'index') {
        const hoy = new Date().toDateString();
        const turnosHoy = store.turnos.filter(t => new Date(t.fecha).toDateString() === hoy);
        const gan = turnosHoy.reduce((a,b)=>a+b.ganancia,0);
        if($('resGananciaBruta')) $('resGananciaBruta').innerText = fmtMoney(gan);
    }
    
    if(page === 'wallet') {
        if($('valWallet')) $('valWallet').innerText = fmtMoney(store.wallet.saldo);
    }
}

// ARRANQUE SEGURO
document.addEventListener('DOMContentLoaded', init);
