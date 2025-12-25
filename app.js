/* =========================================
   APP.JS - V3.5 ESTABLE + CORRECCIONES LÓGICAS (PARTE 1/2)
   ========================================= */

// --- 1. CONSTANTES ---
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

// Estado Inicial
const INITIAL_STATE = {
    schemaVersion: SCHEMA_VERSION,
    turnos: [], movimientos: [], cargasCombustible: [], 
    deudas: [], gastosFijosMensuales: [],
    wallet: { saldo: 0, sobres: [], historial: [] },
    parametros: { metaDiaria: 0, ultimoKM: 0, costoPorKm: 0, promedioDiarioKm: 120, ultimoProcesamiento: null },
    turnoActivo: null
};

let store = JSON.parse(JSON.stringify(INITIAL_STATE));

// --- 2. MOTOR DE INTEGRIDAD ---
function sanearDatos() {
    if(!Array.isArray(store.movimientos)) store.movimientos = [];
    if(!Array.isArray(store.cargasCombustible)) store.cargasCombustible = [];
    if(!Array.isArray(store.turnos)) store.turnos = [];
    if(!Array.isArray(store.deudas)) store.deudas = [];
    if(!store.wallet) store.wallet = { saldo: 0, sobres: [], historial: [] };
    if(!Array.isArray(store.wallet.sobres)) store.wallet.sobres = [];
    
    // 1. RECALCULAR SALDO
    let saldoCalculado = 0;
    store.movimientos.forEach(m => {
        if(m.tipo === 'ingreso') saldoCalculado += safeFloat(m.monto);
        if(m.tipo === 'gasto') saldoCalculado -= safeFloat(m.monto);
    });
    store.cargasCombustible.forEach(c => saldoCalculado -= safeFloat(c.costo));
    store.wallet.saldo = saldoCalculado;

    // 2. EFICIENCIA GASOLINA
    const totalGas = store.cargasCombustible.reduce((a,b)=>a+safeFloat(b.costo),0);
    const kmsGas = store.cargasCombustible.length > 1 ? 
        (Math.max(...store.cargasCombustible.map(c=>c.km)) - Math.min(...store.cargasCombustible.map(c=>c.km))) : 0;
    if(kmsGas > 100) store.parametros.costoPorKm = (totalGas / kmsGas).toFixed(2);

    // 3. BLINDAJE KM
    const maxTurno = store.turnos.length > 0 ? Math.max(...store.turnos.map(t=>t.kmFinal||0)) : 0;
    const maxGas = store.cargasCombustible.length > 0 ? Math.max(...store.cargasCombustible.map(c=>c.km||0)) : 0;
    store.parametros.ultimoKM = Math.max(store.parametros.ultimoKM || 0, maxTurno, maxGas);

    // 4. ESTRUCTURA SOBRES
    actualizarSobresEstructural();

    // 5. CALENDARIO CORRECTO
    recalcularSobresPorCalendario();
}

function actualizarSobresEstructural() {
    const crearSobre = (refId, tipo, desc, meta, freq, diaPago) => {
        let s = store.wallet.sobres.find(x => x.refId === refId);
        if(!s) {
            s = { id: uuid(), refId, tipo, desc, acumulado: 0, ultimoCalculo: getFechaHoy() };
            store.wallet.sobres.push(s);
        }
        s.meta = safeFloat(meta); s.frecuencia = freq; s.diaPago = diaPago; s.desc = desc;
    };
    store.deudas.forEach(d => { if(d.saldo > 0) crearSobre(d.id, 'deuda', d.desc, d.montoCuota, d.frecuencia, d.diaPago); });
    store.gastosFijosMensuales.forEach(g => { crearSobre(g.id, 'gasto', g.desc, g.monto, g.frecuencia); });
    
    store.wallet.sobres = store.wallet.sobres.filter(s => {
        if(s.tipo === 'deuda') return store.deudas.some(d => d.id === s.refId && d.saldo > 0.1);
        if(s.tipo === 'gasto') return store.gastosFijosMensuales.some(g => g.id === s.refId);
        return false;
    });
}

