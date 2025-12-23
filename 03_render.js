import { $ } from './01_consts_utils.js';

export const Modal = {
    el: $('#appModal'),
    title: $('#modalTitle'),
    body: $('#modalBody'),
    showInput: (title, inputsConfig, onConfirm) => {
        Modal.title.innerText = title;
        Modal.body.innerHTML = '';
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
                if(conf.placeholder) input.placeholder = conf.placeholder;
                if(conf.value) input.value = conf.value;
            }
            input.onchange = (e) => values[conf.key] = e.target.value;
            values[conf.key] = conf.value || (conf.type==='select' ? conf.options[0].value : '');
            div.appendChild(input);
            Modal.body.appendChild(div);
        });

        const btnCancel = $('#modalCancel');
        const btnConfirm = $('#modalConfirm');
        const newCancel = btnCancel.cloneNode(true);
        const newConfirm = btnConfirm.cloneNode(true);
        btnCancel.parentNode.replaceChild(newCancel, btnCancel);
        btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);

        newCancel.onclick = Modal.close;
        newConfirm.onclick = () => {
            const inputs = Modal.body.querySelectorAll('.input-control');
            inputs.forEach((inp, idx) => values[inputsConfig[idx].key] = inp.value);
            if(onConfirm(values) !== false) Modal.close();
        };
        Modal.el.classList.add('open');
    },
    close: () => Modal.el.classList.remove('open')
};

export const renderNav = (page) => {
    if($('#main-nav')) return;
    const nav = document.createElement('nav');
    nav.id = 'main-nav';
    nav.className = 'bottom-nav';
    nav.innerHTML = `
        <a href="index.html" class="nav-link ${page==='index'?'active':''}"><span>📊</span>Panel</a>
        <a href="wallet.html" class="nav-link ${page==='wallet'?'active':''}"><span>💰</span>Wallet</a>
        <a href="admin.html" class="nav-link ${page==='admin'?'active':''}"><span>⚙️</span>Admin</a>
        <a href="historial.html" class="nav-link ${page==='historial'?'active':''}"><span>📜</span>Historial</a>
    `;
    document.body.appendChild(nav);
};
