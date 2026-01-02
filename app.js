/* =============================================================
   APP.JS - V9.9 (SEMANTIC UX GOLD MASTER)
   ============================================================= */

/* -------------------------------------------------------------
   SECCIÓN 1: CONFIGURACIÓN
   ------------------------------------------------------------- */
const STORAGE_KEY = "moto_finanzas_vFinal";
const LEGACY_KEYS = ["moto_finanzas_v3", "moto_finanzas", "app_moto_data"];
const SCHEMA_VERSION = 9.9;

const FRECUENCIAS = { 'Diario': 1, 'Semanal': 7, 'Quincenal': 15, 'Mensual': 30, 'Bimestral': 60, 'Anual': 365, 'Unico': 0 };
const MAPA_DIAS = { 1:1, 2:2, 3:3, 4:4, 5:5, 6:6, 0:7 }; // 1=Lun ... 7=Dom
const DIAS_SEMANA = [
    {val:"", txt:"Seleccionar..."}, {val:"1", txt:"Lunes"}, {val:"2", txt:"Martes"},
    {val:"3", txt:"Miércoles"}, {val:"4", txt:"Jueves"}, {val:"5", txt:"Viernes"},
    {val:"6", txt:"Sábado"}, {val:"0", txt:"Domingo"}
];

const CATEGORIAS_BASE = {
    operativo: ["Gasolina", "Mantenimiento", "Reparación", "Equipo", "Seguro"],
    hogar: ["Renta", "Comida", "Servicios", "Internet", "Salud", "Deudas", "Otro", "Ahorro", "Meta"]
};

// Utils UI Helpers
const $ = id => document.getElementById(id);
const safeFloat = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const fmtMoney = n => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(safeFloat(n));
const uuid = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

/* -------------------------------------------------------------
   SECCIÓN 2: ESTADO (FUENTE DE VERDAD - DOMAIN LAYER)
   ------------------------------------------------------------- */
const INITIAL_STATE = {
    schemaVersion: SCHEMA_VERSION,
    turnos: [], movimientos: [], cargasCombustible: [], deudas: [], gastosFijosMensuales: [],
    wallet: { saldo: 0, sobres: [] },
    parametros: { 
        ultimoKM: 0, costoPorKm: 0, metaDiaria: 0, metaBase: 0, deficitTotal: 0,
        moraVencida: 0, kmInicialConfigurado: false, saldoInicialConfigurado: false 
    },
    categoriasPersonalizadas: { operativo: [], hogar: [] },
    turnoActivo: null
};

let store = JSON.parse(JSON.stringify(INITIAL_STATE));

function loadData() {
    console.log("♻️ [V9.9] Semantic Presentation Layer Loaded.");
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
    const kms = [store.parametros.ultimoKM || 0, ...store.turnos.map(t => t.kmFinal || 0), ...store.cargasCombustible.map(c => c.km || 0)];
    store.parametros.ultimoKM = Math.max(...kms);
    if (store.turnoActivo && (!store.turnoActivo.inicio || !Number.isFinite(store.turnoActivo.inicio))) store.turnoActivo = null;
    reconstruirSobres(); calcularObjetivosYMeta(); saveData();
}

