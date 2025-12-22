import { $ } from './01_consts_utils.js';

// --- GESTOR DE MODALES (SIN PROMPT) ---
export const Modal = {
    el: $('#appModal'),
    title: $('#modalTitle'),
    body: $('#modalBody'),
    
    // Renderiza inputs dinámicos
    showInput: (title, inputsConfig, onConfirm) => {
        Modal.title.innerText = title;
        Modal.body.innerHTML = ''; // Limpiar

        const values = {};

        inputsConfig.forEach(conf => {
            const div = document.createElement('div');
            div.className = 'input-group';
            div.innerHTML = `<label>${conf.label}</label>`;
            
            const input = document.createElement(conf.type === 'select' ? 'select' : 'input');
            input.className = 'input-control';
            
            if (conf.type === 'select') {
                conf.options.forEach(opt => {
                    const o = document.createElement('option');
                    o.value = opt.value;
                    o.innerText = opt.text;
                    input.appendChild(o);
                });
            } else {
                input.type = conf.type || 'text';
                input.placeholder = conf.placeholder || '';
                if(conf.value) input.value = conf.value;
            }

            input.onchange = (e) => values[conf.key] = e.target.value;
            // Init value
            values[conf.key] = conf.value || (conf.type==='select' ? conf.options[0].value : '');
            
            div.appendChild(input);
            Modal.body.appendChild(div);
        });

        // Setup botones
        const btnCancel = $('#modalCancel');
        const btnConfirm = $('#modalConfirm');

        // Clonar para eliminar listeners viejos
        const newCancel = btnCancel.cloneNode(true);
        const newConfirm = btnConfirm.cloneNode(true);
        btnCancel.parentNode.replaceChild(newCancel, btnCancel);
        btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);

        newCancel.onclick = Modal.close;
        newConfirm.onclick = () => {
            // Recoger valores finales (por si no hubo onchange)
            const inputs = Modal.body.querySelectorAll('.input-control');
            inputs.forEach((inp, idx) => {
                const key = inputsConfig[idx].key;
                values[key] = inp.value;
            });
            
            if(onConfirm(values) !== false) {
                Modal.close();
            }
        };

        Modal.el.classList.add('open');
    },

    close: () => {
        Modal.el.classList.remove('open');
    }
};

// --- NAVEGACIÓN ---
export const renderNav = (activePage) => {
    const nav = document.createElement('nav');
    nav.className = 'bottom-nav';
    nav.innerHTML = `
        <a href="index.html" class="nav-link ${activePage==='index'?'active':''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
            Panel
        </a>
        <a href="wallet.html" class="nav-link ${activePage==='wallet'?'active':''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            Wallet
        </a>
        <a href="admin.html" class="nav-link ${activePage==='admin'?'active':''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Admin
        </a>
        <a href="historial.html" class="nav-link ${activePage==='historial'?'active':''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Historial
        </a>
    `;
    document.body.appendChild(nav);
};
