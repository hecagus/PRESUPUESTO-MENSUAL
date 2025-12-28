/* =============================================================
   APP.JS - V8.4 (MODELO FINANCIERO ESTRICTO - OBLIGACIONES X TIEMPO)
   ============================================================= */

/* -------------------------------------------------------------
   SECCIÓN 1: CONFIGURACIÓN
   ------------------------------------------------------------- */
const STORAGE_KEY = "moto_finanzas_vFinal";
const LEGACY_KEYS = ["moto_finanzas_v3", "moto_finanzas", "app_moto_data"];
const SCHEMA_VERSION = 8.4;

const FRECUENCIAS = { 'Diario': 1, 'Semanal': 7, 'Quincenal': 15, 'Mensual': 30, 'Bimestral': 60, 'Anual': 365, 'Unico': 0 };
// Mapeo de días para cálculo de ciclos (Lunes=1 ... Domingo=7 para facilitar mates)
const MAPA_DIAS = { 1:1, 2:2, 3:3, 4:4, 5:5, 6:6, 0:7 }; 
const DIAS_SEMANA = [
    {val:"", txt:"Seleccionar..."}, {val:"1", txt:"Lunes"}, {val:"2", txt:"Martes"},
    {val:"3", txt:"Miércoles"}, {val:"4", txt:"Jueves"}, {val:"5", txt:"Viernes"},
    {val:"6", txt:"Sábado"}, {val:"0", txt:"Domingo"}
];

// Categorías BASE
const CATEGORIAS_BASE = {
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
    parametros: { 
        ultimoKM: 0, 
        costoPorKm: 0, 
        metaDiaria: 0, 
        deficitTotal: 0, // NUEVO V8.4
        kmInicialConfigurado: false, 
        saldoInicialConfigurado: false 
    },
    categoriasPersonalizadas: { operativo: [], hogar: [] },
    turnoActivo: null
};

let store = JSON.parse(JSON.stringify(INITIAL_STATE));

function loadData() {
    console.log("♻️ [V8.4] Modelo Financiero Estricto Cargado.");
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

            // AUTO-MIGRACIÓN
            if (store.parametros.ultimoKM > 0) store.parametros.kmInicialConfigurado = true;
            
            sanearDatos();
        } catch (e) { console.error("❌ Error carga:", e); }
    }
}

function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }

function sanearDatos() {
    // 1. Recalcular Saldo
    let saldo = 0;
    store.movimientos.forEach(m => {
        if (m.tipo === 'ingreso') saldo += safeFloat(m.monto);
        if (m.tipo === 'gasto') saldo -= safeFloat(m.monto);
    });
    store.wallet.saldo = saldo;

    // 2. Recalcular KM
    const kms = [
        store.parametros.ultimoKM || 0,
        ...store.turnos.map(t => t.kmFinal || 0),
        ...store.cargasCombustible.map(c => c.km || 0)
    ];
    store.parametros.ultimoKM = Math.max(...kms);

    // 3. Limpieza de Turno
    if (store.turnoActivo && (!store.turnoActivo.inicio || !Number.isFinite(store.turnoActivo.inicio))) {
        store.turnoActivo = null;
    }

    reconstruirSobres();
    calcularObjetivosYMeta(); // <--- AQUÍ OCURRE LA MAGIA V8.4
    saveData();
}

function reconstruirSobres() {
    const ensureSobre = (refId, tipo, desc, meta, freq, dp) => {
        let s = store.wallet.sobres.find(x => x.refId === refId);
        if (!s) {
            s = { id: uuid(), refId, tipo, desc, acumulado: 0, objetivoHoy: 0 };
            store.wallet.sobres.push(s);
        }
        s.meta = safeFloat(meta); s.frecuencia = freq; s.desc = desc; 
        if(dp) s.diaPago = dp;
    };
    store.deudas.forEach(d => { if(d.saldo > 0) ensureSobre(d.id, 'deuda', d.desc, d.montoCuota, d.frecuencia, d.diaPago); });
    store.gastosFijosMensuales.forEach(g => ensureSobre(g.id, 'gasto', g.desc, g.monto, g.frecuencia));
}

