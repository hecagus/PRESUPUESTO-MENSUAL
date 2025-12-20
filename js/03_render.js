import { $, fmtMoney } from './01_consts_utils.js';
import * as Data from './02_data.js';

/* ===== HEADER / MENU ===== */
export const renderGlobalHeader = () => {
    const menuEl = document.querySelector('.nav-menu'); 
    const btnEl = document.querySelector('.menu-toggle');

    if (btnEl && menuEl) {
        btnEl.onclick = (e) => {
            e.stopPropagation();
            menuEl.classList.toggle('active');
        };
        document.addEventListener('click', (e) => {
            if (!menuEl.contains(e.target) && !btnEl.contains(e.target)) {
                menuEl.classList.remove('active');
            }
        });
    }
};

/* ===== ADMIN UI ===== */
export const renderAdminUI = () => {
    const s = Data.getState();
    
    // 1. Estado del Turno
    const lblEstado = $("turnoEstado");
    const btnIn = $("btnTurno");
    const divFin = $("turnoFinal");
    
    if (lblEstado) {
        if (s.turno) {
            lblEstado.textContent = '🟢 Turno activo';
            lblEstado.className = 'estado on';
            if(btnIn) btnIn.classList.add('hidden');
            if(divFin) divFin.classList.remove('hidden');
        } else {
            lblEstado.textContent = '🔴 Sin turno';
            lblEstado.className = 'estado off';
            if(btnIn) btnIn.classList.remove('hidden');
            if(divFin) divFin.classList.add('hidden');
        }
    }

    // 2. Meta Diaria
    const metaEl = $("metaDiaria");
    if (metaEl) {
        const meta = Data.calcularMetaDiaria();
        metaEl.textContent = fmtMoney(meta);
    }

    // 3. Kilometraje
    const kmEl = $("kmActual");
    if (kmEl) kmEl.textContent = `Kilometraje actual: ${s.kmActual || '--'}`;

    // 4. Categorías de Gasto
    const selTipo = $("tipoGasto");
    const selCat = $("categoriaGasto");
    
    const CATS = {
        hogar: ['Luz', 'Renta', 'Internet', 'Streaming', 'Comida'],
        operativo: ['Talachas', 'Mecánico', 'Refacciones', 'Equipo', 'Plan Datos']
    };

    const fillCats = () => {
        if (!selTipo || !selCat) return;
        selCat.innerHTML = '';
        const lista = CATS[selTipo.value] || [];
        lista.forEach(c => {
            const o = document.createElement('option');
            o.textContent = c;
            selCat.appendChild(o);
        });
    };

    if (selTipo) selTipo.onchange = fillCats;
    fillCats(); // Ejecutar al inicio

    // 5. Toggle Fecha Pago
    const checkRec = $("gastoRecurrente");
    const dateInput = $("fechaPago");
    if (checkRec && dateInput) {
        checkRec.onchange = () => {
            if (checkRec.checked) dateInput.classList.remove('hidden');
            else dateInput.classList.add('hidden');
        };
    }
};

/* ===== WALLET UI ===== */
export const renderWalletUI = () => {
    const div = $("walletInfo");
    if (!div) return;
    
    const s = Data.getState();
    if (s.deudas.length === 0) {
        div.innerHTML = "<p>No hay deudas registradas.</p>";
        return;
    }
    
    div.innerHTML = s.deudas.map(d => `
        <div style="border-bottom:1px solid #eee; padding:10px 0;">
            <strong>${d.nombre}</strong><br>
            Saldo: ${fmtMoney(d.saldo)}<br>
            <small>Pago sugerido: ${fmtMoney(d.pago)}</small>
        </div>
    `).join('');
};

/* ===== HISTORIAL UI ===== */
export const renderHistorialUI = () => {
    const div = $("historial");
    if (!div) return;

    const s = Data.getState();
    
    const htmlGastos = s.gastos.slice().reverse().map(g => 
        `<div style="color:#dc2626; padding:5px 0; border-bottom:1px solid #eee;">
            ➖ ${g.categoria} (${g.tipo}): ${fmtMoney(g.monto)}
        </div>`
    ).join('');

    const htmlIngresos = s.ingresos.slice().reverse().map(i => 
        `<div style="color:#16a34a; padding:5px 0; border-bottom:1px solid #eee;">
            ➕ Ingreso Turno: ${fmtMoney(i)}
        </div>`
    ).join('');

    div.innerHTML = `<h3>Últimos Movimientos</h3>${htmlIngresos}${htmlGastos}`;
};

