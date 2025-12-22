import { loadData, getStore, setUltimoKM, iniciarTurno, finalizarTurno, registrarGasolina, agregarMovimiento, agregarDeuda, abonarDeuda, importJSON } from './02_data.js';
import { $, fmtMoney, fmtDate, safeFloat, CATEGORIAS, FRECUENCIAS } from './01_consts_utils.js';
import { renderNav, Modal } from './03_render.js';
import { renderCharts } from './04_charts.js';

const App = {
    init: () => {
        loadData();
        const store = getStore();
        const page = document.body.dataset.page;

        // 1. Renderizar Navegación
        renderNav(page);

        // 2. Onboarding Check (Bloqueante)
        if (store.parametros.ultimoKM === 0) {
            Modal.showInput(
                "¡Bienvenido! Configuración Inicial",
                [{ label: "¿Cuál es tu Kilometraje Actual?", key: "km", type: "number", placeholder: "Ej. 15000" }],
                (data) => {
                    if (safeFloat(data.km) > 0) {
                        setUltimoKM(data.km);
                        window.location.reload();
                        return true;
                    }
                    return false; // Mantener abierto si falla
                }
            );
            return; // Detener ejecución hasta que configure
        }

        // 3. Router Lógico
        if (page === 'index') App.pageIndex(store);
        if (page === 'admin') App.pageAdmin(store);
        if (page === 'wallet') App.pageWallet(store);
        if (page === 'historial') App.pageHistorial(store);
    },

    pageIndex: (store) => {
        const hoy = new Date();
        const turnosHoy = store.turnos.filter(t => new Date(t.fecha).toDateString() === hoy.toDateString());
        const gananciaHoy = store.movimientos
            .filter(m => m.tipo === 'ingreso' && new Date(m.fecha).toDateString() === hoy.toDateString())
            .reduce((sum, m) => sum + m.monto, 0);

        const horasHoy = turnosHoy.reduce((sum, t) => sum + t.horas, 0);
        
        // Render
        $('#valHoras').innerText = horasHoy.toFixed(1) + 'h';
        $('#valGanancia').innerText = fmtMoney(gananciaHoy);
        
        // Meta
        const meta = store.parametros.gastoFijo;
        const progreso = meta > 0 ? (gananciaHoy / meta) * 100 : 0;
        
        $('#valMeta').innerText = fmtMoney(meta);
        $('#barProgreso').style.width = Math.min(progreso, 100) + '%';
        $('#txtProgreso').innerText = progreso.toFixed(0) + '%';

        // Gráficas
        renderCharts(store);
    },

    pageAdmin: (store) => {
        // UI Turno
        const t = store.turnoActivo;
        if(t) {
            $('#statusTurno').innerHTML = `<span class="badge bg-green">EN CURSO</span> Inicio: ${fmtDate(t.inicio)}`;
            $('#btnIniciar').classList.add('hidden');
            $('#btnFinalizar').classList.remove('hidden');
        } else {
            $('#statusTurno').innerHTML = `<span class="badge bg-red">DETENIDO</span>`;
            $('#btnIniciar').classList.remove('hidden');
            $('#btnFinalizar').classList.add('hidden');
        }

        // Eventos Turno
        $('#btnIniciar').onclick = () => {
            iniciarTurno();
            window.location.reload();
        };

        $('#btnFinalizar').onclick = () => {
            Modal.showInput(
                "Finalizar Turno",
                [
                    { label: "Kilometraje Final", key: "km", type: "number", value: store.parametros.ultimoKM },
                    { label: "Ganancia Total ($)", key: "ganancia", type: "number" }
                ],
                (data) => {
                    const km = safeFloat(data.km);
                    if(km <= store.parametros.ultimoKM) { alert("El KM debe ser mayor al actual"); return false; }
                    finalizarTurno(km, data.ganancia);
                    window.location.reload();
                }
            );
        };

        // Eventos Gasolina
        $('#btnGasolina').onclick = () => {
            Modal.showInput(
                "Registrar Gasolina",
                [
                    { label: "Litros", key: "litros", type: "number" },
                    { label: "Costo Total ($)", key: "costo", type: "number" },
                    { label: "KM Actual", key: "km", type: "number", value: store.parametros.ultimoKM }
                ],
                (data) => {
                    if(safeFloat(data.km) <= store.parametros.ultimoKM) { alert("Error en KM"); return false; }
                    registrarGasolina(data.litros, data.costo, data.km);
                    alert("✅ Gasolina registrada");
                    return true;
                }
            );
        };

        // Eventos Gasto
        $('#btnGasto').onclick = () => {
            const cats = [...CATEGORIAS.operativo, ...CATEGORIAS.personal];
            Modal.showInput(
                "Registrar Gasto",
                [
                    { label: "Descripción", key: "desc", type: "text" },
                    { label: "Monto ($)", key: "monto", type: "number" },
                    { label: "Categoría", key: "cat", type: "select", options: cats.map(c => ({value:c, text:c})) }
                ],
                (data) => {
                    const esOp = CATEGORIAS.operativo.includes(data.cat);
                    agregarMovimiento('gasto', data.desc, data.monto, esOp?'Operativo':'Personal', data.cat);
                    alert("✅ Gasto registrado");
                    return true;
                }
            );
        };
        
        // Deudas y JSON
        $('#btnDeuda').onclick = () => {
            Modal.showInput(
                "Nueva Deuda",
                [
                    { label: "Nombre", key: "desc", type: "text" },
                    { label: "Total a Pagar ($)", key: "total", type: "number" },
                    { label: "Cuota Periódica ($)", key: "cuota", type: "number" },
                    { label: "Frecuencia", key: "freq", type: "select", options: Object.keys(FRECUENCIAS).map(k=>({value:k, text:k})) }
                ],
                (data) => {
                    agregarDeuda(data.desc, data.total, data.cuota, data.freq);
                    alert("✅ Deuda agregada. Meta diaria actualizada.");
                    return true;
                }
            );
        };

        $('#btnJson').onclick = () => {
            const json = prompt("Pega el JSON aquí para restaurar (CUIDADO: Borra datos actuales):");
            if(json) {
                if(importJSON(json)) { alert("✅ Restaurado"); window.location.reload(); }
                else alert("❌ JSON Inválido");
            }
        };
        
        // Render Meta
        $('#valMetaCalc').innerText = fmtMoney(store.parametros.gastoFijo);
    },

    pageWallet: (store) => {
        // Cálculo de Wallet: Ingresos - (Gastos + Gasolina + Deudas)
        // La lógica real es compleja, aquí simplificamos a Flujo de Caja
        const totalIngresos = store.movimientos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);
        const totalGastos = store.movimientos.filter(m => m.tipo === 'gasto').reduce((s, m) => s + m.monto, 0);
        
        const saldo = totalIngresos - totalGastos;
        
        $('#valSaldo').innerText = fmtMoney(saldo);
        $('#valSaldo').className = saldo >= 0 ? 'value text-green' : 'value text-red';

        // Lista de Deudas
        const list = $('#listaDeudas');
        store.deudas.forEach(d => {
            if(d.saldo <= 0) return;
            const li = document.createElement('li');
            li.className = 'list-item';
            li.innerHTML = `
                <div>
                    <strong>${d.desc}</strong><br>
                    <small>Resta: ${fmtMoney(d.saldo)} (${d.frecuencia})</small>
                </div>
                <button class="btn-success badge" style="border:none; cursor:pointer;">Pagar</button>
            `;
            // Botón pagar
            li.querySelector('button').onclick = () => {
                Modal.showInput(
                    `Abonar a ${d.desc}`,
                    [{ label: "Monto a abonar", key: "monto", type: "number", value: d.montoCuota }],
                    (data) => {
                        abonarDeuda(d.id, data.monto);
                        window.location.reload();
                        return true;
                    }
                );
            };
            list.appendChild(li);
        });
    },

    pageHistorial: (store) => {
        const tbody = $('#tablaBody');
        // Últimos 50 movimientos
        const movs = store.movimientos.slice().reverse().slice(0, 50);
        
        tbody.innerHTML = movs.map(m => `
            <tr>
                <td>${fmtDate(m.fecha)}<br><small>${m.categoria}</small></td>
                <td>${m.desc}</td>
                <td class="${m.tipo==='ingreso'?'text-green':'text-red'}">
                    ${m.tipo==='ingreso'?'+':'-'}${fmtMoney(m.monto)}
                </td>
            </tr>
        `).join('');
    }
};

// Arrancar cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", App.init);