// === [CORE V8.4] MOTOR FINANCIERO ESTRICTO ===
function calcularObjetivosYMeta() {
    const fechaHoy = new Date();
    const hoyIdx = MAPA_DIAS[fechaHoy.getDay()]; // 1=Lun ... 7=Dom
    const diaMes = fechaHoy.getDate();
    const fechaHoyStr = fechaHoy.toDateString();
    
    // 1. CÁLCULO DE META ESTÁTICA BASE (OBLIGACIONES FIJAS)
    // Esto es lo que "cuesta" vivir hoy, pagues o no pagues.
    let metaEstaticaBase = 0;
    
    // Sumar cuotas diarias de deudas
    store.deudas.forEach(d => {
        if(d.saldo <= 0) return;
        let cuotaDiaria = 0;
        if(d.frecuencia === 'Semanal') cuotaDiaria = safeFloat(d.montoCuota) / 7;
        else if(d.frecuencia === 'Mensual') cuotaDiaria = safeFloat(d.montoCuota) / 30;
        else if(d.frecuencia === 'Diario') cuotaDiaria = safeFloat(d.montoCuota);
        metaEstaticaBase += cuotaDiaria;
    });

    // Sumar gastos fijos diarios
    store.gastosFijosMensuales.forEach(g => {
        let cuotaDiaria = 0;
        if(g.frecuencia === 'Diario') cuotaDiaria = safeFloat(g.monto);
        else if(g.frecuencia === 'Semanal') cuotaDiaria = safeFloat(g.monto) / 7;
        else if(g.frecuencia === 'Mensual') cuotaDiaria = safeFloat(g.monto) / 30;
        metaEstaticaBase += cuotaDiaria;
    });
    
    // 2. ANÁLISIS DE SOBRES (DÉFICIT Y ESTADO)
    const movimientosHoy = store.movimientos.filter(m => new Date(m.fecha).toDateString() === fechaHoyStr);
    let deficitAcumulado = 0;

    store.wallet.sobres.forEach(s => {
        s.pagadoHoy = false;
        let yaPagado = false;

        // Detección de pago en historial
        if (s.tipo === 'deuda') {
            yaPagado = movimientosHoy.some(m => m.tipo === 'gasto' && m.desc === `Abono: ${s.desc}`);
        } else {
            yaPagado = movimientosHoy.some(m => m.tipo === 'gasto' && m.desc === s.desc);
        }

        // CÁLCULO DEL "IDEAL HOY" (Lo que deberías tener acumulado según el día del ciclo)
        let idealTeorico = 0;
        
        if (s.frecuencia === 'Diario') {
            idealTeorico = s.meta;
        } else if (s.frecuencia === 'Semanal') {
            // Lógica de ciclo semanal estricta
            const diaPago = parseInt(s.diaPago) || 7; // Si no hay día, asume Domingo (7)
            // Calcular días transcurridos desde el último día de pago
            // Si hoy es Domingo (7) y pago Domingo (7), días = 7 (Ciclo lleno)
            // Si hoy es Lunes (1) y pago Domingo (7), días = 1 (Nuevo ciclo)
            let diasTranscurridos = 0;
            
            if (hoyIdx === diaPago) {
                diasTranscurridos = 7; // Día de pago: Debes tener todo
            } else if (hoyIdx > diaPago) {
                diasTranscurridos = hoyIdx - diaPago;
            } else {
                diasTranscurridos = (7 - diaPago) + hoyIdx;
            }
            
            const cuotaDiaria = s.meta / 7;
            idealTeorico = cuotaDiaria * diasTranscurridos;
            
        } else if (s.frecuencia === 'Mensual') {
             idealTeorico = (s.meta / 30) * diaMes;
        }
        
        // APLICACIÓN DE ESTADO
        if (yaPagado) {
            s.pagadoHoy = true;
            // SI ES DIARIO (COMIDA): La obligación desaparece por hoy
            if (s.frecuencia === 'Diario') {
                s.objetivoHoy = 0;
            } 
            // SI ES ACUMULATIVO (DEUDA): La obligación se reinicia al ciclo actual
            else {
                // Si pagué hoy, mi acumulado bajó a 0 (o remanente).
                // Pero mi "Objetivo Hoy" debe reflejar en qué día del ciclo estoy.
                // Si pago el Viernes (día de pago), el Sábado debo tener 1 cuota.
                // Si pago HOY (y hoy no es el día de pago perfecto, o sí), 
                // el sistema debe exigir lo que corresponde a la nueva acumulación.
                
                // CASO ESPECIAL: Si pago el día de pago, el contador reinicia mañana. 
                // Pero si pago con retraso, el déficit sigue.
                // Simplificación V8.4: Objetivo Hoy = Ideal Teórico.
                s.objetivoHoy = idealTeorico;
            }
        } else {
            s.objetivoHoy = Math.min(idealTeorico, s.meta);
        }
        
        // CÁLCULO DE DÉFICIT
        // Solo para acumulativos. Si lo que tengo < lo que debo tener por tiempo.
        if (s.frecuencia !== 'Diario') {
            if (s.acumulado < s.objetivoHoy) {
                deficitAcumulado += (s.objetivoHoy - s.acumulado);
            }
        }
    });

    // 3. META FINAL = BASE + DÉFICIT
    store.parametros.deficitTotal = deficitAcumulado;
    
    // Si ya se pagó el gasto diario (comida), no lo sumamos a la meta de "recaudar hoy", 
    // porque ya salió del flujo. PERO la Meta Base Estática (punto 1) ya lo incluye 
    // para reportes. Aquí ajustamos la "Meta Operativa del Día" para el Dashboard.
    
    // Ajuste fino: La Meta Diaria que se muestra en el panel debe ser:
    // (Lo que falta por cubrir de gastos hoy) + (Cuotas de deuda de hoy) + (Déficit atrasado)
    // Para simplificar y cumplir la regla "Nunca es $0", usaremos la Meta Estática Base + Déficit.
    
    store.parametros.metaDiaria = metaEstaticaBase + deficitAcumulado + (120 * safeFloat(store.parametros.costoPorKm));
}

