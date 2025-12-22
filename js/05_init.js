/* 05_init.js - ORQUESTADOR DE PRODUCCIÓN */
import { 
    loadData, getStore, setUltimoKM, iniciarTurno, finalizarTurno, 
    registrarGasolina, procesarGasto, agregarDeuda, abonarDeuda, 
    importarBackup 
} from './02_data.js';
import { $, fmtMoney, fmtDate, safeFloat, CATEGORIAS, FRECUENCIAS } from './01_consts_utils.js';
import { Modal } from './03_render.js';
import { renderCharts } from './04_charts.js';

let timerInterval = null; // Handler global para el cronómetro

const App = {
    init: () => {
        loadData();
        const store = getStore();
        
        // 1. ONBOARDING CRÍTICO
        if (store.parametros.ultimoKM === 0) {
            Modal.showInput(
                "Configuración Inicial",
                [{ label: "Kilometraje Actual del Tablero", key: "km", type: "number", placeholder: "Ej. 12500" }],
                (d) => {
                    if (safeFloat(d.km) > 0) {
                        setUltimoKM(d.km);
                        App.refresh(); // Inicia la app real
                        return true;
                    }
                    return false; // Mantiene modal abierto
                }
            );
            return; // Detiene la ejecución del resto hasta completar onboarding
        }

        // 2. ENRUTADOR SIMPLE
        const page = document.body.dataset.page;
        if (page === 'admin') App.bindAdmin(store);
        if (page === 'index') App.renderDashboard(store);
        if (page === 'wallet') App.renderWallet(store);
        if (page === 'historial') App.renderHistorial(store);
        
        // Navegación Activa (Visual)
        const links = document.querySelectorAll('.nav-link');
        links.forEach(l => {
            if(l.getAttribute('href').includes(page)) l.classList.add('active');
        });
    },

    // --- REFRESCAR UI SIN RECARGAR ---
    refresh: () => {
        loadData();
        const store = getStore();
        const page = document.body.dataset.page;
        if (page === 'admin') App.updateAdminUI(store);
        if (page === 'index') App.renderDashboard(store);
        if (page === 'wallet') App.renderWallet(store);
    },

    // --- PÁGINA: ADMIN (Lógica Pesada) ---
    bindAdmin: (store) => {
        // Estado inicial UI
        App.updateAdminUI(store);

        // 1. TURNO
        $('#btnTurnoIniciar').onclick = () => {
            iniciarTurno();
            App.refresh();
        };

        $('#btnTurnoFinalizar').onclick = () => {
            Modal.showInput("Finalizar Turno", [
                { label: "Kilometraje Final", key: "km", type: "number", value: store.parametros.ultimoKM },
                { label: "Ganancia Total ($)", key: "gan", type: "number" }
            ], (d) => {
                const k = safeFloat(d.km);
                const g = safeFloat(d.gan);
                if (k <= store.parametros.ultimoKM) { alert("❌ El KM debe ser mayor al inicial"); return false; }
                if (g < 0) { alert("❌ Ganancia inválida"); return false; }
                
                finalizarTurno(k, g);
                App.refresh();
                return true;
            });
        };

        // 2. GASTOS (Hogar vs Operativo)
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

        $('#btnGastoHogar').onclick = () => wizardGasto('Hogar', CATEGORIAS.hogar);
        $('#btnGastoOperativo').onclick = () => wizardGasto('Operativo', CATEGORIAS.operativo);

        // 3. GASOLINA
        $('#btnGasolina').onclick = () => {
            Modal.showInput("Registrar Gasolina", [
                { label: "Litros", key: "l", type: "number" },
                { label: "Costo Total ($)", key: "c", type: "number" },
                { label: "KM Actual", key: "k", type: "number", value: store.parametros.ultimoKM }
            ], (d) => {
                const k = safeFloat(d.k);
                if (k <= store.parametros.ultimoKM) { alert("❌ KM debe ser mayor al anterior"); return false; }
                registrarGasolina(d.l, d.c, k);
                alert("✅ Gasolina procesada (Wallet actualizado)");
                App.refresh();
                return true;
            });
        };

        // 4. DEUDAS
        $('#btnDeudaNueva').onclick = () => {
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
        };

        // 5. ABONOS (Lógica especial de select)
        $('#btnAbonoCuota').onclick = () => {
            const id = $('#abonoDeudaSelect').value;
            if(!id) return alert("Selecciona una deuda");
            const deuda = store.deudas.find(x => x.id == id);
            
            // Confirmación simple para pago rápido
            if(confirm(`¿Pagar cuota de $${deuda.montoCuota} para ${deuda.desc}?`)) {
                abonarDeuda(id, deuda.montoCuota);
                alert("✅ Abono registrado");
                App.refresh();
            }
        };

        $('#btnAbonoCustom').onclick = () => {
            const id = $('#abonoDeudaSelect').value;
            if(!id) return alert("Selecciona una deuda");
            Modal.showInput("Abono Personalizado", [{label:"Monto", key:"m", type:"number"}], (d)=>{
                abonarDeuda(id, d.m);
                App.refresh();
                return true;
            });
        };

        // 6. DATA / BACKUP
        $('#btnExportJSON').onclick = () => {
            navigator.clipboard.writeText(JSON.stringify(store));
            alert("📋 JSON Copiado");
        };
        $('#btnRestoreBackup').onclick = () => {
            Modal.showInput("Restaurar Backup", [{label:"Pegar JSON", key:"json", type:"text"}], (d)=>{
                if(importarBackup(d.json)) { alert("✅ Restaurado"); window.location.reload(); return true; }
                alert("❌ JSON Inválido"); return false;
            });
        };
    },

    // Actualizador visual de Admin (Se llama en init y refresh)
    updateAdminUI: (store) => {
        // UI Turno
        if (store.turnoActivo) {
            $('#turnoEstado').innerHTML = `<span class="badge bg-green">🟢 EN CURSO</span>`;
            $('#btnTurnoIniciar').classList.add('hidden');
            $('#btnTurnoFinalizar').classList.remove('hidden');
            
            // Cronómetro vivo
            if (timerInterval) clearInterval(timerInterval);
            const inicio = new Date(store.turnoActivo.inicio).getTime();
            
            const updateTimer = () => {
                const diff = Date.now() - inicio;
                const hrs = Math.floor(diff / 3600000);
                const min = Math.floor((diff % 3600000) / 60000);
                const sec = Math.floor((diff % 60000) / 1000);
                $('#turnoTimer').innerText = `${hrs}h ${min}m ${sec}s`;
            };
            timerInterval = setInterval(updateTimer, 1000);
            updateTimer(); // Ejecutar inmediato
        } else {
            if (timerInterval) clearInterval(timerInterval);
            $('#turnoEstado').innerHTML = `🔴 Turno detenido`;
            $('#turnoTimer').innerText = "--:--:--";
            $('#btnTurnoIniciar').classList.remove('hidden');
            $('#btnTurnoFinalizar').classList.add('hidden');
        }

        // KM Actual
        $('#kmActual').innerText = `${store.parametros.ultimoKM} km`;

        // UI Meta
        $('#metaDiariaValor').innerText = fmtMoney(store.parametros.metaDiaria);

        // Lista Deudas
        const list = $('#listaDeudasAdmin');
        const select = $('#abonoDeudaSelect');
        list.innerHTML = '';
        select.innerHTML = '<option value="">-- Seleccionar Deuda --</option>';

        store.deudas.forEach(d => {
            if(d.saldo <= 0) return;
            // Lista visual
            const li = document.createElement('li');
            li.className = 'list-item';
            li.innerHTML = `<span>${d.desc} (${d.frecuencia})</span> <strong>${fmtMoney(d.saldo)}</strong>`;
            list.appendChild(li);
            
            // Select para abonos
            const opt = document.createElement('option');
            opt.value = d.id;
            opt.innerText = `${d.desc} (Cuota: ${fmtMoney(d.montoCuota)})`;
            select.appendChild(opt);
        });
    },

    // --- OTRAS PÁGINAS ---
    renderDashboard: (store) => {
        const hoy = new Date().toDateString();
        // Filtros simples
        const turnosHoy = store.turnos.filter(t => new Date(t.fecha).toDateString() === hoy);
        const movsHoy = store.movimientos.filter(m => new Date(m.fecha).toDateString() === hoy && m.tipo === 'ingreso');
        
        const horas = turnosHoy.reduce((a,b)=>a+b.horas,0);
        const ganancia = movsHoy.reduce((a,b)=>a+b.monto,0);
        
        $('#valHoras').innerText = horas.toFixed(1) + 'h';
        $('#valGanancia').innerText = fmtMoney(ganancia);
        
        const meta = store.parametros.metaDiaria;
        const prog = meta > 0 ? (ganancia/meta)*100 : 0;
        
        $('#valMeta').innerText = fmtMoney(meta);
        $('#txtProgreso').innerText = prog.toFixed(0) + '%';
        $('#barProgreso').style.width = Math.min(prog, 100) + '%';
        
        renderCharts(store);
    },

    renderWallet: (store) => {
        $('#valWallet').innerText = fmtMoney(store.wallet.saldo);
        // Lista simple de historial wallet (opcional, no está en HTML pero es útil saber)
        const list = $('#listaDeudas'); // Reusamos el container de lista si existe
        if(list) {
            list.innerHTML = store.deudas.filter(d=>d.saldo>0).map(d=>`
                <li class="list-item">
                    <div><b>${d.desc}</b><br><small>Resta</small></div>
                    <div class="text-red">${fmtMoney(d.saldo)}</div>
                </li>
            `).join('');
        }
    },

    renderHistorial: (store) => {
        const tbody = $('#tablaBody');
        const movs = store.movimientos.slice().reverse().slice(0, 50);
        tbody.innerHTML = movs.map(m => `
            <tr>
                <td>${fmtDate(m.fecha).split(' ')[0]}</td>
                <td>
                    <b>${m.desc}</b><br>
                    <small style="color:#64748b">${m.categoria || m.grupo}</small>
                </td>
                <td style="text-align:right" class="${m.tipo==='ingreso'?'text-green':'text-red'}">
                    ${fmtMoney(m.monto)}
                </td>
            </tr>
        `).join('');
        
        renderCharts(store); // Para gráfica de gas
    }
};

document.addEventListener("DOMContentLoaded", App.init);
