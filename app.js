/* =========================================
APP.JS - BLOQUE 1/3 (CONSTANTES Y STATE)
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

// --- LÓGICA DE DATOS (STATE) ---
const INITIAL_STATE = {
schemaVersion: SCHEMA_VERSION,
turnos: [], movimientos: [], cargasCombustible: [],
deudas: [], gastosFijosMensuales: [],
wallet: { saldo: 0, sobres: [], historial: [] },
parametros: {
metaDiaria: 0,
ultimoKM: 0,
costoPorKm: 0,
promedioDiarioKm: 120
},
turnoActivo: null
};

let store = JSON.parse(JSON.stringify(INITIAL_STATE));

// --- MOTOR DE INTEGRIDAD Y MIGRACIÓN ---
function sanearDatos() {
console.log("🔄 Ejecutando saneamiento de datos...");

// 1. RECALCULAR SALDO (FUENTE DE VERDAD: Movimientos + Gasolina)  
let saldoCalculado = 0;  
store.movimientos.forEach(m => {  
    if(m.tipo === 'ingreso') saldoCalculado += safeFloat(m.monto);  
    if(m.tipo === 'gasto') saldoCalculado -= safeFloat(m.monto);  
});  
// La gasolina se resta porque en este modelo se guarda en array aparte pero afecta saldo  
store.cargasCombustible.forEach(c => {  
    saldoCalculado -= safeFloat(c.costo);  
});  
  
store.wallet.saldo = saldoCalculado;  

// 2. BLINDAJE DE KM (Máximo histórico lógico)  
const maxTurno = store.turnos.length > 0 ? Math.max(...store.turnos.map(t=>t.kmFinal||0)) : 0;  
const maxGas = store.cargasCombustible.length > 0 ? Math.max(...store.cargasCombustible.map(c=>c.km||0)) : 0;  
const maxLogico = Math.max(store.parametros.ultimoKM, maxTurno, maxGas);  
store.parametros.ultimoKM = maxLogico;  

// 3. GENERACIÓN DE SOBRES (Deudas y Fijos)  
// Asegurar array  
if(!store.wallet.sobres) store.wallet.sobres = [];  
  
// Deudas -> Sobres  
store.deudas.forEach(d => {  
    if(!store.wallet.sobres.find(s => s.refId === d.id)) {  
        store.wallet.sobres.push({  
            id: uuid(), refId: d.id, tipo: 'deuda',   
            desc: d.desc, acumulado: 0, meta: safeFloat(d.montoCuota)  
        });  
    }  
    // Migración DiaPago: Si es semanal y no tiene día, asignar Domingo (0) por defecto para obligar revisión  
    if(d.frecuencia === 'Semanal' && (d.diaPago === undefined || d.diaPago === "")) {  
        d.diaPago = "0";   
    }  
});  

// Gastos Fijos -> Sobres  
store.gastosFijosMensuales.forEach(g => {  
    if(!store.wallet.sobres.find(s => s.refId === g.id)) {  
        store.wallet.sobres.push({  
            id: uuid(), refId: g.id, tipo: 'gasto',   
            desc: g.desc, acumulado: 0, meta: safeFloat(g.monto)  
        });  
    }  
});  

recalcularMetaDiaria();

}

function loadData() {
const raw = localStorage.getItem(STORAGE_KEY);
if (raw) {
try {
const parsed = JSON.parse(raw);
store = { ...INITIAL_STATE, ...parsed };
// Forzar estructura wallet
store.wallet = { ...INITIAL_STATE.wallet, ...parsed.wallet };
store.parametros = { ...INITIAL_STATE.parametros, ...parsed.parametros };

sanearDatos(); // <--- SIEMPRE CORRE AL INICIO  
    } catch (e) {   
        console.error("Error crítico carga:", e);   
    }  
}

}

function saveData() {
try {
localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
} catch(e) { alert("⚠️ Memoria llena"); }
}
/* FIN PARTE 1 - SIGUE PARTE 2 */