/* -------------------------------------------------------------
   SECCIÓN 3: ACCIONES
   ------------------------------------------------------------- */
function actionFinalizarTurno(kmFinal, ganancia) {
    const kF = safeFloat(kmFinal);
    if (kF < store.parametros.ultimoKM) return alert(`⛔ Error: KM actual es ${store.parametros.ultimoKM}. No puedes bajarlo.`);
    
    const fin = Date.now();
    const inicio = (store.turnoActivo && store.turnoActivo.inicio) ? store.turnoActivo.inicio : fin;
    const kmIni = (store.turnoActivo && store.turnoActivo.kmInicial) ? store.turnoActivo.kmInicial : store.parametros.ultimoKM;

    const duracionMs = fin - inicio;
    const duracionMin = duracionMs / 60000;
    const duracionHoras = duracionMin / 60;

    const nuevoTurno = {
        id: uuid(),
        inicio: inicio,
        fin: fin,
        fecha: new Date(fin).toISOString(),
        duracionMin: duracionMin,
        duracionHoras: duracionHoras,
        ganancia: safeFloat(ganancia),
        kmInicial: kmIni,
        kmFinal: kF,
        kmRecorrido: kF - kmIni
    };

    store.turnos.push(nuevoTurno);
    store.movimientos.push({ id: uuid(), fecha: new Date().toISOString(), tipo: 'ingreso', desc: 'Turno Finalizado', monto: safeFloat(ganancia) });
    store.parametros.ultimoKM = kF; 
    store.turnoActivo = null; 
    sanearDatos(); renderAdmin();
}

