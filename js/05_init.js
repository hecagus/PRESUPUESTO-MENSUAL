/* 05_init.js - VERSIÓN DEFINITIVA A PRUEBA DE FALLOS */
import { 
    loadData, getStore, setUltimoKM, iniciarTurno, finalizarTurno, 
    registrarGasolina, procesarGasto, agregarDeuda, abonarDeuda, 
    importarBackup 
} from './02_data.js';
import { $, fmtMoney, safeFloat, CATEGORIAS, FRECUENCIAS } from './01_consts_utils.js';
import { Modal } from './03_render.js';
import { renderCharts } from './04_charts.js';

console.log("✅ 05_init.js SE HA CARGADO CORRECTAMENTE");

let timerInterval = null;

const App = {
    init: () => {
        try {
            console.log("🚀 Iniciando App...");
            loadData();
            const store = getStore();
            const page = document.body.dataset.page;
            console.log(`📄 Página detectada: ${page}`);

            if (page === 'admin') {
                App.bindAdminEvents(store);
                App.updateAdminUI(store);
                App.checkOnboarding(store);
            } else if (page === 'index') {
                App.renderDashboard(store);
            } else if (page === 'wallet') {
                App.renderWallet(store);
            } else if (page === 'historial') {
                App.renderHistorial(store);
            }

            // Activar navegación visual
            const links = document.querySelectorAll('.nav-link');
            links.forEach(l => {
                if(l.getAttribute('href').includes(page)) l.classList.add('active');
            });

        } catch (error) {
            console.error("❌ ERROR FATAL EN INIT:", error);
            alert("Error crítico iniciando la app. Revisa la consola.");
        }
    },

    refresh: () => {
        loadData();
        const store = getStore();
        const page = document.body.dataset.page;
        
        if (page === 'admin') App.updateAdminUI(store);
        if (page === 'index') App.renderDashboard(store);
        if (page === 'wallet') App.renderWallet(store);
        if (page === 'historial') App.renderHistorial(store);
    },

    checkOnboarding: (store) => {
        if (store.parametros.ultimoKM === 0) {
            Modal.showInput(
                "Configuración Inicial",
                [{ label: "Kilometraje Actual", key: "km", type: "number", placeholder: "Ej. 12500" }],
                (d) => {
                    const val = safeFloat(d.km);
                    if (val > 0) {
                        setUltimoKM(val);
                        App.refresh();
                        return true;
                    }
                    return false;
                }
            );
        }
    },

    bindAdminEvents: (store) => {
        // Función auxiliar para conectar botones y avisar si faltan
        const bind = (id, handler) => {
            const el = $(id); // $(id) es document.getElementById(id)
            if (el) {
                el.onclick = (e) => {
                    e.preventDefault(); // Evita recargas raras
                    console.log(`👆 Click en: ${id}`);
                    handler();
                };
                console.log(`✅ Botón conectado: ${id}`);
            } else {
                console.warn(`⚠️ ATENCIÓN: No se encontró el botón con ID: "${id}" en el HTML.`);
            }
        };

        // 1. KILOMETRAJE
        bind('btnConfigKM', () => {
            const current = getStore().parametros.ultimoKM;
            Modal.showInput("Ajustar Kilometraje", [
                { label: "KM Actual", key: "km", type: "number", value: current }
            ], (d) => {
                const val = safeFloat(d.km);
                if (val > 0) {
                    setUltimoKM(val);
                    App.refresh();
                    return true;
                }
                return false;
            });
        });

        // 2. TURNO
        bind('btnTurnoIniciar', () => {
            iniciarTurno();
            App.refresh();
        });

        bind('btnTurnoFinalizar', () => {
            const s = getStore();
            Modal.showInput("Finalizar Turno", [
                { label: "Kilometraje Final", key: "km", type: "number", value: s.parametros.ultimoKM },
                { label: "Ganancia Total ($)", key: "gan", type: "number" }
            ], (d) => {
                const k = safeFloat(d.km);
                const g = safeFloat(d.gan);
                if (k <= s.parametros.ultimoKM) { alert("❌ El KM debe ser mayor al inicial"); return false; }
                if (g < 0) { alert("❌ Ganancia inválida"); return false; }
                
                finalizarTurno(k, g);
                App.refresh();
                return true;
            });
        });

        // 3. GASTOS INTELIGENTES
        const wizardGasto = (grupo, cats) => {
            Modal.showInput(`Gasto ${grupo}`, [
                { label: "Descripción", key: "desc", type: "text" },
                { label: "Monto ($)", key: "monto", type: "number" },
                { label: "Categoría", key: "cat", type: "select", options: cats.map(c=>({value:c, text:c})) },
                { label: "Frecuencia", key: "freq", type: "select", options: Object.keys(FRECUENCIAS).map(k=>({value:k, text:k})) }
            ], (d) => {
                if(!d.desc || safeFloat(d.monto) <= 0) return false;
                procesarGasto(d.desc, d.monto, grupo, d.cat, d.freq);
                alert("✅ Registrado");
                App.refresh();
                return true;
            });
        };

        bind('btnGastoHogar', () => wizardGasto('Hogar', CATEGORIAS.hogar));
        bind('btnGastoOperativo', () => wizardGasto('Operativo', CATEGORIAS.operativo));

        // 4. GASOLINA
        bind('btnGasolina', () => {
            const s = getStore();
            Modal.showInput("Registrar Gasolina", [
                { label: "Litros", key: "l", type: "number" },
                { label: "Costo Total ($)", key: "c", type: "number" },
                { label: "KM Actual", key: "k", type: "number", value: s.parametros.ultimoKM }
            ], (d) => {
                const k = safeFloat(d.k);
                if (k <= s.parametros.ultimoKM) { alert("❌ KM debe ser mayor al anterior"); return false; }
                registrarGasolina(d.l, d.c, k);
                alert("✅ Gasolina procesada");
                App.refresh();
                return true;
            });
        });

        // 5. DEUDAS
        bind('btnDeudaNueva', () => {
            Modal.showInput("Nueva Deuda", [
                { label: "Nombre", key: "desc", type: "text" },
                { label: "Deuda Total ($)", key: "total", type: "number" },
                { label: "Cuota Periódica ($)", key: "cuota", type: "number" },
                { label: "Frecuencia", key: "freq", type: "select", options: Object.keys(FRECUENCIAS).map(k=>({value:k, text:k})) }
            ], (d) => {
                agregarDeuda(d.desc, d.total, d.cuota, d.freq);
                App.refresh();
                return true;
            });
        });

        // 6. ABONOS
        // Pagar Cuota Fija
        bind('btnAbonoCuota', () => {
            const s = getStore();
            const id = $('abonoDeudaSelect')?.value;
            if(!id) return alert("Selecciona una deuda primero");
            
            const deuda = s.deudas.find(x => x.id == id);
            if(confirm(`¿Pagar cuota de ${fmtMoney(deuda.montoCuota)} para ${deuda.desc}?`)) {
                abonarDeuda(id, deuda.montoCuota);
                alert("✅ Abono registrado");
                App.refresh();
            }
        });

        // Abono Personalizado
        bind('btnAbonoCustom', () => {
            const id = $('abonoDeudaSelect')?.value;
            if(!id) return alert("Selecciona una deuda primero");
            
            Modal.showInput("Abono Personalizado", [{label:"Monto", key:"m", type:"number"}], (d)=>{
                const val = safeFloat(d.m);
                if(val <= 0) return false;
                abonarDeuda(id, val);
                App.refresh();
                return true;
            });
        });

        // 7. DATOS
        bind('btnExportJSON', () => {
            const s = getStore();
            navigator.clipboard.writeText(JSON.stringify(s))
                .then(() => alert("📋 JSON Copiado al portapapeles"))
                .catch(() => alert("Error copiando"));
        });

        const restoreHandler = () => {
            Modal.showInput("Restaurar Backup", [{label:"Pegar JSON", key:"json", type:"text"}], (d)=>{
                if(importarBackup(d.json)) { 
                    alert("✅ Restaurado correctamente"); 
                    window.location.reload(); 
                    return true; 
                }
                alert("❌ JSON Inválido o corrupto"); 
                return false;
            });
        };
        bind('btnRestoreBackup', restoreHandler);
        // Por si acaso tienes el botón viejo
        bind('btnImportJSON', restoreHandler);
    },

    updateAdminUI: (store) => {
        // --- 1. ESTADO DEL TURNO ---
        const turnoTxt = $('turnoEstado');
        const btnIni = $('btnTurnoIniciar');
        const btnFin = $('btnTurnoFinalizar');
        const timerTxt = $('turnoTimer');

        if (store.turnoActivo) {
            if(turnoTxt) turnoTxt.innerHTML = `<span style="color:var(--success); font-weight:bold;">🟢 EN CURSO</span>`;
            if(btnIni) btnIni.classList.add('hidden');
            if(btnFin) btnFin.classList.remove('hidden');
            
            // Cronómetro
            if (timerInterval) clearInterval(timerInterval);
            const inicio = new Date(store.turnoActivo.inicio).getTime();
            
            const updateTimer = () => {
                const diff = Date.now() - inicio;
                const hrs = Math.floor(diff / 3600000);
                const min = Math.floor((diff % 3600000) / 60000);
                const sec = Math.floor((diff % 60000) / 1000);
                // Formato 00:00:00
                const h = String(hrs).padStart(2, '0');
                const m = String(min).padStart(2, '0');
                const s = String(sec).padStart(2, '0');
                if(timerTxt) timerTxt.innerText = `${h}:${m}:${s}`;
            };
            timerInterval = setInterval(updateTimer, 1000);
            updateTimer(); 
        } else {
            if(timerInterval) clearInterval(timerInterval);
            if(turnoTxt) turnoTxt.innerHTML = `🔴 Turno detenido`;
            if(timerTxt) timerTxt.innerText = "--:--:--";
            if(btnIni) btnIni.classList.remove('hidden');
            if(btnFin) btnFin.classList.add('hidden');
        }

        // --- 2. KILOMETRAJE ---
        const elKm = $('kmActual');
        if (elKm) elKm.innerText = `${store.parametros.ultimoKM} km`;

        // --- 3. META DIARIA ---
        const elMeta = $('metaDiariaValor');
        if (elMeta) elMeta.innerText = fmtMoney(store.parametros.metaDiaria);

        // --- 4. LISTA DE DEUDAS (Y SELECTOR) ---
        const list = $('listaDeudasAdmin'); // Asegúrate que este ID exista en tu HTML si quieres ver la lista
        const select = $('abonoDeudaSelect');
        
        if (list) list.innerHTML = '';
        if (select) select.innerHTML = '<option value="">-- Seleccionar Deuda --</option>';

        const deudasActivas = store.deudas.filter(d => d.saldo > 0.1);

        if (deudasActivas.length === 0 && list) {
             list.innerHTML = '<li class="list-item" style="color:#aaa; text-align:center;">No hay deudas activas 🎉</li>';
        }

        deudasActivas.forEach(d => {
            // Render Lista visual
            if (list) {
                const li = document.createElement('li');
                li.className = 'list-item';
                li.innerHTML = `
                    <div style="display:flex; justify-content:space-between; width:100%">
                        <span>${d.desc}</span>
                        <strong>${fmtMoney(d.saldo)}</strong>
                    </div>`;
                list.appendChild(li);
            }

            // Render Select para abonos
            if (select) {
                const opt = document.createElement('option');
                opt.value = d.id;
                opt.innerText = `${d.desc} (Cuota: ${fmtMoney(d.montoCuota)})`;
                select.appendChild(opt);
            }
        });
    },

    renderDashboard: (store) => {
        // Lógica de dashboard existente...
        const hoy = new Date().toDateString();
        const turnosHoy = store.turnos.filter(t => new Date(t.fecha).toDateString() === hoy);
        const movsHoy = store.movimientos.filter(m => new Date(m.fecha).toDateString() === hoy && m.tipo === 'ingreso');
        
        const horas = turnosHoy.reduce((a,b)=>a+b.horas,0);
        const ganancia = movsHoy.reduce((a,b)=>a+b.monto,0);
        
        if($('resHoras')) $('resHoras').innerText = horas.toFixed(1) + 'h';
        if($('resGananciaBruta')) $('resGananciaBruta').innerText = fmtMoney(ganancia);
        
        const meta = store.parametros.metaDiaria;
        const prog = meta > 0 ? (ganancia/meta)*100 : 0;
        
        if($('dashboardMeta')) $('dashboardMeta').innerText = fmtMoney(meta);
        if($('progresoTexto')) $('progresoTexto').innerText = prog.toFixed(0) + '%';
        if($('progresoBarra')) $('progresoBarra').style.width = Math.min(prog, 100) + '%';
        
        const tabla = $('tablaTurnos');
        if(tabla) {
            tabla.innerHTML = store.turnos.slice(-5).reverse().map(t => `
                <tr>
                    <td>${new Date(