/* =========================================
APP.JS - BLOQUE 2/3 (LÓGICA BLINDADA)
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

// --- OPERACIONES FINANCIERAS ---

function updateConfigVehiculo(km, costo) {
const nuevoKM = safeFloat(km);
// BLINDAJE KM: Prohibido bajar
if (nuevoKM < store.parametros.ultimoKM) {
alert(⛔ BLOQUEADO: No puedes reducir el kilometraje.\nActual: ${store.parametros.ultimoKM});
return false;
}
store.parametros.ultimoKM = nuevoKM;
store.parametros.costoPorKm = safeFloat(costo);
recalcularMetaDiaria();
return true;
}

function iniciarTurno() {
if(store.turnoActivo) return;
store.turnoActivo = { inicio: Date.now(), kmInicial: store.parametros.ultimoKM };
saveData();
}

function finalizarTurno(kmFinal, ganancia) {
if(!store.turnoActivo) return;
const kF = safeFloat(kmFinal);
const g = safeFloat(ganancia);

if(kF < store.turnoActivo.kmInicial) {  
    alert("❌ Error: KM Final menor al inicial.");  
    return;  
}  

store.turnos.push({  
    id: uuid(), fecha: new Date().toISOString(), horas: (Date.now() - store.turnoActivo.inicio) / 36e5,  
    ganancia: g, kmRecorrido: kF - store.turnoActivo.kmInicial, kmFinal: kF  
});  
  
// Ingreso al Wallet (Movimiento explícito para trazabilidad)  
store.movimientos.push({  
    id: uuid(), fecha: new Date().toISOString(), tipo: 'ingreso', desc: 'Turno Finalizado', monto: g  
});  

if(kF > store.parametros.ultimoKM) store.parametros.ultimoKM = kF;  
store.turnoActivo = null;  
sanearDatos(); // Recalcula saldo y guarda

}

function registrarGasolina(l, c, k) {
store.cargasCombustible.push({ id: uuid(), fecha: new Date().toISOString(), litros:l, costo:c, km:k });
// NO insertamos movimiento de gasto aquí porque "sanearDatos" resta cargasCombustible del saldo.
// Esto evita doble contabilidad.

if(k > store.parametros.ultimoKM) store.parametros.ultimoKM = k;  
sanearDatos(); // Recalcula saldo y guarda

}

function procesarGasto(desc, monto, grupo, cat, freq) {
const idRef = uuid();
if(freq !== 'Unico') {
store.gastosFijosMensuales.push({ id: idRef, desc, monto, categoria: cat, frecuencia: freq });
}
store.movimientos.push({ id: idRef, fecha: new Date().toISOString(), tipo: 'gasto', desc, monto, categoria: cat });
sanearDatos();
}

function agregarDeuda(desc, total, cuota, freq, diaPago) {
const idRef = uuid();
store.deudas.push({
id: idRef, desc, montoTotal: total, montoCuota: cuota,
frecuencia: freq, diaPago: diaPago, saldo: total
});
sanearDatos(); // Creará el sobre automáticamente
}

function abonarDeuda(id, monto) {
if(!id) return;
const d = store.deudas.find(x => x.id == id);
if(!d) return;

// BLINDAJE DE DÍA DE PAGO  
if(d.frecuencia === 'Semanal' && d.diaPago !== undefined && d.diaPago !== "") {  
    const hoy = new Date().getDay().toString();  
    if(d.diaPago !== hoy) {  
        const diaNombre = DIAS_SEMANA.find(x => x.value == d.diaPago)?.text || "Otro día";  
        alert(`⛔ BLOQUEADO\nEsta deuda se paga los: ${diaNombre.toUpperCase()}.\nHoy no se permite el pago.`);  
        return;  
    }  
}  
  
const val = safeFloat(monto);  
if(val <= 0) return;  

d.saldo -= val;  
if(d.saldo < 0) d.saldo = 0;  
  
// Registrar gasto en movimientos  
store.movimientos.push({  
    id: uuid(), fecha: new Date().toISOString(), tipo: 'gasto',   
    desc: `Abono: ${d.desc}`, monto: val, categoria: 'Deuda'  
});  

sanearDatos();

}

// UI HELPERS
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
            if(conf.value !== undefined) input.value = conf.value;  
        }  
        input.onchange = (e) => values[conf.key] = e.target.value;  
        values[conf.key] = conf.value || (conf.type==='select'?conf.options[0].value:'');  
        div.appendChild(input);  
        body.appendChild(div);  
    });  

    const btnOk = $('modalConfirm');  
    const btnNo = $('modalCancel');  
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
/* FIN PARTE 2 - SIGUE PARTE 3 */

/* =========================================
APP.JS - BLOQUE 3/3 (UI Y ARRANQUE)
========================================= */

function updateAdminUI() {
if($('kmActual')) $('kmActual').innerText = ${store.parametros.ultimoKM} km;
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
        const diaTxt = d.diaPago ? ` <small style="color:#2563eb">(${DIAS_SEMANA.find(x=>x.value==d.diaPago)?.text || ''})</small>` : '';  
        li.innerHTML = `<span>${d.desc}${diaTxt}</span> <strong>${fmtMoney(d.saldo)}</strong>`;  
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
el.innerText = ${h}h ${m}m ${s}s;
} else { el.innerText = "--:--:--"; }
}, 1000);
}

