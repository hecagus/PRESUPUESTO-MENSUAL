import { loadData, getStore, setUltimoKM, iniciarTurno, finalizarTurno, registrarGasolina, procesarGastoInteligente, agregarDeuda, abonarDeuda, importJSON, recalcularMetaDiaria } from './02_data.js';
import { $, fmtMoney, fmtDate, safeFloat, CATEGORIAS, FRECUENCIAS } from './01_consts_utils.js';
import { renderNav, Modal } from './03_render.js';
import { renderCharts } from './04_charts.js';

const App = {
    init: () => {
        loadData();
        const store = getStore();
        const page = document.body.dataset.page;
        renderNav(page);

        // ONBOARDING
        if (store.parametros.ultimoKM === 0) {
            Modal.showInput("Configuración Inicial", [{ label: "KM Actual", key: "km", type: "number" }], (d) => {
                if (safeFloat(d.km) > 0) { setUltimoKM(d.km); App.refresh(page); return true; }
                return false;
            });
            return;
        }

        if (page === 'index') App.index(store);
        if (page === 'admin') App.admin(store);
        if (page === 'wallet') App.wallet(store);
        if (page === 'historial') App.historial(store);
    },

    refresh: (page) => {
        loadData();
        const store = getStore();
        if(page === 'index') App.index(store);
        if(page === 'admin') App.admin(store);
        if(page === 'wallet') App.wallet(store);
    },

    index: (store) => {
        const hoy = new Date().toDateString();
        const turnosHoy = store.turnos.filter(t => new Date(t.fecha).toDateString() === hoy);
        const ganancia = store.movimientos.filter(m => m.tipo === 'ingreso' && new Date(m.fecha).toDateString() === hoy).reduce((a,b)=>a+b.monto,0);
        
        $('#valHoras').innerText = turnosHoy.reduce((a,b)=>a+b.horas,0).toFixed(1) + 'h';
        $('#valGanancia').innerText = fmtMoney(ganancia);
        
        const meta = store.parametros.metaDiaria;
        const prog = meta > 0 ? (ganancia/meta)*100 : 0;
        $('#valMeta').innerText = fmtMoney(meta);
        $('#barProgreso').style.width = Math.min(prog, 100) + '%';
        $('#txtProgreso').innerText = prog.toFixed(0) + '%';
        
        renderCharts(store);
    },

    admin: (store) => {
        // Cronómetro Vivo
        if(store.turnoActivo) {
            $('#btnIniciar').classList.add('hidden');
            $('#btnFinalizar').classList.remove('hidden');
            setInterval(() => {
                const diff = Date.now() - store.turnoActivo.inicio;
                const hrs = Math.floor(diff/3600000);
                const min = Math.floor((diff%3600000)/60000);
                $('#statusTurno').innerHTML = `<span class="badge bg-green">EN CURSO</span> ${hrs}h ${min}m`;
            }, 1000);
        } else {
            $('#statusTurno').innerHTML = `<span class="badge bg-red">DETENIDO</span>`;
        }

        $('#btnIniciar').onclick = () => { iniciarTurno(); App.refresh('admin'); };
        $('#btnFinalizar').onclick = () => {
            Modal.showInput("Finalizar Turno", [
                { label: "KM Final", key: "km", type: "number", value: store.parametros.ultimoKM },
                { label: "Ganancia ($)", key: "gan", type: "number" }
            ], (d) => {
                if(safeFloat(d.km) <= store.parametros.ultimoKM) { alert("KM debe ser mayor"); return false; }
                finalizarTurno(d.km, d.gan);
                App.refresh('admin');
            });
        };

        $('#btnGasolina').onclick = () => {
            Modal.showInput("Gasolina", [
                { label: "Litros", key: "l", type: "number" },
                { label: "Costo ($)", key: "c", type: "number" },
                { label: "KM Actual", key: "k", type: "number", value: store.parametros.ultimoKM }
            ], (d) => {
                if(safeFloat(d.k) <= store.parametros.ultimoKM) { alert("KM inválido"); return false; }
                registrarGasolina(d.l, d.c, d.k);
                App.refresh('admin');
            });
        };

        $('#btnGasto').onclick = () => {
            const cats = [...CATEGORIAS.operativo, ...CATEGORIAS.personal];
            Modal.showInput("Registrar Gasto", [
                { label: "Descripción", key: "desc", type: "text" },
                { label: "Monto ($)", key: "m", type: "number" },
                { label: "Categoría", key: "cat", type: "select", options: cats.map(c=>({value:c, text:c})) },
                { label: "Frecuencia", key: "freq", type: "select", options: Object.keys(FRECUENCIAS).map(k=>({value:k, text:k})) }
            ], (d) => {
                const grupo = CATEGORIAS.operativo.includes(d.cat) ? 'Operativo' : 'Hogar';
                procesarGastoInteligente(d.desc, d.m, grupo, d.cat, d.freq);
                alert("Guardado");
                App.refresh('admin');
            });
        };

        $('#btnDeuda').onclick = () => {
            Modal.showInput("Nueva Deuda", [
                { label: "Nombre", key: "n", type: "text" },
                { label: "Total ($)", key: "t", type: "number" },
                { label: "Cuota ($)", key: "c", type: "number" },
                { label: "Frecuencia", key: "f", type: "select", options: Object.keys(FRECUENCIAS).map(k=>({value:k, text:k})) }
            ], (d) => {
                agregarDeuda(d.n, d.t, d.c, d.f);
                App.refresh('admin');
            });
        };

        $('#btnJson').onclick = () => {
            // Backup automático antes de pedir restore
            console.log("Backup:", JSON.stringify(store));
            Modal.showInput("Restaurar JSON", [{label:"JSON", key:"json", type:"text"}], (d) => {
                if(importJSON(d.json)) { alert("Restaurado"); App.refresh('admin'); return true; }
                else { alert("JSON Inválido"); return false; }
            });
        };
        
        $('#valMetaCalc').innerText = fmtMoney(store.parametros.metaDiaria);
    },

    wallet: (store) => {
        $('#valWallet').innerText = fmtMoney(store.wallet.saldo);
        $('#valWallet').className = store.wallet.saldo >= 0 ? 'value text-green' : 'value text-red';
        
        const list = $('#listaDeudas');
        list.innerHTML = '';
        store.deudas.forEach(d => {
            if(d.saldo <= 0) return;
            const li = document.createElement('li');
            li.className = 'list-item';
            li.innerHTML = `<div><b>${d.desc}</b><br><small>Saldo: ${fmtMoney(d.saldo)}</small></div> <button class="btn-success badge">Pagar</button>`;
            li.querySelector('button').onclick = () => {
                Modal.showInput(`Abonar ${d.desc}`, [{label:"Monto", key:"m", type:"number", value:d.montoCuota}], (data)=>{
                    abonarDeuda(d.id, data.m);
                    App.refresh('wallet');
                });
            };
            list.appendChild(li);
        });
    },

    historial: (store) => {
        $('#tablaBody').innerHTML = store.movimientos.slice().reverse().slice(0,50).map(m => `
            <tr><td>${fmtDate(m.fecha)}</td><td>${m.desc}</td><td class="${m.tipo==='ingreso'?'text-green':'text-red'}">${fmtMoney(m.monto)}</td></tr>
        `).join('');
    }
};

document.addEventListener("DOMContentLoaded", App.init);
