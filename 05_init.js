/* 05_init.js - VERSIÓN FINAL CORREGIDA */
import { 
    loadData, getStore, setUltimoKM, iniciarTurno, finalizarTurno, 
    registrarGasolina, procesarGasto, agregarDeuda, abonarDeuda, 
    importarBackup 
} from './02_data.js';
import { $, fmtMoney, safeFloat, CATEGORIAS, FRECUENCIAS } from './01_consts_utils.js';
import { Modal } from './03_render.js';
import { renderCharts } from './04_charts.js';

console.log("✅ 05_init.js CARGADO");

let timerInterval = null;

const App = {
    init: () => {
        try {
            loadData();
            const store = getStore();
            const page = document.body.dataset.page;
            console.log("Página detectada:", page);

            if (page === 'admin') {
                App.bindAdminEvents(store);
                App.updateAdminUI(store);
                if (store.parametros.ultimoKM === 0) App.triggerOnboarding();
            } else if (page === 'index') {
                App.renderDashboard(store);
            } else if (page === 'wallet') {
                App.renderWallet(store);
            } else if (page === 'historial') {
                App.renderHistorial(store);
            }

            // Activar menú visualmente
            const links = document.querySelectorAll('.nav-link');
            links.forEach(l => {
                if(l.getAttribute('href').includes(page)) l.classList.add('active');
            });

        } catch (err) {
            console.error("Error en init:", err);
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

    triggerOnboarding: () => {
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
    },

    bindAdminEvents: (store) => {
        // Función segura para atar eventos
        const bind = (id, handler) => {
            const el = $(id);
            if (el) {
                el.onclick = (e) => {
                    e.preventDefault(); // Prevenir recargas raras
                    handler();
                };
            } else {
                console.warn("⚠️ Botón no encontrado en HTML:", id);
            }
        };

        // 1. KM
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

        // 2. Turno
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

        // 3. Gastos
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

        // 4. Gasolina
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

        // 5. Deudas
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

        // 6. Abonos
        bind('btnAbonoCuota', () => {
            const s = getStore();
            const id = $('abonoDeudaSelect')?.value;
            if(!id) return alert("Selecciona una deuda");
            const deuda = s.deudas.find(x => x.id == id);
            if(confirm(`¿Pagar cuota de ${fmtMoney(deuda.montoCuota)} para ${deuda.desc}?`)) {
                abonarDeuda(id, deuda.montoCuota);
                alert("✅ Abono registrado");
                App.refresh();
            }
        });

        bind('btnAbonoCustom', () => {
            const id = $('abonoDeudaSelect')?.value;
            if(!id) return alert("Selecciona una deuda");
            Modal.showInput("Abono Personalizado", [{label:"Monto", key:"m", type:"number"}], (d)=>{
                const val = safeFloat(d.m);
                if(val <= 0) return false;
                abonarDeuda(id, val);
                App.refresh();
                return true;
            });
        });

        // 7. Datos
        bind('btnExportJSON', () => {
            const s = getStore();
            navigator.clipboard.writeText(JSON.stringify(s))
                .then(() => alert("📋 Copiado"))
                .catch(() => alert("Error al copiar"));
        });

        const restoreHandler = () => {
            Modal.showInput("Restaurar Backup", [{label:"Pegar JSON", key:"json", type:"text"}], (d)=>{
                if(importarBackup(d.json)) { 
                    alert("✅ Restaurado"); 
                    window.location.reload(); 
                    return true; 
                }
                alert("❌ JSON Inválido"); 
                return false;
            });
        };
        bind('btnRestoreBackup', restoreHandler);
        bind('btnImportJSON', restoreHandler);
    },

    updateAdminUI: (store) => {
        // Turno
        const turnoTxt = $('turnoEstado');
        const btnIni = $('btnTurnoIniciar');
        const btnFin = $('btnTurnoFinalizar');
        const timerTxt = $('turnoTimer');

        if (store.turnoActivo) {
            if(turnoTxt) turnoTxt.innerHTML = `<span style="color:var(--success)">🟢 EN CURSO</span>`;
            if(btnIni) btnIni.classList.add('hidden');
            if(btnFin) btnFin.classList.remove('hidden');
            
            if (timerInterval) clearInterval(timerInterval);
            const inicio = new Date(store.turnoActivo.inicio).getTime();
            const updateTimer = () => {
                const diff = Date.now() - inicio;
                const hrs = Math.floor(diff / 3600000);
                const min = Math.floor((diff % 3600000) / 60000);
                const sec = Math.floor((diff % 60000) / 1000);
                if(timerTxt) timerTxt.innerText = `${hrs}h ${min}m ${sec}s`;
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

        // Datos Simples
        if($('kmActual')) $('kmActual').innerText = `${store.parametros.ultimoKM} km`;
        if($('metaDiariaValor')) $('metaDiariaValor').innerText = fmtMoney(store.parametros.metaDiaria);

        // Lista Deudas
        const list = $('listaDeudasAdmin');
        const select = $('abonoDeudaSelect');
        if (list) list.innerHTML = '';
        if (select) select.innerHTML = '<option value="">-- Seleccionar Deuda --</option>';

        store.deudas.forEach(d => {
            if (d.saldo <= 0.1) return;
            if (list) {
                const li = document.createElement('li');
                li.className = 'list-item';
                li.innerHTML = `<div style="display:flex; justify-content:space-between; width:100%"><span>${d.desc}</span><strong>${fmtMoney(d.saldo)}</strong></div>`;
                list.appendChild(li);
            }
            if (select) {
                const opt = document.createElement('option');
                opt.value = d.id;
                opt.innerText = `${d.desc} (Cuota: ${fmtMoney(d.montoCuota)})`;
                select.appendChild(opt);
            }
        });
    },

    renderDashboard: (store) => {
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
                    <td>${new Date(t.fecha).toLocaleDateString(undefined, {weekday:'short'})}</td>
                    <td>${t.horas.toFixed(1)}</td>
                    <td>${t.kmRecorrido.toFixed(0)}</td>
                    <td>${fmtMoney(t.ganancia)}</td>
                </tr>
            `).join('');
        }
        renderCharts(store);
    },

    renderWallet: (store) => {
        if($('valWallet')) $('valWallet').innerText = fmtMoney(store.wallet.saldo);
        const list = $('listaDeudas');
        if(list) {
            list.innerHTML = store.deudas.filter(d=>d.saldo>0).map(d=>`
                <li class="list-item"><span>${d.desc}</span><span style="color:var(--danger)">${fmtMoney(d.saldo)}</span></li>
            `).join('');
        }
    },

    renderHistorial: (store) => {
        const tbody = $('tablaBody');
        if (!tbody) return;
        const movs = store.movimientos.slice().reverse().slice(0, 50);
        tbody.innerHTML = movs.map(m => `
            <tr>
                <td>${new Date(m.fecha).toLocaleDateString()}</td>
                <td><strong>${m.desc}</strong><br><small style="color:#64748b">${m.categoria || m.grupo}</small></td>
                <td style="text-align:right" class="${m.tipo==='ingreso'?'text-green':'text-red'}">${fmtMoney(m.monto)}</td>
            </tr>
        `).join('');
        renderCharts(store);
    }
};

document.addEventListener("DOMContentLoaded", App.init);

/* FIN DEL ARCHIVO - Asegúrate de copiar hasta aquí */