function init() {
console.log("🚀 APP V2 BLINDADA INICIADA");
loadData();
const page = document.body.dataset.page;

document.querySelectorAll('.nav-link').forEach(l => {  
    if(l.getAttribute('href').includes(page)) l.classList.add('active');  
});  

if(page === 'admin') {  
    updateAdminUI();  
    startTimer();  

    if(store.parametros.ultimoKM === 0) {  
        Modal.showInput("Configuración Inicial", [  
            {label:"KM Tablero", key:"km", type:"number"},  
            {label:"Costo Operativo $/km", key:"c", type:"number", value:1.5}  
        ], (d)=>{  
            if(safeFloat(d.km) > 0) {   
                updateConfigVehiculo(d.km, d.c);   
                updateAdminUI();   
                return true;   
            }  
            return false;  
        });  
    }  

    const bind = (id, fn) => {  
        const el = $(id);  
        if(el) el.onclick = (e) => { e.preventDefault(); fn(); updateAdminUI(); };  
    };  

    bind('btnConfigKM', () => Modal.showInput("Ajustar Vehículo", [  
        {label:"KM Actual (Solo subir)", key:"k", type:"number", value:store.parametros.ultimoKM},  
        {label:"Costo $/KM", key:"c", type:"number", value:store.parametros.costoPorKm}  
    ], d=>updateConfigVehiculo(d.k, d.c)));  

    bind('btnTurnoIniciar', iniciarTurno);  
    bind('btnTurnoFinalizar', () => Modal.showInput("Fin Turno", [{label:"KM Final", key:"km", type:"number"}, {label:"Ganancia Total", key:"g", type:"number"}], d=>finalizarTurno(d.km, d.g)));  
      
    const wiz = (grp) => Modal.showInput(`Gasto ${grp}`, [  
        {label:"Desc", key:"d"}, {label:"Monto", key:"m", type:"number"},   
        {label:"Cat", key:"c", type:"select", options:CATEGORIAS[grp.toLowerCase()].map(x=>({value:x, text:x}))},  
        {label:"Freq", key:"f", type:"select", options:Object.keys(FRECUENCIAS).map(x=>({value:x, text:x}))}  
    ], d=>procesarGasto(d.d, d.m, grp, d.c, d.f));  

    bind('btnGastoHogar', () => wiz( 'Hogar'));  
    bind('btnGastoOperativo', () => wiz('Operativo'));  
      
    bind('btnGasolina', () => Modal.showInput("Gasolina", [{label:"Litros", key:"l", type:"number"}, {label:"$$ Total", key:"c", type:"number"}, {label:"KM", key:"k", type:"number"}], d=>registrarGasolina(d.l, d.c, d.k)));  
      
    bind('btnDeudaNueva', () => Modal.showInput("Nueva Deuda", [  
        {label:"Nombre", key:"n"},   
        {label:"Total", key:"t", type:"number"},   
        {label:"Cuota", key:"c", type:"number"},   
        {label:"Freq", key:"f", type:"select", options:Object.keys(FRECUENCIAS).map(x=>({value:x, text:x}))},  
        {label:"Día de Pago (Semanal)", key:"dp", type:"select", options:DIAS_SEMANA}  
    ], d=>agregarDeuda(d.n, d.t, d.c, d.f, d.dp)));  
      
    bind('btnAbonoCuota', () => { const id = $('abonoDeudaSelect').value; if(id) abonarDeuda(id, store.deudas.find(x=>x.id==id)?.montoCuota); });  
      
    bind('btnExportJSON', () => navigator.clipboard.writeText(JSON.stringify(store)).then(()=>alert("Copiado")));  
      
    // RESTORE LEGACY IMPORT  
    bind('btnRestoreBackup', () => Modal.showInput("Pegar JSON Legacy/Backup", [{label:"JSON", key:"j"}], d=>{   
        try {  
            const parsed = JSON.parse(d.j);  
            if(confirm("⚠️ ¿Sobrescribir datos y actualizar versión?")) {  
                store = { ...INITIAL_STATE, ...parsed };  
                sanearDatos(); // Recalcula saldo, km y estructura  
                saveData();  
                location.reload();   
            }  
        } catch(e) { alert("❌ JSON Inválido: " + e.message); }  
    }));  
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

if(page === 'historial') {  
    const tbody = $('tablaBody');  
    if (tbody) {  
        const movs = store.movimientos.slice().reverse().slice(0, 50);  
        tbody.innerHTML = movs.map(m => `  
            <tr>  
                <td>${new Date(m.fecha).toLocaleDateString()}</td>  
                <td><strong>${m.desc}</strong><br><small style="color:#64748b">${m.categoria || 'Gasto'}</small></td>  
                <td style="text-align:right">${fmtMoney(m.monto)}</td>  
            </tr>  
        `).join('');  
    }  
}

}

document.addEventListener('DOMContentLoaded', init);