function reconstruirSobres() {
    const ensureSobre = (refId, tipo, desc, meta, freq, dp, cat) => {
        let s = store.wallet.sobres.find(x => x.refId === refId);
        if (!s) { s = { id: uuid(), refId, tipo, desc, acumulado: 0, objetivoHoy: 0 }; store.wallet.sobres.push(s); }
        s.meta = safeFloat(meta); s.frecuencia = freq; s.desc = desc; 
        if(dp) s.diaPago = dp; if(cat) s.categoria = cat;
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
    store.gastosFijosMensuales.forEach(g => { if(g.categoria !== 'Ahorro' && g.categoria !== 'Meta') metaEstaticaBase += sumarCuotaBase(g.monto, g.frecuencia); });
    
    const movimientosHoy = store.movimientos.filter(m => new Date(m.fecha).toDateString() === fechaHoyStr);
    let deficitTotalTeorico = 0; let moraVencidaReal = 0;     

    store.wallet.sobres.forEach(s => {
        if(s.categoria === 'Ahorro' || s.categoria === 'Meta') return;
        s.pagadoHoy = false; let yaPagado = false;
        if (s.tipo === 'deuda') yaPagado = movimientosHoy.some(m => m.tipo === 'gasto' && m.desc === `Abono: ${s.desc}`);
        else yaPagado = movimientosHoy.some(m => m.tipo === 'gasto' && m.desc === s.desc);

        let idealTeorico = 0;
        if (s.frecuencia === 'Diario') idealTeorico = s.meta;
        else if (s.frecuencia === 'Semanal') {
            const diaPago = parseInt(s.diaPago || 7); 
            let diasTranscurridos = (hoyIdx === diaPago) ? 7 : (hoyIdx > diaPago ? hoyIdx - diaPago : (7 - diaPago) + hoyIdx);
            idealTeorico = (s.meta / 7) * diasTranscurridos;
        } else if (s.frecuencia === 'Mensual') idealTeorico = (s.meta / 30) * diaMes;
        
        if (yaPagado) { s.pagadoHoy = true; s.objetivoHoy = (s.frecuencia === 'Diario') ? 0 : idealTeorico; } 
        else { s.objetivoHoy = Math.min(idealTeorico, s.meta); }
        
        if (s.frecuencia !== 'Diario') {
            if (s.acumulado < s.objetivoHoy) deficitTotalTeorico += (s.objetivoHoy - s.acumulado);
            const diaPago = parseInt(s.diaPago || 7);
            let cicloVencido = false;
            if (s.frecuencia === 'Semanal') cicloVencido = (hoyIdx > diaPago);
            else if (s.frecuencia === 'Mensual') cicloVencido = (diaMes > diaPago);
            if (cicloVencido && s.acumulado < s.meta) moraVencidaReal += (s.meta - s.acumulado);
        }
    });

    store.parametros.deficitTotal = deficitTotalTeorico; 
    store.parametros.moraVencida = moraVencidaReal;      
    store.parametros.metaBase = metaEstaticaBase;
    store.parametros.metaDiaria = store.parametros.metaBase + moraVencidaReal;
                                                             }
/* -------------------------------------------------------------
   SECCIÓN 3: ACCIONES (CAPA DE APLICACIÓN)
   ------------------------------------------------------------- */
function actionFinalizarTurno(kmFinal, ganancia) {
    const kF = safeFloat(kmFinal);
    const gan = safeFloat(ganancia);
    
    // UX CHECK: Advertencia suave, no bloqueo
    if (gan === 0) {
        if (!confirm("⚠️ CONFIRMACIÓN:\n\nEstás reportando $0.00 de ganancia.\nEsto afectará tus promedios.\n¿Es correcto?")) return;
    }
    if (kF < store.parametros.ultimoKM) return alert(`⛔ Error: KM actual (${kF}) es menor al anterior (${store.parametros.ultimoKM}).`);
    
    const fin = Date.now();
    const inicio = (store.turnoActivo && store.turnoActivo.inicio) ? store.turnoActivo.inicio : fin;
    const kmIni = (store.turnoActivo && store.turnoActivo.kmInicial) ? store.turnoActivo.kmInicial : store.parametros.ultimoKM;
    
    const duracionMin = (fin - inicio) / 60000;
    const duracionHoras = duracionMin / 60;

    store.turnos.push({
        id: uuid(), inicio: inicio, fin: fin, fecha: new Date(fin).toISOString(),
        duracionMin: duracionMin, duracionHoras: duracionHoras,
        ganancia: gan, kmInicial: kmIni, kmFinal: kF, kmRecorrido: kF - kmIni
    });
    store.movimientos.push({ id: uuid(), fecha: new Date().toISOString(), tipo: 'ingreso', desc: 'Turno Finalizado', monto: gan });
    store.parametros.ultimoKM = kF; store.turnoActivo = null; 
    sanearDatos(); renderAdmin();
}

function actionGasolina(l, c, k) {
    const km = safeFloat(k);
    if(km < store.parametros.ultimoKM && km > 0) return alert("⛔ KM inválido.");
    const costoGas = safeFloat(c);

    store.cargasCombustible.push({ id: uuid(), fecha: new Date().toISOString(), litros: l, costo: costoGas, km: km });
    store.movimientos.push({ id: uuid(), fecha: new Date().toISOString(), tipo: 'gasto', desc: '⛽ Gasolina', monto: costoGas, categoria: 'Operativo' });
    
    // LOGICA DE DOMINIO: Descontar del sobre (Entidad Gasolina)
    const sobreGas = store.wallet.sobres.find(s => 
        (s.categoria === 'Operativo' && (s.desc.toLowerCase().includes('gas') || s.desc.toLowerCase().includes('combustible')))
    );
    if (sobreGas && sobreGas.acumulado > 0) {
        sobreGas.acumulado -= costoGas;
        if(sobreGas.acumulado < 0) sobreGas.acumulado = 0;
    }

    if(km > store.parametros.ultimoKM) store.parametros.ultimoKM = km;
    sanearDatos(); alert("✅ Registrado");
}

function actionNuevaMetaAhorro(desc, montoObjetivo) { actionNuevoGasto(desc, montoObjetivo, 'Ahorro', 'Unico'); }
function actionAbonarAhorro(id, monto) {
    const s = store.wallet.sobres.find(x => x.id === id); if(!s) return;
    store.movimientos.push({ id: uuid(), fecha: new Date().toISOString(), tipo: 'gasto', desc: `Abono: ${s.desc}`, monto: safeFloat(monto), categoria: 'Ahorro' });
    s.acumulado += safeFloat(monto); sanearDatos(); alert("💎 Ahorro registrado");
}

function actionNuevoGasto(desc, monto, cat, freq) {
    const id = uuid();
    if(freq !== 'Unico' || cat === 'Ahorro') store.gastosFijosMensuales.push({ id, desc, monto, categoria: cat, frecuencia: freq });
    if (freq === 'Unico' && cat !== 'Ahorro') store.movimientos.push({ id, fecha: new Date().toISOString(), tipo: 'gasto', desc, monto, categoria: cat });
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
    const s = store.wallet.sobres.find(x => x.refId === id); if(s) { s.acumulado -= gf.monto; if(s.acumulado < 0) s.acumulado = 0; }
    sanearDatos(); alert("✅ Pagado");
}

function actionConfigurarKM(n) { const k=safeFloat(n); if(k<=0) return alert("Error"); store.parametros.ultimoKM=k; store.parametros.kmInicialConfigurado=true; saveData(); renderAdmin(); alert("✅ OK"); }
function actionSaldoInicial(n) { const m=safeFloat(n); if(m<0) return alert("Error"); store.movimientos.push({ id:uuid(), fecha:new Date().toISOString(), tipo:'ingreso', desc:'Saldo Inicial', monto:m, categoria:'Sistema'}); store.parametros.saldoInicialConfigurado=true; sanearDatos(); renderAdmin(); alert("✅ OK"); }
  /* -------------------------------------------------------------
   SECCIÓN 4: RENDERIZADO (UI V9.9 - HONEST UX)
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
        $('modalConfirm').onclick = () => { const d={}; b.querySelectorAll('.input-control').forEach(el=>d[el.dataset.k]=el.value); cb(d); m.style.display='none'; };
        $('modalCancel').onclick = () => m.style.display='none'; m.style.display='flex';
    }
};

function renderIndex() {
    if (!$('resGananciaBruta')) return;
    const hoy = new Date().toDateString();
    const gan = store.turnos.filter(t => new Date(t.fecha).toDateString() === hoy).reduce((a, b) => a + b.ganancia, 0);
    $('resGananciaBruta').innerText = fmtMoney(gan);

    const saldo = store.wallet.saldo;
    let ahorroTotal = 0;
    
    // VARIABLES DE ESTADO UI
    let vencidoHistorico = 0; // Mora real (Ayer y antes)
    let compromisoHoy = 0;    // Exigible del día (Hoy)
    let proyeccionCiclos = 0; // Futuro

    store.wallet.sobres.forEach(s => { 
        if (s.categoria === 'Ahorro' || s.categoria === 'Meta') {
            ahorroTotal += s.acumulado;
        } else {
            // Lógica de fechas visual para UI
            const hoyIdx = MAPA_DIAS[new Date().getDay()];
            const diaPago = parseInt(s.diaPago || 7);
            const diaPagoNorm = diaPago === 0 ? 7 : diaPago;
            const diaMes = new Date().getDate();

            if (s.frecuencia === 'Diario') {
                if (!s.pagadoHoy) compromisoHoy += s.meta;
            } else {
                let esVencido = false; 
                let esHoy = false;     

                if (s.frecuencia === 'Semanal') {
                    if (hoyIdx > diaPagoNorm) esVencido = true;
                    if (hoyIdx === diaPagoNorm) esHoy = true;
                } else if (s.frecuencia === 'Mensual') {
                    if (diaMes > diaPago) esVencido = true;
                    if (diaMes === diaPago) esHoy = true;
                }

                const faltante = s.meta - s.acumulado;
                if (esVencido && faltante > 0) vencidoHistorico += faltante;
                else if (esHoy && faltante > 0) compromisoHoy += faltante;
                else if (s.acumulado < s.objetivoHoy) proyeccionCiclos += (s.objetivoHoy - s.acumulado);
            }
        }
    });

    const disponible = saldo - (vencidoHistorico + compromisoHoy) - ahorroTotal;
    const metaDiariaCalculada = safeFloat(store.parametros.metaDiaria); 

    // SEMÁFORO UX (Honestidad Financiera)
    let uiEstado = { color: '', titulo: '', msg: '' };

    if (vencidoHistorico > 0) {
        uiEstado.color = 'var(--danger)'; 
        uiEstado.titulo = '⚠️ Atención Requerida';
        uiEstado.msg = `Tienes pagos atrasados por <b>${fmtMoney(vencidoHistorico)}</b>. Prioridad alta.`;
    } else if (compromisoHoy > 0) {
        uiEstado.color = '#d97706'; // Ambar
        uiEstado.titulo = '📅 Compromisos de Hoy';
        uiEstado.msg = `Hoy toca cubrir <b>${fmtMoney(compromisoHoy)}</b>. Mantén el ritmo.`;
    } else {
        uiEstado.color = '#16a34a'; // Verde
        uiEstado.titulo = '✅ Todo en Orden';
        uiEstado.msg = 'Estás al corriente. Sin pagos pendientes por hoy.';
    }

    const html = `
    <div class="card" style="padding:20px; text-align:center;">
        <small style="color:var(--text-sec); text-transform:uppercase; font-size:0.75rem; letter-spacing:1px;">Saldo en Caja</small>
        <div style="font-size:2.8rem; font-weight:800; color:var(--text-main); line-height:1.2;">${fmtMoney(saldo)}</div>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:5px; margin-top:15px; border-top:1px solid #f1f5f9; padding-top:10px;">
            <div style="text-align:center;">
                <small style="color:${uiEstado.color}; font-weight:bold;">${compromisoHoy + vencidoHistorico > 0 ? '📉 Por Pagar' : '✅ Al día'}</small>
                <div style="font-weight:600; font-size:0.9rem; color:${uiEstado.color}">${fmtMoney(compromisoHoy + vencidoHistorico)}</div>
            </div>
            <div style="text-align:center;">
                <small style="color:#6366f1; font-weight:bold;">💎 Ahorro</small>
                <div style="font-weight:600; font-size:0.9rem;">${fmtMoney(ahorroTotal)}</div>
            </div>
            <div style="text-align:center;">
                <small style="color:${disponible < 0 ? 'var(--danger)' : 'var(--text-sec)'}; font-size:0.7rem;">Disponible</small>
                <div style="font-weight:600; font-size:0.9rem; color:${disponible < 0 ? 'var(--danger)' : 'var(--text-main)'}">${fmtMoney(disponible)}</div>
            </div>
        </div>
    </div>

    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:15px;">
        <div class="card" style="padding:12px; background:#fff1f2; border:1px solid #fda4af;">
            <strong style="color:#be123c; font-size:0.8rem;">🎯 OBJETIVO PRODUCCIÓN</strong>
            <div style="font-weight:800; color:#881337; font-size:1.1rem;">${fmtMoney(metaDiariaCalculada)}</div>
            <small style="color:#9f1239; font-size:0.7rem;">Base Operativa + Mora</small>
        </div>
        
        <div class="card" style="padding:12px; background:#f8fafc; border:1px solid ${uiEstado.color}; border-left-width: 4px;">
            <strong style="color:${uiEstado.color}; font-size:0.8rem;">${uiEstado.titulo}</strong>
            <div style="font-size:0.75rem; color:#334155; margin-top:4px; line-height:1.3;">${uiEstado.msg}</div>
        </div>
    </div>`;
    
    const container = $('resumenHumanoContainer'); if(container) container.innerHTML = html;
}

function renderWallet() {
    if (!$('valWallet')) return;
    const saldo = store.wallet.saldo;
    let ahorroTotal = 0;
    store.wallet.sobres.forEach(s => { if (s.categoria === 'Ahorro' || s.categoria === 'Meta') ahorroTotal += s.acumulado; });
    
    $('valWallet').innerHTML = ahorroTotal > 0 ? 
        `<div style="text-align:center; margin-bottom:15px;"><div style="font-size:0.8rem; color:#aaa;">PATRIMONIO</div><div style="font-size:2rem; font-weight:bold; color:#6366f1;">${fmtMoney(ahorroTotal)}</div></div>` :
        `<div style="text-align:center; padding:10px; color:#94a3b8; font-size:0.85rem; margin-bottom:10px;">Tu patrimonio empieza con el primer abono.</div>`;

    const container = $('sobresContainer'); if(!container) return; container.innerHTML = '';
    const hoyIdx = MAPA_DIAS[new Date().getDay()];
    const diaMes = new Date().getDate();

    store.wallet.sobres.forEach(s => {
        // TIPO AHORRO
        if (s.categoria === 'Ahorro' || s.categoria === 'Meta') {
            const pct = s.meta > 0 ? Math.min((s.acumulado / s.meta) * 100, 100) : 0;
            container.innerHTML += `
            <div class="card" style="padding:15px; border:1px solid #e0e7ff; background:linear-gradient(to right, #fff, #f5f3ff);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                    <strong style="color:#4f46e5;">💎 ${s.desc}</strong>
                    <div style="font-weight:bold; color:#4338ca;">${fmtMoney(s.acumulado)}</div>
                </div>
                <div style="height:8px; background:#e0e7ff; border-radius:4px; overflow:hidden;"><div style="width:${pct}%; background:#6366f1; height:100%;"></div></div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;">
                    <span style="font-size:0.7rem; color:#6366f1;">Meta: ${fmtMoney(s.meta)}</span>
                    <button class="btn btn-sm" style="background:#6366f1; color:white; border:none; padding:8px 12px; border-radius:4px; font-size:0.75rem; cursor:pointer; z-index:99; position:relative;" onclick="Modal.show('Abonar', [{label:'Monto',key:'m',type:'number'}], d => actionAbonarAhorro('${s.id}', d.m))">+ ABONAR</button>
                </div>
            </div>`;
            return;
        }
        
        // TIPO GASOLINA
        if (s.categoria === 'Operativo' && (s.desc.toLowerCase().includes('gas') || s.desc.toLowerCase().includes('combustible'))) {
            container.innerHTML += `
            <div class="card" style="padding:15px; border-left:4px solid #f59e0b; background:#fffbeb;">
                <div style="display:flex; justify-content:space-between;">
                    <div><strong style="color:#b45309;">⛽ ${s.desc}</strong></div>
                    <div style="text-align:right;">
                        <div style="font-weight:bold; color:#78350f;">${fmtMoney(s.acumulado)}</div>
                        <small style="color:#b45309;">${s.acumulado < 100 ? 'Reserva Baja' : 'Disponible'}</small>
                    </div>
                </div>
            </div>`;
            return;
        }

        // TIPO GASTO DIARIO
        if (s.frecuencia === 'Diario') {
            if(s.pagadoHoy) {
                container.innerHTML += `
                <div class="card" style="padding:10px 15px; border-left:4px solid #cbd5e1; background:#f8fafc; opacity:0.6;">
                    <div style="display:flex; justify-content:space-between; align-items: center;">
                        <span style="color:#64748b;">${s.desc}</span>
                        <span style="font-size:0.75rem; color:#64748b;">✔ Cubierto hoy</span>
                    </div>
                </div>`;
            } else {
                 container.innerHTML += `
                <div class="card" style="padding:10px 15px; border-left:4px solid #d97706; background:#fff7ed;">
                    <div style="display:flex; justify-content:space-between; align-items: center;">
                        <strong style="color:#9a3412;">${s.desc}</strong>
                        <span style="font-size:0.75rem; color:#9a3412;">Pendiente hoy (${fmtMoney(s.meta)})</span>
                    </div>
                </div>`;
            }
            return;
        }

        // TIPO CICLOS Y DEUDAS (SEMÁFORO)
        let valorMeta = s.meta;
        let valorAcumulado = s.acumulado;
        let pct = Math.min((valorAcumulado / valorMeta) * 100, 100);
        
        let estadoStr = "";
        let colorBarra = "#3b82f6"; 
        let bordeColor = "#3b82f6"; 

        const diaPago = parseInt(s.diaPago || 7);
        const diaPagoNorm = diaPago === 0 ? 7 : diaPago;
        
        let esVencido = false;
        let esHoy = false;
        
        if (s.frecuencia === 'Semanal') {
            if (hoyIdx > diaPagoNorm && s.acumulado < s.meta) esVencido = true;
            if (hoyIdx === diaPagoNorm && s.acumulado < s.meta) esHoy = true;
        } else if (s.frecuencia === 'Mensual') {
            if (diaMes > diaPago && s.acumulado < s.meta) esVencido = true;
            if (diaMes === diaPago && s.acumulado < s.meta) esHoy = true;
        }

        if (esVencido) {
            estadoStr = "⚠️ VENCIDO";
            colorBarra = "#dc2626"; bordeColor = "#dc2626"; // ROJO
        } else if (esHoy) {
            estadoStr = "📅 TOCA HOY";
            colorBarra = "#d97706"; bordeColor = "#d97706"; // NARANJA
        } else {
            const falta = s.objetivoHoy - s.acumulado;
            if (falta > 1) {
                estadoStr = `En progreso`;
                colorBarra = "#3b82f6"; 
            } else {
                estadoStr = "Ciclo cubierto";
                colorBarra = "#16a34a"; bordeColor = "#16a34a"; // VERDE
            }
        }

        container.innerHTML += `
        <div class="card" style="padding:15px; border-left:4px solid ${bordeColor};">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <strong>${s.desc}</strong>
                <div style="text-align:right;">
                    <div style="font-weight:bold;">${fmtMoney(valorAcumulado)}</div>
                    <small style="color:${colorBarra}; font-weight:bold;">${estadoStr}</small>
                </div>
            </div>
            <div style="height:6px; background:#e2e8f0; border-radius:3px; overflow:hidden;">
                <div style="width:${pct}%; background:${colorBarra}; height:100%;"></div>
            </div>
             <div style="text-align:right; font-size:0.65rem; color:#94a3b8; margin-top:2px;">Meta: ${fmtMoney(valorMeta)}</div>
        </div>`;
    });
}
/* -------------------------------------------------------------
   RENDER ADMIN & STATS (V9.9 - FINAL FIX)
   ------------------------------------------------------------- */
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
    
    // 1. ZONA DE GASTOS RECURRENTES (DOM Injection Robusto)
    let divRecur = document.getElementById('zoneRecurrentes');
    if(!divRecur && $('btnGastoHogar')) {
        divRecur = document.createElement('div'); 
        divRecur.id = 'zoneRecurrentes';
        divRecur.className = 'card'; 
        divRecur.style.padding = '10px'; 
        divRecur.style.background = '#f8fafc'; 
        divRecur.style.marginBottom = '15px'; 
        const parent = $('btnGastoHogar').parentElement.parentElement;
        const ref = $('btnGastoHogar').parentElement;
        parent.insertBefore(divRecur, ref);
    }
    
    if(divRecur) {
         const recurrentes = store.gastosFijosMensuales.filter(g => g.frecuencia !== 'Unico' && g.categoria !== 'Ahorro' && g.categoria !== 'Meta');
         
         if(recurrentes.length === 0) {
             divRecur.innerHTML = `
                <h4 style="font-size:0.9rem; color:#64748b; margin-bottom:5px;">Pagar Recurrente</h4>
                <div style="padding:10px; text-align:center; border:1px dashed #cbd5e1; border-radius:6px; background:#fff;">
                    <small style="color:#94a3b8;">No hay gastos fijos configurados.</small>
                </div>`;
         } else {
             divRecur.innerHTML = `
                <h4 style="font-size:0.9rem; color:#64748b; margin-bottom:5px;">Pagar Recurrente</h4>
                <div style="display:flex; gap:8px;">
                    <select id="selRecurrente" class="input-control" style="margin:0; flex-grow:1;"></select>
                    <button id="btnDoPay" class="btn btn-success" style="width:auto; min-width:60px;">OK</button>
                </div>`;
             
             const sel = document.getElementById('selRecurrente');
             sel.innerHTML = '<option value="">Seleccionar...</option>';
             recurrentes.forEach(g => {
                 const opt = document.createElement('option'); 
                 opt.value = g.id; 
                 opt.innerText = `${g.desc} (${fmtMoney(g.monto)})`; 
                 sel.add(opt);
             });

             const btn = document.getElementById('btnDoPay');
             btn.onclick = function() {
                 const val = sel.value;
                 if(!val) return alert("⚠️ Selecciona un gasto.");
                 if(confirm("¿Confirmar pago? Se descontará de la caja.")) { actionPagarRecurrente(val); }
             };
         }
    }

    // 2. LISTA DEUDAS
    const ul = $('listaDeudasAdmin');
    if(ul) {
        ul.innerHTML = store.deudas.length === 0 ? 
            '<div style="text-align:center; padding:15px; color:#64748b; font-size:0.9rem;">🎉 Sin deudas registradas</div>' : 
            store.deudas.map(d => `<li style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #eee;"><span>${d.desc}</span><span style="font-weight:bold;">${fmtMoney(d.saldo)}</span></li>`).join('');
    }

    // 3. SELECTOR DEUDAS Y BOTÓN OK (🔧 FIX APLICADO AQUÍ)
    const selD = $('abonoDeudaSelect');
    const btnAbono = $('btnAbonoCuota'); // Recuperamos el botón
    
    if(selD) {
        selD.innerHTML = '<option value="">Seleccionar...</option>';
        if(store.deudas.length === 0) selD.add(new Option("Sin deudas", ""));
        else store.deudas.forEach(d => { if(d.saldo >= 1) selD.add(new Option(`${d.desc} (${fmtMoney(d.montoCuota)})`, d.id)); });

        // REACTIVACIÓN DEL BOTÓN OK
        if(btnAbono) {
            btnAbono.onclick = () => {
                const v = selD.value;
                if(!v) return alert("⚠️ Selecciona una deuda para abonar.");
                if(confirm("¿Confirmar abono a deuda?")) actionAbonarDeuda(v);
            };
        }
    }

    $('kmActual').innerText = `${store.parametros.ultimoKM} km`;
    
    const btnKM = $('btnConfigKM');
    if (store.parametros.kmInicialConfigurado) {
        btnKM.innerText = "🔒 Auto"; btnKM.className = "btn btn-outline"; btnKM.onclick = () => alert("Gestionado automáticamente.");
    } else {
        btnKM.innerText = "🔓 Configurar"; btnKM.className = "btn btn-primary"; btnKM.onclick = () => Modal.show("Configurar KM", [{label:"KM",key:"km",type:"number"}], d => actionConfigurarKM(d.km));
    }

    const saldo = store.wallet.saldo;
    if($('valSaldoAdmin')) $('valSaldoAdmin').innerText = fmtMoney(saldo);

    // UX: NOMBRE CORRECTO META
    const metaValor = $('metaDiariaValor');
    if (metaValor) {
        metaValor.innerText = fmtMoney(safeFloat(store.parametros.metaDiaria));
        const cardTitle = metaValor.previousElementSibling; if(cardTitle) cardTitle.innerText = "Objetivo Producción Base";
    }
    
    const btnSaldo = $('btnConfigSaldo');
    if (store.parametros.saldoInicialConfigurado) {
        btnSaldo.innerText = "🔒 Auto"; btnSaldo.className = "btn btn-outline"; btnSaldo.onclick = () => alert("Gestionado por flujo.");
    } else {
        btnSaldo.innerText = "🔓 Capital"; btnSaldo.className = "btn btn-primary"; btnSaldo.onclick = () => Modal.show("Capital", [{label:"Monto",key:"s",type:"number"}], d => actionSaldoInicial(d.s));
    }
    
    const adminZone = document.querySelector('.container');
    if(adminZone && !document.getElementById('zoneAhorro')) {
        const div = document.createElement('div'); div.id = 'zoneAhorro';
        div.className = 'card'; div.style.padding = '15px'; div.style.marginTop = '15px'; div.style.borderLeft = '4px solid #6366f1';
        div.innerHTML = `<h3 style="color:#4f46e5; margin-top:0;">💎 Metas de Ahorro</h3><p style="font-size:0.85rem; color:#64748b;">(Moto, Seguro, Fondo)</p><button class="btn btn-outline" id="btnNewAhorro" style="border-color:#6366f1; color:#6366f1;">+ Nueva Meta</button>`;
        const listaDeudas = $('listaDeudasAdmin'); if(listaDeudas) listaDeudas.parentElement.parentElement.insertBefore(div, listaDeudas.parentElement);
        div.querySelector('#btnNewAhorro').onclick = () => Modal.show("Nueva Meta", [{label:"Nombre",key:"d"}, {label:"Monto Total",key:"m",type:"number"}], d => actionNuevaMetaAhorro(d.d, d.m));
    }
    
    const btnIni = $('btnTurnoIniciar');
    const btnFin = $('btnTurnoFinalizar');
    
    if(btnIni) btnIni.onclick = () => { store.turnoActivo = { inicio: Date.now(), kmInicial: store.parametros.ultimoKM }; saveData(); renderAdmin(); };
    if(btnFin) btnFin.onclick = () => Modal.show("Cerrar Turno", [{label:"KM Final",key:"k",type:"number"},{label:"Ganancia ($)",key:"g",type:"number"}], d => actionFinalizarTurno(d.k, d.g));

    // Botones estáticos de Admin
    if($('btnGasolina')) $('btnGasolina').onclick = () => Modal.show("Gasolina", [{label:"Litros",key:"l",type:"number"},{label:"Costo ($)",key:"c",type:"number"},{label:"KM Actual",key:"k",type:"number"}], d => actionGasolina(d.l, d.c, d.k));
    if($('btnGastoHogar')) $('btnGastoHogar').onclick = () => {
         const allCats = [...CATEGORIAS_BASE['hogar'], ...(store.categoriasPersonalizadas.hogar||[]), "➕ Crear nueva..."];
         Modal.show("Nuevo Gasto Hogar", [{label:"Descripción",key:"d"},{label:"Monto",key:"m",type:"number"},{label:"Categoría",key:"c",type:"select",options:allCats.map(x=>({val:x,txt:x}))},{label:"Frecuencia",key:"f",type:"select",options:Object.keys(FRECUENCIAS).map(x=>({val:x,txt:x}))}], d => actionNuevoGasto(d.d, d.m, d.c, d.f));
    };
    if($('btnGastoOperativo')) $('btnGastoOperativo').onclick = () => {
         const allCats = [...CATEGORIAS_BASE['operativo'], ...(store.categoriasPersonalizadas.operativo||[]), "➕ Crear nueva..."];
         Modal.show("Nuevo Gasto Operativo", [{label:"Descripción",key:"d"},{label:"Monto",key:"m",type:"number"},{label:"Categoría",key:"c",type:"select",options:allCats.map(x=>({val:x,txt:x}))},{label:"Frecuencia",key:"f",type:"select",options:Object.keys(FRECUENCIAS).map(x=>({val:x,txt:x}))}], d => actionNuevoGasto(d.d, d.m, d.c, d.f));
    };
    if($('btnDeudaNueva')) $('btnDeudaNueva').onclick = () => Modal.show("Nueva Deuda", [{label:"Nombre",key:"d"},{label:"Total",key:"t",type:"number"},{label:"Cuota",key:"c",type:"number"},{label:"Frecuencia",key:"f",type:"select",options:Object.keys(FRECUENCIAS).map(x=>({val:x,txt:x}))},{label:"Día Pago",key:"dp",type:"select",options:DIAS_SEMANA}], d => actionNuevaDeuda(d.d, d.t, d.c, d.f, d.dp));
    if($('btnExportJSON')) $('btnExportJSON').onclick = () => navigator.clipboard.writeText(JSON.stringify(store)).then(() => alert("Copiado"));
    if($('btnRestoreBackup')) $('btnRestoreBackup').onclick = () => Modal.show("Restaurar", [{label:"JSON",key:"j"}], d => { try { store = {...INITIAL_STATE, ...JSON.parse(d.j)}; sanearDatos(); location.reload(); } catch(e){ alert("Error"); } });

    if(store.turnoActivo) {
        $('turnoEstado').innerHTML = '<span class="text-green">🟢 EN CURSO</span>';
        btnIni.classList.add('hidden'); btnFin.classList.remove('hidden');
        if(!window.timerInterval) window.timerInterval = setInterval(() => {
            const diff = Date.now() - store.turnoActivo.inicio;
            $('turnoTimer').innerText = `${Math.floor(diff/3600000)}h ${Math.floor((diff%3600000)/60000)}m`;
        }, 1000);
    } else {
        $('turnoEstado').innerHTML = '🔴 Detenido'; $('turnoTimer').innerText = "00:00:00";
        btnIni.classList.remove('hidden'); btnFin.classList.add('hidden');
        if(window.timerInterval) { clearInterval(window.timerInterval); window.timerInterval = null; }
    }
}