function recalcularSobresPorCalendario() {
    const hoyObj = new Date();
    const hoyIndex = hoyObj.getDay(); 
    const diaDelMes = hoyObj.getDate();

    store.wallet.sobres.forEach(s => {
        if (s.frecuencia === 'Semanal' && s.diaPago !== undefined) {
            const pagoIndex = parseInt(s.diaPago);
            let diasTranscurridos = (hoyIndex - pagoIndex + 7) % 7;
            if (diasTranscurridos === 0 && s.acumulado < s.meta) diasTranscurridos = 7;
            const montoIdeal = (s.meta / 7) * diasTranscurridos;
            if(s.acumulado < montoIdeal) s.acumulado = montoIdeal;
            if(s.acumulado > s.meta) s.acumulado = s.meta;
        }
        if (s.frecuencia === 'Mensual') {
             const montoIdeal = (s.meta / 30) * diaDelMes;
             if(s.acumulado < montoIdeal) s.acumulado = montoIdeal;
             if(s.acumulado > s.meta) s.acumulado = s.meta;
        }
        if (s.frecuencia === 'Diario') {
             if(s.acumulado < s.meta) s.acumulado = s.meta;
        }
    });
    saveData();
}

function loadData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw) { try { store = { ...INITIAL_STATE, ...JSON.parse(raw) }; sanearDatos(); } catch(e) {} }
}
function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }

// --- 3. OPERACIONES ---

function finalizarTurno(kmFinal, ganancia) {
    const kF = safeFloat(kmFinal);
    if(kF < store.parametros.ultimoKM) return alert("⛔ KM inválido");
    store.turnos.push({ id: uuid(), fecha: new Date().toISOString(), ganancia: safeFloat(ganancia), kmRecorrido: kF - store.parametros.ultimoKM, kmFinal: kF });
    store.movimientos.push({ id: uuid(), fecha: new Date().toISOString(), tipo: 'ingreso', desc: 'Turno', monto: safeFloat(ganancia) });
    store.parametros.ultimoKM = kF; store.turnoActivo = null; sanearDatos();
}

function abonarDeuda(id, monto) {
    const d = store.deudas.find(x => x.id == id);
    if(!d) return;
    const val = safeFloat(monto);
    d.saldo -= val; if(d.saldo < 0) d.saldo = 0;
    const s = store.wallet.sobres.find(x => x.refId === id);
    if(s) s.acumulado = 0; 
    store.movimientos.push({ id: uuid(), fecha: new Date().toISOString(), tipo: 'gasto', desc: `Pago: ${d.desc}`, monto: val, categoria: 'Deuda' });
    sanearDatos();
}

function registrarGasolina(l, c, k) {
    store.cargasCombustible.push({ id: uuid(), fecha: new Date().toISOString(), litros:l, costo:c, km:k });
    if(k > store.parametros.ultimoKM) store.parametros.ultimoKM = k; sanearDatos();
}

function procesarGasto(desc, monto, grupo, cat, freq) {
    const id = uuid(); const m = safeFloat(monto);
    if(freq !== 'Unico') store.gastosFijosMensuales.push({ id, desc, monto: m, categoria: cat, frecuencia: freq });
    store.movimientos.push({ id, fecha: new Date().toISOString(), tipo: 'gasto', desc, monto: m, categoria: cat });
    
    // Vaciado inteligente
    store.wallet.sobres.forEach(s => {
        if(s.tipo === 'gasto') {
            const gf = store.gastosFijosMensuales.find(x => x.id === s.refId);
            if(gf && gf.categoria === cat) { s.acumulado -= m; if(s.acumulado < 0) s.acumulado = 0; }
        }
    });
    sanearDatos();
}

function agregarDeuda(desc, total, cuota, freq, diaPago) {
    store.deudas.push({ id: uuid(), desc, montoTotal: total, montoCuota: cuota, frecuencia: freq, diaPago, saldo: total }); sanearDatos();
}

function updateConfigVehiculo(km, costo) {
    if(safeFloat(km) < store.parametros.ultimoKM) return alert("⛔ KM inválido");
    store.parametros.ultimoKM = safeFloat(km);
    if(store.cargasCombustible.length < 2) store.parametros.costoPorKm = safeFloat(costo); sanearDatos();
}

/* --- FIN PARTE 1 --- */
       /* =========================================
   APP.JS - V3.5 ESTABLE + CORRECCIONES LÓGICAS (PARTE 2/2)
   ========================================= */