function actionGasolina(l, c, k) {
    const km = safeFloat(k);
    if(km < store.parametros.ultimoKM && km > 0) return alert("⛔ KM inválido. No puedes bajar el kilometraje.");
    
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

function actionNuevaDeuda(desc, total, cuota, freq, dp) {
    store.deudas.push({ id: uuid(), desc, montoTotal: total, montoCuota: cuota, frecuencia: freq, diaPago: dp, saldo: total });
    sanearDatos();
    alert("✅ Deuda creada");
}

function actionAbonarDeuda(id) {
    const d = store.deudas.find(x => x.id === id); if(!d) return alert("Error");
    d.saldo -= d.montoCuota; if(d.saldo < 0) d.saldo = 0;
    const s = store.wallet.sobres.find(x => x.refId === id); if(s) s.acumulado = 0;
    store.movimientos.push({ id: uuid(), fecha: new Date().toISOString(), tipo: 'gasto', desc: `Abono: ${d.desc}`, monto: d.montoCuota, categoria: 'Deuda' });
    sanearDatos();
    alert("✅ Abono registrado");
    renderAdmin();
}

function actionPagarRecurrente(id) {
    const gf = store.gastosFijosMensuales.find(x => x.id === id); if(!gf) return;
    store.movimientos.push({ id: uuid(), fecha: new Date().toISOString(), tipo: 'gasto', desc: gf.desc, monto: gf.monto, categoria: gf.categoria });
    const s = store.wallet.sobres.find(x => x.refId === id);
    if(s) { s.acumulado -= gf.monto; if(s.acumulado < 0) s.acumulado = 0; }
    sanearDatos(); alert("✅ Pagado");
}

function actionConfigurarKM(nuevoKM) {
    if(store.parametros.kmInicialConfigurado || store.parametros.ultimoKM > 0) return alert("⛔ ACCIÓN DENEGADA. El kilometraje ya existe.");
    const km = safeFloat(nuevoKM); if(km <= 0) return alert("❌ El kilometraje debe ser mayor a 0.");
    store.parametros.ultimoKM = km; store.parametros.kmInicialConfigurado = true;
    saveData(); renderAdmin(); alert("✅ Kilometraje base establecido. Modo automático activado.");
}

function actionSaldoInicial(monto) {
    if(store.parametros.saldoInicialConfigurado) return alert("⛔ ACCIÓN DENEGADA. El saldo inicial ya fue configurado.");
    const inicial = safeFloat(monto); if(inicial < 0) return alert("❌ El saldo no puede ser negativo.");
    store.movimientos.push({ id: uuid(), fecha: new Date().toISOString(), tipo: 'ingreso', desc: 'Saldo Inicial', monto: inicial, categoria: 'Sistema' });
    store.parametros.saldoInicialConfigurado = true;
    sanearDatos(); renderAdmin(); alert("✅ Capital inicial registrado. Billetera activada.");
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
    // Comprometido es lo que ya está apartado FÍSICAMENTE
    const comprometido = store.wallet.sobres.reduce((a,b)=> a + b.acumulado, 0);
    const libre = saldo - comprometido;
    const deficit = store.parametros.deficitTotal || 0;
    
    // Alertas de sobres que necesitan dinero
    let avisos = store.wallet.sobres
        .filter(s => (s.objetivoHoy - s.acumulado) > 5 && !s.pagadoHoy) // Tolerancia $5
        .map(s => `<li style="color:#d97706; margin-bottom:4px;">Faltan <strong>${fmtMoney(s.objetivoHoy - s.acumulado)}</strong> para ${s.desc}</li>`);

    const html = `
    <div class="card" style="border-left: 4px solid ${libre>=0?'var(--success)':'var(--danger)'}">
        <p><strong>Caja Total:</strong> ${fmtMoney(saldo)}</p>
        <p><strong>En Sobres:</strong> ${fmtMoney(comprometido)}</p>
        
        ${deficit > 0 ? `<div style="margin:10px 0; padding:8px; background:#fee2e2; border-radius:6px; color:#991b1b; font-size:0.9rem;"><strong>⚠️ Déficit Acumulado:</strong> ${fmtMoney(deficit)}<br><small>Dinero que debiste guardar y no está.</small></div>` : ''}

        <hr style="margin:10px 0; border:0; border-top:1px dashed #ccc;">
        <p style="font-size:1.1rem; color:${libre>=0?'var(--success)':'var(--danger)'}; font-weight:bold;">
            ${libre>=0?'✅ Libre: ':'⚠️ Déficit Caja: '} ${fmtMoney(libre)}
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
    const comprometido = store.wallet.sobres.reduce((acc, s) => acc + s.acumulado, 0);
    const libre = saldo - comprometido;

    $('valWallet').innerHTML = `${fmtMoney(saldo)}<br><small style="font-size:0.9rem; opacity:0.9; font-weight:normal">(${fmtMoney(comprometido)} en sobres / ${fmtMoney(libre)} libre)</small>`;
    
    const container = $('sobresContainer'); 
    if(!container) return;
    container.innerHTML = '';
    
    store.wallet.sobres.forEach(s => {
        // Visualización: Comparamos Acumulado vs Objetivo del Día (Ideal por tiempo)
        const valorVisual = s.acumulado;
        const metaVisual = s.objetivoHoy > 0 ? s.objetivoHoy : s.meta; // Para la barra de progreso
        
        const pct = Math.min((valorVisual/metaVisual)*100, 100);
        // Marcador del ideal (dónde debería estar la barra hoy)
        const pctIdeal = Math.min((s.objetivoHoy/metaVisual)*100, 100);
        
        const diaTxt = s.diaPago ? ` (Día ${s.diaPago})` : '';
        
        let avisoIdeal = "";
        
        if (s.pagadoHoy && s.frecuencia === 'Diario') {
            avisoIdeal = `<div style="font-size:0.75rem; color:var(--success); margin-top:2px; font-weight:bold;">✔ Pagado hoy</div>`;
        } else if (s.objetivoHoy > s.acumulado) {
            // Es deuda acumulativa y falta dinero para estar al día con el ciclo
            avisoIdeal = `<div style="font-size:0.75rem; color:#dc2626; margin-top:2px; font-weight:bold;">⚠️ Debes tener: ${fmtMoney(s.objetivoHoy)}</div>`;
            if (s.pagadoHoy) {
                avisoIdeal += `<span style="font-size:0.7rem; color:var(--success); margin-left:5px;">(Pagaste cuota anterior)</span>`;
            }
        }

        container.innerHTML += `
        <div class="card" style="padding:15px; border-left:5px solid ${s.tipo==='deuda'?'#dc2626':'#2563eb'}">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px; align-items: flex-start;">
                <strong>${s.desc}${diaTxt}</strong>
                <div style="text-align:right;">
                    <small style="display:block; font-weight:bold;">${fmtMoney(valorVisual)} / ${fmtMoney(s.meta)}</small>
                    ${avisoIdeal}
                </div>
            </div>
            <div style="height:10px; background:#e2e8f0; border-radius:5px; position:relative; overflow:hidden;">
                <div style="width:${pct}%; background:${s.tipo==='deuda'?'#dc2626':'#2563eb'}; height:100%;"></div>
                ${s.objetivoHoy > 0 ? `<div style="position:absolute; top:0; left:${pctIdeal}%; width:3px; height:100%; background:rgba(0,0,0,0.6); z-index:2;" title="Objetivo Hoy"></div>` : ''}
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
    const btnKM = $('btnConfigKM');
    
    if (store.parametros.kmInicialConfigurado || store.parametros.ultimoKM > 0) {
        btnKM.innerText = "🔒 Auto"; btnKM.className = "btn btn-outline"; btnKM.style.opacity = "0.7";
        btnKM.onclick = () => alert("🔒 El kilometraje es automático. Se actualiza con Turnos y Gasolina.");
    } else {
        btnKM.innerText = "🔓 Configurar"; btnKM.className = "btn btn-primary"; btnKM.style.opacity = "1";
        btnKM.onclick = () => Modal.show("Configurar KM Inicial", [{label:"Kilometraje Real Tablero",key:"km",type:"number"}], d => actionConfigurarKM(d.km));
    }

    const saldo = store.wallet.saldo;
    // En admin mostramos la realidad física
    const comprometido = store.wallet.sobres.reduce((a,b)=> a + b.acumulado, 0);
    const libre = saldo - comprometido;
    
    if($('valSaldoAdmin')) $('valSaldoAdmin').innerText = fmtMoney(saldo);
    if($('valDesgloseAdmin')) $('valDesgloseAdmin').innerText = `(${fmtMoney(comprometido)} en sobres / ${fmtMoney(libre)} libre)`;

    const btnSaldo = $('btnConfigSaldo');
    if (store.parametros.saldoInicialConfigurado) {
        btnSaldo.innerText = "🔒 Auto"; btnSaldo.className = "btn btn-outline"; btnSaldo.style.opacity = "0.7";
        btnSaldo.onclick = () => alert("🔒 El saldo es automático. Se actualiza con tus operaciones diarias.");
    } else {
        btnSaldo.innerText = "🔓 Registrar capital inicial"; btnSaldo.className = "btn btn-primary"; btnSaldo.style.opacity = "1";
        btnSaldo.onclick = () => Modal.show("Capital Inicial", [{label:"¿Cuánto dinero tienes actualmente?",key:"s",type:"number"}], d => actionSaldoInicial(d.s));
    }

    if ($('metaDiariaValor')) $('metaDiariaValor').innerText = fmtMoney(store.parametros.metaDiaria || 0);

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

    const ul = $('listaDeudasAdmin');
    if(ul) {
        ul.innerHTML = store.deudas.map(d => `<li style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #eee;"><span>${d.desc}</span><span style="font-weight:bold; color:${d.saldo>0?'var(--danger)':'var(--success)'}">${fmtMoney(d.saldo)}</span></li>`).join('');
    }
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

/* =============================================================
   MÓDULO DE ESTADÍSTICAS (STATS V2)
   ============================================================= */
function renderStats() {
    if (!document.getElementById('statIngresoHora')) return;

    const hoy = new Date();
    const limite = new Date();
    limite.setDate(hoy.getDate() - 7);

    const turnosRecientes = store.turnos.filter(t => new Date(t.fecha) >= limite);
    
    let totalIngresos = 0;
    let totalHoras = 0;
    const diasUnicos = new Set();

    turnosRecientes.forEach(t => {
        totalIngresos += safeFloat(t.ganancia);
        let horas = 0;
        if (typeof t.duracionHoras === 'number') {
            horas = t.duracionHoras;
        } else {
             const fin = new Date(t.fecha).getTime();
             const inicio = t.inicio ? new Date(t.inicio).getTime() : fin; 
             horas = (fin - inicio) / 3600000;
        }
        totalHoras += horas;
        diasUnicos.add(new Date(t.fecha).toDateString());
    });

    const diasTrabajados = diasUnicos.size;
    const ingresoPromedioHora = totalHoras > 0 ? (totalIngresos / totalHoras) : 0;
    const horasPromedioDia = diasTrabajados > 0 ? (totalHoras / diasTrabajados) : 0;
    const ingresoDiarioProm = diasTrabajados > 0 ? (totalIngresos / diasTrabajados) : 0;
    const metaDiaria = safeFloat(store.parametros.metaDiaria);

    $('statIngresoHora').innerText = totalHoras > 0 ? fmtMoney(ingresoPromedioHora) : "—";
    $('statHorasTotal').innerText = totalHoras.toFixed(1) + "h";
    $('statDiasTrabajados').innerText = diasTrabajados;

    $('statMetaDiaria').innerText = fmtMoney(metaDiaria);
    $('statIngresoDiario').innerText = fmtMoney(ingresoDiarioProm);
    
    const diff = ingresoDiarioProm - metaDiaria;
    const elDiff = $('statDiferencia');
    elDiff.innerText = (diff >= 0 ? "+" : "") + fmtMoney(diff);
    elDiff.style.color = diff >= 0 ? "var(--success)" : "var(--danger)";

    let horasNecesarias = 0;
    let estado = "NEUTRO";
    const elHorasNec = $('statHorasNecesarias');
    const elTag = $('statTagSem');
    
    if (ingresoPromedioHora > 0 && metaDiaria > 0) {
        horasNecesarias = metaDiaria / ingresoPromedioHora;
        elHorasNec.innerText = horasNecesarias.toFixed(1) + "h";
        
        if (horasNecesarias <= (horasPromedioDia + 1)) {
            estado = "VERDE";
            elTag.innerText = "SOSTENIBLE";
            elTag.style.background = "#dcfce7";
            elTag.style.color = "#166534";
            elHorasNec.style.color = "var(--success)";
        } else if (horasNecesarias <= 9) {
            estado = "AMARILLO";
            elTag.innerText = "EXIGENTE";
            elTag.style.background = "#fef9c3";
            elTag.style.color = "#854d0e";
            elHorasNec.style.color = "var(--warning)";
        } else {
            estado = "ROJO";
            elTag.innerText = "CRÍTICO";
            elTag.style.background = "#fee2e2";
            elTag.style.color = "#991b1b";
            elHorasNec.style.color = "var(--danger)";
        }

    } else {
        elHorasNec.innerText = "—";
        elTag.innerText = "SIN DATOS";
        elTag.style.background = "#f1f5f9";
        elTag.style.color = "#64748b";
        elHorasNec.style.color = "var(--text-sec)";
        estado = "INVALIDO";
    }
    $('statHorasPromedio').innerText = horasPromedioDia.toFixed(1) + "h";

    const elDiag = $('statsDiagnostico');
    if (estado === "INVALIDO") {
        elDiag.innerText = "Información insuficiente para generar diagnóstico.";
    } else {
        let textoBase = `Con tu ingreso actual por hora, para cubrir tus obligaciones diarias necesitarías trabajar aproximadamente ${horasNecesarias.toFixed(1)} horas al día (calculado sobre base diaria). `;
        if (estado === "VERDE") textoBase += "Esto es acorde a tu ritmo actual.";
        else if (estado === "AMARILLO") textoBase += "Esto está por encima de tu promedio actual.";
        else if (estado === "ROJO") textoBase += "Esto excede una jornada operativa estándar.";
        elDiag.innerText = textoBase;
    }
}

function renderDashboardContext() {
    if (!document.getElementById('uiTurnosHoy')) return;

    const hoyStr = new Date().toDateString();
    const turnosHoy = store.turnos.filter(t => new Date(t.fecha).toDateString() === hoyStr);

    let totalGanancia = 0;
    let totalHoras = 0;

    turnosHoy.forEach(t => {
        totalGanancia += safeFloat(t.ganancia);
        let horas = 0;
        if (typeof t.duracionHoras === 'number') {
            horas = t.duracionHoras;
        } else {
            const fin = new Date(t.fecha).getTime();
            const inicio = t.inicio ? new Date(t.inicio).getTime() : fin;
            horas = (fin - inicio) / 3600000;
        }
        totalHoras += horas;
    });

    $('uiTurnosHoy').innerText = turnosHoy.length;
    $('uiHorasHoy').innerText = totalHoras > 0 ? totalHoras.toFixed(1) + 'h' : '0h';
    $('uiIngresoHoraHoy').innerText = totalHoras > 0 ? fmtMoney(totalGanancia / totalHoras) : '—';

    const lista = $('uiCompromisos');
    let htmlCompromisos = '';
    
    // Muestra compromisos que NO se han cubierto (por déficit o por día)
    const compromisos = store.wallet.sobres.filter(s => {
        // En V8.4, si es diario y pagado, no sale. Si es deuda y pagado pero hay déficit, sale.
        if (s.frecuencia === 'Diario' && s.pagadoHoy) return false;
        return s.acumulado < s.objetivoHoy;
    });

    if (compromisos.length === 0) {
        htmlCompromisos = '<span style="color:var(--text-sec)">Sin compromisos pendientes hoy.</span>';
    } else {
        htmlCompromisos = '<ul style="padding-left:16px; margin:0;">' +
            compromisos.map(s => {
                const monto = s.objetivoHoy; // V8.4 muestra lo que DEBERÍAS tener
                return `<li style="margin-bottom:4px;">${s.desc}: <strong>${fmtMoney(monto)}</strong></li>`;
            }).join('') +
            '</ul>';
    }
    lista.innerHTML = htmlCompromisos;
}

/* -------------------------------------------------------------
   SECCIÓN 5: ORQUESTADOR (INTEGRADO)
   ------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 V8.4 WALLET FINAL + STRICT FINANCIAL MODEL");
    loadData();
    
    const page = document.body.dataset.page;
    if (page === 'index') {
        renderIndex();
        renderDashboardContext(); 
    }
    if (page === 'wallet') renderWallet();
    if (page === 'historial') renderHistorial();
    if (page === 'stats') renderStats();
    if (page === 'admin') {
        renderAdmin();
        
        $('btnTurnoIniciar').onclick = () => { 
            store.turnoActivo = { 
                inicio: Date.now(),
                kmInicial: store.parametros.ultimoKM 
            }; 
            saveData(); 
            renderAdmin(); 
        };
        
        $('btnTurnoFinalizar').onclick = () => Modal.show("Fin Turno", [{label:"KM Final",key:"k",type:"number"},{label:"Ganancia Total",key:"g",type:"number"}], d => actionFinalizarTurno(d.k, d.g));
        $('btnGasolina').onclick = () => Modal.show("Gasolina", [{label:"Litros",key:"l",type:"number"},{label:"Costo ($)",key:"c",type:"number"},{label:"KM Actual",key:"k",type:"number"}], d => actionGasolina(d.l, d.c, d.k));
        
        // WIZARD DE GASTOS (CATEGORIAS DINÁMICAS V8.3)
        const gastoWiz = (g) => {
            const typeKey = g.toLowerCase();
            const customCats = (store.categoriasPersonalizadas && store.categoriasPersonalizadas[typeKey]) ? store.categoriasPersonalizadas[typeKey] : [];
            const allCats = [...CATEGORIAS_BASE[typeKey], ...customCats, "➕ Crear nueva..."];

            Modal.show(`Nuevo ${g}`, [
                {label:"Descripción",key:"d"},
                {label:"Monto",key:"m",type:"number"},
                {label:"Categoría",key:"c",type:"select",options:allCats.map(x=>({val:x,txt:x}))},
                {label:"Frecuencia",key:"f",type:"select",options:Object.keys(FRECUENCIAS).map(x=>({val:x,txt:x}))}
            ], d => {
                let catFinal = d.c;
                if (catFinal === "➕ Crear nueva...") {
                    const nueva = prompt(`Escribe el nombre de la nueva categoría para ${g}:`);
                    if (!nueva || nueva.trim() === "") return alert("Cancelado: Nombre inválido");
                    catFinal = nueva.trim();
                    if (!store.categoriasPersonalizadas) store.categoriasPersonalizadas = { operativo: [], hogar: [] };
                    if (!store.categoriasPersonalizadas[typeKey]) store.categoriasPersonalizadas[typeKey] = [];
                    store.categoriasPersonalizadas[typeKey].push(catFinal);
                    saveData();
                }
                actionNuevoGasto(d.d, d.m, catFinal, d.f);
            });
        };

        $('btnGastoHogar').onclick = () => gastoWiz('Hogar');
        $('btnGastoOperativo').onclick = () => gastoWiz('Operativo');
        
        $('btnDeudaNueva').onclick = () => Modal.show("Nueva Deuda", [
            {label:"Nombre",key:"d"},
            {label:"Total Deuda",key:"t",type:"number"},
            {label:"Cuota Mensual",key:"c",type:"number"},
            {label:"Frecuencia",key:"f",type:"select",options:Object.keys(FRECUENCIAS).map(x=>({val:x,txt:x}))},
            {label:"Día de Pago",key:"dp",type:"select",options:DIAS_SEMANA}
        ], d => actionNuevaDeuda(d.d, d.t, d.c, d.f, d.dp));
        
        $('btnAbonoCuota').onclick = () => { 
            const v = $('abonoDeudaSelect').value; 
            if(!v) return alert("⚠️ Selecciona una deuda");
            if(confirm("¿Confirmar abono de cuota?")) actionAbonarDeuda(v); 
        };

        $('btnExportJSON').onclick = () => navigator.clipboard.writeText(JSON.stringify(store)).then(() => alert("Copiado"));
        $('btnRestoreBackup').onclick = () => Modal.show("Restaurar", [{label:"Pegar JSON",key:"j"}], d => { try { store = {...INITIAL_STATE, ...JSON.parse(d.j)}; sanearDatos(); location.reload(); } catch(e){ alert("JSON Inválido"); } });
    }
});