function renderStats() {
    if (!document.getElementById('statIngresoHora')) return;
    const hoy = new Date(); const limite = new Date(); limite.setDate(hoy.getDate() - 7);
    const turnosRecientes = store.turnos.filter(t => new Date(t.fecha) >= limite);
    
    let totalIngresos = 0; let totalHoras = 0; let totalGasolina = 0;
    turnosRecientes.forEach(t => {
        totalIngresos += safeFloat(t.ganancia);
        let horas = 0;
        if (typeof t.duracionHoras === 'number') horas = t.duracionHoras;
        else { const fin = new Date(t.fecha).getTime(); const inicio = t.inicio ? new Date(t.inicio).getTime() : fin; horas = (fin - inicio) / 3600000; }
        totalHoras += horas;
    });

    store.movimientos.forEach(m => { if(new Date(m.fecha) >= limite && m.desc.toLowerCase().includes('gasolina')) totalGasolina += safeFloat(m.monto); });

    const diasTrabajados = new Set(turnosRecientes.map(t => new Date(t.fecha).toDateString())).size;
    const ingresoNeto = totalIngresos - totalGasolina;
    const promedioHora = totalHoras > 0 ? (totalIngresos / totalHoras) : 0;
    const netoHora = totalHoras > 0 ? (ingresoNeto / totalHoras) : 0;
    
    $('statIngresoHora').innerText = totalHoras > 0 ? fmtMoney(promedioHora) : "—";
    if(!document.getElementById('statNeto')) {
        const div = document.createElement('div'); div.id = 'statNeto'; div.style.fontSize = '0.75rem'; div.style.color = '#64748b'; div.style.marginTop = '4px'; $('statIngresoHora').parentElement.appendChild(div);
    }
    $('statNeto').innerText = totalHoras > 0 ? `Neto: ${fmtMoney(netoHora)}/h` : "Sin datos";
    $('statHorasTotal').innerText = totalHoras.toFixed(1) + "h";
    $('statDiasTrabajados').innerText = diasTrabajados;
    $('statIngresoDiario').innerText = diasTrabajados > 0 ? fmtMoney(totalIngresos / diasTrabajados) : "$0.00";
    $('statMetaDiaria').innerText = fmtMoney(safeFloat(store.parametros.metaDiaria));
    
    const elDiag = $('statsDiagnostico');
    if (totalHoras > 0) {
        let margen = totalIngresos > 0 ? (100 - ((totalGasolina/totalIngresos)*100)).toFixed(1) : 0;
        elDiag.innerHTML = `<strong>Margen Real: ${margen}%</strong><br><span style="color:#64748b; font-size:0.8rem;">(Ganancia retenida tras combustible)</span>`;
    } else {
        elDiag.innerHTML = `<span style="color:#64748b;">Registra actividad reciente para ver tu análisis de rendimiento.</span>`;
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
        if (typeof t.duracionHoras === 'number') horas = t.duracionHoras;
        else { const fin = new Date(t.fecha).getTime(); const inicio = t.inicio ? new Date(t.inicio).getTime() : fin; horas = (fin - inicio) / 3600000; }
        totalHoras += horas;
    });
    $('uiTurnosHoy').innerText = turnosHoy.length;
    $('uiHorasHoy').innerText = totalHoras > 0 ? totalHoras.toFixed(1) + 'h' : '0h';
    $('uiIngresoHoraHoy').innerText = totalHoras > 0 ? fmtMoney(totalGanancia / totalHoras) : '—';
    const lista = $('uiCompromisos'); lista.innerHTML = ''; lista.parentElement.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 V9.9 SEMANTIC UX ACTIVE");
    loadData();
    const page = document.body.dataset.page;
    if (page === 'index') { renderIndex(); renderDashboardContext(); }
    if (page === 'wallet') renderWallet();
    if (page === 'historial') renderHistorial();
    if (page === 'stats') renderStats();
    if (page === 'admin') renderAdmin();
});