// --- 4. UI Y REPORTES ---

function generarResumenHumanoHoy(store) {
    const saldoTotal = safeFloat(store.wallet.saldo);
    let comprometido = 0;
    store.wallet.sobres.forEach(s => comprometido += safeFloat(s.acumulado));
    const libre = saldoTotal - comprometido;
    let html = '';
    store.wallet.sobres.forEach(s => {
        const falta = s.meta - s.acumulado;
        if(falta > 1) html += `<li style="margin-bottom:4px">Faltan <strong>${fmtMoney(falta)}</strong> para ${s.desc}</li>`;
    });
    if(!html) html = '<li>¡Todo cubierto!</li>';

    return `
    <div style="background:#f8fafc; padding:15px; border-radius:12px; margin:15px 0; border:1px solid #e2e8f0;">
        <h3 style="margin:0 0 10px 0; font-size:1.1rem; color:#1e293b;">Resumen</h3>
        <p>Total: <strong>${fmtMoney(saldoTotal)}</strong> | Libre: <strong style="color:${libre>=0?'green':'red'}">${fmtMoney(libre)}</strong></p>
        <ul style="margin:10px 0 0 20px; color:#64748b; font-size:0.9rem;">${html}</ul>
    </div>`;
}

function generarReporteSemanal() {
    let comprometido = 0;
    store.wallet.sobres.forEach(s => comprometido += safeFloat(s.acumulado));
    const libre = store.wallet.saldo - comprometido;
    let barras = store.wallet.sobres.map(s => {
        const pct = Math.min((s.acumulado/s.meta)*100, 100);
        return `
        <div style="margin-bottom:8px; font-size:0.8rem;">
            <div style="display:flex; justify-content:space-between;"><span>${s.desc}</span><span>${fmtMoney(s.acumulado)} / ${fmtMoney(s.meta)}</span></div>
            <div style="background:#e2e8f0; height:6px; border-radius:3px;"><div style="width:${pct}%; background:${s.tipo==='deuda'?'#ef4444':'#3b82f6'}; height:100%"></div></div>
        </div>`;
    }).join('');

    const html = `
        <div style="text-align:center; margin-bottom:15px;">
            <div style="background:#f0fdf4; padding:10px; border-radius:8px; border:1px solid #bbf7d0;">Libre: <strong style="color:#16a34a; font-size:1.2rem">${fmtMoney(libre)}</strong></div>
        </div>
        <h4>Estado de Sobres (Hoy)</h4>
        <div>${barras}</div>
    `;
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
            <td><div style="font-weight:600; font-size:0.9rem;">${m.desc}</div><div style="font-size:0.75rem; color:#94a3b8;">${m.categoria||'General'}</div></td>
            <td style="text-align:right; font-weight:bold; color:${m.tipo==='ingreso'?'#16a34a':'#ef4444'};">${m.tipo==='ingreso'?'+':'-'}${fmtMoney(m.monto)}</td>
        </tr>`).join('');
}

// --- 5. INTERFAZ (UI) CORREGIDA ---

const Modal = {
    showInput: (title, inputs, onConfirm) => {
        const m=$('appModal'), b=$('modalBody'), vals={};
        $('modalTitle').innerText = title; b.innerHTML='';
        inputs.forEach(c => {
            const d=document.createElement('div'); d.innerHTML=`<label style="display:block;font-size:0.8rem;color:#666;margin-top:5px">${c.label}</label>`;
            const i=document.createElement(c.type==='select'?'select':'input'); i.className='input-control'; i.style.width='100%'; i.style.padding='8px';
            if(c.type==='select') c.options.forEach(o=>{const op=document.createElement('option');op.value=o.value;op.innerText=o.text;i.appendChild(op)});
            else {i.type=c.type||'text';if(c.value!==undefined)i.value=c.value}
            i.onchange=e=>vals[c.key]=e.target.value; d.appendChild(i); b.appendChild(d);
        });
        $('modalConfirm').onclick=()=>{const is=b.querySelectorAll('input,select'); is.forEach((x,k)=>vals[inputs[k].key]=x.value); if(onConfirm(vals)!==false)m.style.display='none'};
        $('modalCancel').style.display='block'; $('modalCancel').onclick=()=>m.style.display='none'; m.style.display='flex';
    },
    showHtml: (t, h) => { const m=$('appModal'); $('modalTitle').innerText=t; $('modalBody').innerHTML=h; $('modalConfirm').onclick=()=>m.style.display='none'; $('modalCancel').style.display='none'; m.style.display='flex'; }
};

function updateAdminUI() {
    if($('kmActual')) $('kmActual').innerText = `${store.parametros.ultimoKM} km`;
    
    // Meta Diaria
    const metaHoy = store.wallet.sobres.reduce((a,b) => a + (b.meta - b.acumulado > 0 ? (b.meta/7) : 0), 0) + (120 * safeFloat(store.parametros.costoPorKm));
    if($('metaDiariaValor')) $('metaDiariaValor').innerText = fmtMoney(metaHoy);
    
    // Lógica de Turno (Corrección 1)
    const activo = !!store.turnoActivo;
    const btnIni = $('btnTurnoIniciar');
    const btnFin = $('btnTurnoFinalizar');
    
    if($('turnoEstado')) {
        $('turnoEstado').innerHTML = activo 
            ? `<span style="color:green; font-weight:bold">🟢 EN CURSO</span>` 
            : `<span style="color:#64748b; font-weight:bold">🔴 DETENIDO</span>`;
    }
    
    if(btnIni) btnIni.style.display = activo ? 'none' : 'block';
    if(btnFin) btnFin.style.display = activo ? 'block' : 'none';

    // Botón Reporte
    const zone = document.querySelector('#btnExportJSON')?.parentNode;
    if(zone && !document.getElementById('btnVerReporte')) {
        const btn = document.createElement('button'); btn.id = 'btnVerReporte'; btn.className = 'btn btn-primary'; btn.style.marginBottom = '10px'; btn.innerText = '📈 Ver Reporte'; btn.onclick = generarReporteSemanal; zone.prepend(btn);
    }
    
    // Deudas (Corrección 4)
    const sel = $('abonoDeudaSelect');
    if(sel) { 
        sel.innerHTML = '<option value="">-- Pagar Deuda --</option>'; 
        store.deudas.forEach(d => {
            if(d.saldo < 1) return;
            const sobre = store.wallet.sobres.find(s => s.refId === d.id);
            const acumulado = sobre ? safeFloat(sobre.acumulado) : 0;
            const falta = d.montoCuota - acumulado;
            const textoInfo = falta > 1 ? `(Faltan ${fmtMoney(falta)})` : `(Listo)`;
            
            const o = document.createElement('option'); o.value = d.id; o.innerText = `${d.desc} ${textoInfo}`; sel.appendChild(o);
        });
    }
}

function init() {
    console.log("🚀 APP V3.5 ESTABLE + FIX"); loadData();
    const page = document.body.dataset.page;
    document.querySelectorAll('.nav-link').forEach(l=>{if(l.getAttribute('href').includes(page))l.classList.add('active')});

    if(page === 'index') {
        const hoy=new Date().toDateString();
        const gan=store.turnos.filter(t=>new Date(t.fecha).toDateString()===hoy).reduce((a,b)=>a+b.ganancia,0);
        if($('resGananciaBruta')) $('resGananciaBruta').innerText=fmtMoney(gan);
        const m=document.querySelector('main.container'); let rd=$('resumenHumano');
        if(!rd&&m){rd=document.createElement('div');rd.id='resumenHumano';const c=m.querySelector('.card');if(c)c.insertAdjacentElement('afterend',rd);else m.prepend(rd);}
        if(rd) rd.innerHTML=generarResumenHumanoHoy(store);
    }
    if(page === 'historial') renderHistorialBlindado(store);
    if(page === 'wallet') {
        let comp=0; store.wallet.sobres.forEach(s=>comp+=safeFloat(s.acumulado));
        if($('valWallet')) $('valWallet').innerHTML=`${fmtMoney(store.wallet.saldo)}<br><small style="color:${store.wallet.saldo-comp>=0?'green':'orange'}">Libre: ${fmtMoney(store.wallet.saldo-comp)}</small>`;
        const m=document.querySelector('main.container'); let c=$('sobresContainer');
        if(!c&&m){c=document.createElement('div');c.id='sobresContainer';m.appendChild(c);}
        if(c) c.innerHTML=store.wallet.sobres.map(s=>`
            <div class="card" style="padding:12px; margin-top:10px; border-left:4px solid ${s.tipo==='deuda'?'#ef4444':'#3b82f6'}">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px"><strong>${s.desc}</strong><small>${fmtMoney(s.acumulado)} / ${fmtMoney(s.meta)}</small></div>
                <div style="background:#e2e8f0; height:8px; border-radius:4px;"><div style="width:${Math.min((s.acumulado/s.meta)*100,100)}%; background:${s.tipo==='deuda'?'#ef4444':'#3b82f6'}; height:100%; border-radius:4px;"></div></div>
            </div>`).join('');
    }
    if(page === 'admin') {
        updateAdminUI();
        setInterval(()=>{if($('turnoTimer')&&store.turnoActivo){const d=Date.now()-store.turnoActivo.inicio,h=Math.floor(d/3600000),m=Math.floor((d%3600000)/60000);$('turnoTimer').innerText=`${h}h ${m}m`}},1000);
        
        const bind=(i,f)=>{const e=$(i);if(e)e.onclick=x=>{x.preventDefault();f();updateAdminUI()}};

        // Corrección 2: KM Protegido
        const btnKm = $('btnConfigKM');
        if(btnKm) btnKm.onclick = (e) => { e.preventDefault(); alert("🔒 El KM se actualiza automáticamente con Turnos y Gasolina."); };
        
        // Corrección 3: Estilo Operativo
        if($('btnGastoOperativo')) $('btnGastoOperativo').className = 'btn btn-primary';

        bind('btnTurnoIniciar',()=>!store.turnoActivo&&(store.turnoActivo={inicio:Date.now()},saveData(),updateAdminUI()));
        bind('btnTurnoFinalizar',()=>Modal.showInput("Fin",[{label:"KM Final",key:"km",type:"number"},{label:"Ganancia",key:"g",type:"number"}],d=>finalizarTurno(d.km,d.g)));
        
        const wiz=(g)=>Modal.showInput(`Gasto ${g}`,[{label:"Desc",key:"d"},{label:"$$",key:"m",type:"number"},{label:"Cat",key:"c",type:"select",options:CATEGORIAS[g.toLowerCase()].map(x=>({value:x,text:x}))},{label:"Freq",key:"f",type:"select",options:Object.keys(FRECUENCIAS).map(x=>({value:x,text:x}))}],d=>procesarGasto(d.d,d.m,g,d.c,d.f));
        bind('btnGastoHogar',()=>wiz('Hogar')); 
        
        // Gasto Operativo Logic
        if($('btnGastoOperativo')) $('btnGastoOperativo').onclick = (e) => { e.preventDefault(); wiz('Operativo'); updateAdminUI(); };

        bind('btnGasolina',()=>Modal.showInput("Gas",[{label:"L",key:"l",type:"number"},{label:"$$",key:"c",type:"number"},{label:"KM",key:"k",type:"number"}],d=>registrarGasolina(d.l,d.c,d.k)));
        bind('btnDeudaNueva',()=>Modal.showInput("Deuda",[{label:"N",key:"n"},{label:"T",key:"t",type:"number"},{label:"C",key:"c",type:"number"},{label:"F",key:"f",type:"select",options:Object.keys(FRECUENCIAS).map(x=>({value:x,text:x}))},{label:"Día",key:"dp",type:"select",options:DIAS_SEMANA}],d=>agregarDeuda(d.n,d.t,d.c,d.f,d.dp)));
        bind('btnAbonoCuota',()=>abonarDeuda($('abonoDeudaSelect').value, store.deudas.find(x=>x.id==$('abonoDeudaSelect').value)?.montoCuota));
        bind('btnExportJSON',()=>navigator.clipboard.writeText(JSON.stringify(store)).then(()=>alert("Copiado")));
        bind('btnRestoreBackup',()=>Modal.showInput("Restaurar",[{label:"JSON",key:"j"}],d=>{try{store={...INITIAL_STATE,...JSON.parse(d.j)};sanearDatos();saveData();location.reload()}catch(e){alert("Error")}}));
    }
}
document.addEventListener('DOMContentLoaded', init);
                             
