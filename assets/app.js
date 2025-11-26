            /**
 * app.js - actualizado
 * Soporta:
 * - categorías (incluye agregar/borrar personalizadas)
 * - tipos de ingreso (agregar/borrar)
 * - gasolina: calculo = (km_end - km_start) * price_per_km (desde configuración)
 *
 * LocalStorage keys:
 * - budget_data_v1  -> array movimientos
 * - budget_cfg_v1   -> { price_per_km, km_start, km_end, categories:[], income_types:[] }
 */

window.app = (function () {
  const DATA_KEY = 'budget_data_v1';
  const CFG_KEY = 'budget_cfg_v1';

  const BUILTIN_CATEGORIES = [
    'Transporte','Gasolina','Despensa','Alquiler','Internet','Streaming','Luz','Agua','Comida','Otros'
  ];
  const DEFAULT_INCOME_TYPES = ['Quincenal','Mensual','Propinas','Otros'];

  // --- Utilities storage ---
  function readData() {
    try {
      const raw = localStorage.getItem(DATA_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { console.error(e); return []; }
  }
  function saveData(data) { localStorage.setItem(DATA_KEY, JSON.stringify(data)); }

  function readCfg() {
    try {
      const raw = localStorage.getItem(CFG_KEY);
      if (!raw) {
        // init default cfg
        const def = {
          price_per_km: 0,
          km_start: 0,
          km_end: 0,
          categories: [], // user added
          income_types: [] // user added
        };
        localStorage.setItem(CFG_KEY, JSON.stringify(def));
        return def;
      }
      return JSON.parse(raw);
    } catch (e) { console.error(e); return { price_per_km:0, km_start:0, km_end:0, categories:[], income_types:[] }; }
  }
  function saveCfg(cfg) { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }

  // Helper: merged categories (builtins + custom)
  function getAllCategories() {
    const cfg = readCfg();
    return BUILTIN_CATEGORIES.concat(cfg.categories || []);
  }
  function getAllIncomeTypes() {
    const cfg = readCfg();
    return DEFAULT_INCOME_TYPES.concat(cfg.income_types || []);
  }

  // --- Gasolina calculation ---
  function kmDiffAndCost(cfg) {
    const kmStart = Number(cfg.km_start) || 0;
    const kmEnd = Number(cfg.km_end) || 0;
    const price = Number(cfg.price_per_km) || 0;
    const diff = Math.max(0, kmEnd - kmStart);
    const cost = +(diff * price);
    return { diff, cost };
  }

  // --- Amount effective (for gastos) ---
  function amountEffective(item, cfg) {
    if (item.tipo === 'gasto' && String(item.categoria).toLowerCase() === 'gasolina') {
      // use cfg gasoline calc
      const g = kmDiffAndCost(cfg);
      return +g.cost;
    }
    return +(Number(item.monto) || 0);
  }

  function computeSummary(data, cfg) {
    let ingresos = 0;
    let gastos = 0;
    data.forEach(it => {
      if (it.tipo === 'ingreso') ingresos += Number(it.monto) || 0;
      else gastos += amountEffective(it, cfg);
    });
    return { ingresos:+ingresos, gastos:+gastos, balance: +(ingresos - gastos) };
  }

  // --- Charts / public render ---
  let pieChart = null, barChart = null;
  function renderPublic() {
    const data = readData();
    const cfg = readCfg();
    const summary = computeSummary(data, cfg);

    document.getElementById('total-income').textContent = formatCurrency(summary.ingresos);
    document.getElementById('total-expense').textContent = formatCurrency(summary.gastos);
    document.getElementById('balance').textContent = formatCurrency(summary.balance);

    // recent
    const tbody = document.querySelector('#recent-table tbody');
    tbody.innerHTML = '';
    const sorted = data.slice().sort((a,b)=> (b.fecha || '').localeCompare(a.fecha || ''));
    sorted.slice(0,12).forEach(row=>{
      const tr = document.createElement('tr');
      const monto = row.tipo === 'ingreso' ? Number(row.monto) : amountEffective(row,cfg);
      tr.innerHTML = `<td>${escapeHtml(row.fecha||'')}</td>
                      <td>${escapeHtml(capitalize(row.tipo||''))}</td>
                      <td>${escapeHtml(row.tipo==='ingreso' ? (row.income_type||'') : (row.categoria||''))}</td>
                      <td>${escapeHtml(row.descripcion||'')}</td>
                      <td>${formatCurrency(monto)}</td>`;
      tbody.appendChild(tr);
    });

    renderPieExpenses(data,cfg);
    renderBarBalance(data,cfg);
  }

  function renderPieExpenses(data,cfg) {
    const gastos = data.filter(d=>d.tipo==='gasto');
    const byCat = {};
    gastos.forEach(g=>{
      const cat = g.categoria || 'Otros';
      byCat[cat] = (byCat[cat]||0) + amountEffective(g,cfg);
    });
    const labels = Object.keys(byCat);
    const values = labels.map(l=> +byCat[l].toFixed(2));
    const ctx = document.getElementById('pie-expense').getContext('2d');
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(ctx,{ type:'pie', data:{ labels, datasets:[{ data:values, backgroundColor: generateColors(labels.length) }] }, options:{ plugins:{ legend:{ position:'bottom' } } } });
  }

  function renderBarBalance(data,cfg) {
    const byMonth = {};
    data.forEach(it=>{
      const fecha = it.fecha || '';
      if (!fecha) return;
      const month = fecha.slice(0,7);
      byMonth[month] = byMonth[month] || { ingresos:0, gastos:0 };
      if (it.tipo==='ingreso') byMonth[month].ingresos += Number(it.monto) || 0;
      else byMonth[month].gastos += amountEffective(it,cfg);
    });
    const months = Object.keys(byMonth).sort();
    const balances = months.map(m => +(byMonth[m].ingresos - byMonth[m].gastos).toFixed(2));
    const ctx = document.getElementById('bar-balance').getContext('2d');
    if (barChart) barChart.destroy();
    barChart = new Chart(ctx,{ type:'bar', data:{ labels:months, datasets:[{ label:'Balance', data:balances, backgroundColor: generateColors(months.length) }] }, options:{ plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true } } } });
  }

  // --- Admin functions ---
  function initAdmin() {
    // elements
    const form = document.getElementById('movement-form');
    const mType = document.getElementById('m-type');
    const incomeWrap = document.getElementById('income-type-wrap');
    const categoryWrap = document.getElementById('category-wrap');
    const mIncomeSelect = document.getElementById('m-income-type');
    const mCategorySelect = document.getElementById('m-category');
    const newIncomeInput = document.getElementById('new-income-type');
    const newCategoryInput = document.getElementById('new-category');
    const btnAddIncome = document.getElementById('btn-add-income-type');
    const btnAddCategory = document.getElementById('btn-add-category');
    const amountWrap = document.getElementById('amount-wrap');
    const amountInput = document.getElementById('m-amount');
    const gasInfo = document.getElementById('gas-info');
    const cfgKmDiffSpan = document.getElementById('cfg-km-diff');
    const cfgGasCostSpan = document.getElementById('cfg-gas-cost');

    const cfgKmStart = document.getElementById('cfg-km-start');
    const cfgKmEnd = document.getElementById('cfg-km-end');
    const cfgPriceKm = document.getElementById('cfg-price-km');
    const btnSaveCfg = document.getElementById('btn-save-cfg');

    const btnClear = document.getElementById('btn-clear');
    const allTableBody = document.querySelector('#all-table tbody');

    const btnExport = document.getElementById('btn-export');
    const btnImport = document.getElementById('btn-import');
    const importFile = document.getElementById('import-file');
    const importText = document.getElementById('import-text');
    const btnImportPaste = document.getElementById('btn-import-paste');

    const customCatsList = document.getElementById('custom-categories-list');
    const customIncList = document.getElementById('custom-income-types-list');

    // load cfg/data
    const cfg = readCfg();
    cfgKmStart.value = cfg.km_start || 0;
    cfgKmEnd.value = cfg.km_end || 0;
    cfgPriceKm.value = cfg.price_per_km || 0;

    // fill selects
    function populateSelects() {
      // income types
      mIncomeSelect.innerHTML = '';
      getAllIncomeTypes().forEach(t => {
        const opt = document.createElement('option'); opt.value = t; opt.textContent = t; mIncomeSelect.appendChild(opt);
      });
      // categories
      mCategorySelect.innerHTML = '';
      getAllCategories().forEach(c => {
        const opt = document.createElement('option'); opt.value = c; opt.textContent = c; mCategorySelect.appendChild(opt);
      });
    }
    populateSelects();

    // render lists of custom items with delete buttons
    function renderCustomLists() {
      const cfgLocal = readCfg();
      // custom categories
      customCatsList.innerHTML = '';
      (cfgLocal.categories || []).forEach((c, idx) => {
        const div = document.createElement('div');
        div.className = 'chip';
        div.innerHTML = `<span>${escapeHtml(c)}</span> <button class="btn small" data-idx="${idx}" data-type="cat-del">Eliminar</button>`;
        customCatsList.appendChild(div);
      });
      // custom income types
      customIncList.innerHTML = '';
      (cfgLocal.income_types || []).forEach((t, idx) => {
        const div = document.createElement('div');
        div.className = 'chip';
        div.innerHTML = `<span>${escapeHtml(t)}</span> <button class="btn small" data-idx="${idx}" data-type="inc-del">Eliminar</button>`;
        customIncList.appendChild(div);
      });

      // attach handlers
      customCatsList.querySelectorAll('button[data-type="cat-del"]').forEach(b=>{
        b.addEventListener('click', ()=>{
          const i = Number(b.getAttribute('data-idx'));
          const cfgL = readCfg();
          if (!confirm(`Eliminar categoría personalizada "${cfgL.categories[i]}" ?`)) return;
          cfgL.categories.splice(i,1);
          saveCfg(cfgL);
          populateSelects(); renderCustomLists();
        });
      });
      customIncList.querySelectorAll('button[data-type="inc-del"]').forEach(b=>{
        b.addEventListener('click', ()=>{
          const i = Number(b.getAttribute('data-idx'));
          const cfgL = readCfg();
          if (!confirm(`Eliminar tipo de ingreso "${cfgL.income_types[i]}" ?`)) return;
          cfgL.income_types.splice(i,1);
          saveCfg(cfgL);
          populateSelects(); renderCustomLists();
        });
      });
    }
    renderCustomLists();

    // show/hide fields by tipo (ingreso/gasto)
    function toggleFields() {
      const val = mType.value;
      if (val === 'ingreso') {
        incomeWrap.style.display = 'block';
        categoryWrap.style.display = 'none';
        amountWrap.style.display = 'block';
        gasInfo.style.display = 'none';
      } else {
        incomeWrap.style.display = 'none';
        categoryWrap.style.display = 'block';
        amountWrap.style.display = 'block';
      }
    }
    mType.addEventListener('change', toggleFields);
    toggleFields();

    // when category changes, if Gasolina -> hide amount and show calc
    function onCategoryChange() {
      const cat = (mCategorySelect.value||'').toLowerCase();
      const cfgL = readCfg();
      const g = kmDiffAndCost(cfgL);
      cfgKmDiffSpan.textContent = g.diff;
      cfgGasCostSpan.textContent = formatCurrency(g.cost);
      if (cat === 'gasolina') {
        amountWrap.style.display = 'none';
        gasInfo.style.display = 'block';
      } else {
        amountWrap.style.display = 'block';
        gasInfo.style.display = 'none';
      }
    }
    mCategorySelect.addEventListener('change', onCategoryChange);
    onCategoryChange();

    // add new income type
    btnAddIncome.addEventListener('click', () => {
      const val = (newIncomeInput.value||'').trim();
      if (!val) return alert('Escribe un nombre para el tipo de ingreso.');
      const cfgL = readCfg();
      cfgL.income_types = cfgL.income_types || [];
      if (DEFAULT_INCOME_TYPES.concat(cfgL.income_types).includes(val)) return alert('Ese tipo ya existe.');
      cfgL.income_types.push(val);
      saveCfg(cfgL);
      newIncomeInput.value = '';
      populateSelects();
      renderCustomLists();
    });

    // add new category
    btnAddCategory.addEventListener('click', () => {
      const val = (newCategoryInput.value||'').trim();
      if (!val) return alert('Escribe un nombre para la categoría.');
      const cfgL = readCfg();
      cfgL.categories = cfgL.categories || [];
      if (BUILTIN_CATEGORIES.concat(cfgL.categories).includes(val)) return alert('Esa categoría ya existe.');
      cfgL.categories.push(val);
      saveCfg(cfgL);
      newCategoryInput.value = '';
      populateSelects();
      renderCustomLists();
    });

    // save configuration
    btnSaveCfg.addEventListener('click', () => {
      const cfgL = readCfg();
      cfgL.km_start = Number(cfgKmStart.value) || 0;
      cfgL.km_end = Number(cfgKmEnd.value) || 0;
      cfgL.price_per_km = Number(cfgPriceKm.value) || 0;
      saveCfg(cfgL);
      alert('Configuración guardada.');
      // refresh gas info and public
      onCategoryChange();
      try { window.app && window.app.initPublic && window.app.initPublic(); } catch(e){}
    });

    // Submit movimiento
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const date = document.getElementById('m-date').value || new Date().toISOString().slice(0,10);
      const tipo = mType.value;
      const descripcion = document.getElementById('m-desc').value || '';
      const cfgL = readCfg();
      let item = { fecha: date, tipo, descripcion, monto:0, categoria:null, income_type:null };

      if (tipo === 'ingreso') {
        const incomeType = mIncomeSelect.value;
        const monto = Number(amountInput.value) || 0;
        item.income_type = incomeType;
        item.monto = +monto;
      } else {
        const categoria = mCategorySelect.value;
        item.categoria = categoria;
        if ((categoria||'').toLowerCase() === 'gasolina') {
          const g = kmDiffAndCost(cfgL);
          item.monto = +g.cost;
          // optionally store km diff snapshot
          item.km_diff = g.diff;
          item.price_per_km = cfgL.price_per_km || 0;
        } else {
          item.monto = +(Number(amountInput.value) || 0);
        }
      }

      const data = readData();
      data.push(item);
      saveData(data);
      form.reset();
      populateSelects(); onCategoryChange(); renderAdminTable();
      alert('Movimiento agregado.');
    });

    // borrar todos
    btnClear.addEventListener('click', () => {
      if (!confirm('¿Borrar todos los movimientos?')) return;
      saveData([]);
      renderAdminTable();
      alert('Movimientos borrados.');
    });

    // Export / Import
    btnExport.addEventListener('click', () => {
      const payload = { data: readData(), cfg: readCfg() };
      const blob = new Blob([JSON.stringify(payload,null,2)], { type:'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `presupuesto_export_${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url);
    });
    document.getElementById('btn-import').addEventListener('click', ()=> importFile.click());
    importFile.addEventListener('change', (ev)=>{
      const f = ev.target.files && ev.target.files[0]; if(!f) return;
      const reader = new FileReader();
      reader.onload = function(e){
        try {
          const parsed = JSON.parse(e.target.result);
          if (parsed.data && Array.isArray(parsed.data)) saveData(parsed.data);
          else if (Array.isArray(parsed)) saveData(parsed);
          if (parsed.cfg) saveCfg(Object.assign(readCfg(), parsed.cfg));
          renderAdminTable(); populateSelects(); renderCustomLists();
          alert('Importación exitosa.');
        } catch(err){ alert('Error importando JSON: '+err.message); }
      };
      reader.readAsText(f);
      ev.target.value = '';
    });
    btnImportPaste.addEventListener('click', ()=>{
      const txt = importText.value.trim(); if(!txt) return alert('Pega un JSON válido');
      try {
        const parsed = JSON.parse(txt);
        if (parsed.data && Array.isArray(parsed.data)) saveData(parsed.data);
        else if (Array.isArray(parsed)) saveData(parsed);
        if (parsed.cfg) saveCfg(Object.assign(readCfg(), parsed.cfg));
        renderAdminTable(); populateSelects(); renderCustomLists();
        alert('Importación exitosa.');
      } catch(err){ alert('Error importando JSON: '+err.message); }
    });

    // Render admin table
    function renderAdminTable() {
      const data = readData();
      const cfgL = readCfg();
      allTableBody.innerHTML = '';
      const sorted = data.slice().sort((a,b)=> (b.fecha||'').localeCompare(a.fecha||''));
      sorted.forEach((it, idx) => {
        const tr = document.createElement('tr');
        const monto = it.tipo==='ingreso' ? Number(it.monto) : amountEffective(it,cfgL);
        const label = it.tipo === 'ingreso' ? (it.income_type || '') : (it.categoria || '');
        tr.innerHTML = `<td>${escapeHtml(it.fecha||'')}</td>
                        <td>${escapeHtml(capitalize(it.tipo||''))}</td>
                        <td>${escapeHtml(label)}</td>
                        <td>${escapeHtml(it.descripcion||'')}</td>
                        <td>${formatCurrency(monto)}</td>
                        <td>
                          <button class="btn small" data-idx="${idx}" data-action="delete">Eliminar</button>
                        </td>`;
        allTableBody.appendChild(tr);
      });

      // attach delete handlers
      allTableBody.querySelectorAll('button[data-action="delete"]').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const i = Number(btn.getAttribute('data-idx'));
          const sortedNow = readData().slice().sort((a,b)=> (b.fecha||'').localeCompare(a.fecha||''));
          const itemToRemove = sortedNow[i];
          if (!confirm('Eliminar este movimiento?')) return;
          const original = readData();
          const idxOrig = original.findIndex(o => JSON.stringify(o) === JSON.stringify(itemToRemove));
          if (idxOrig >= 0) {
            original.splice(idxOrig,1);
            saveData(original);
            renderAdminTable();
            alert('Movimiento eliminado.');
          } else alert('No se encontró el movimiento.');
        });
      });

      // update public if open
      try { window.app && window.app.initPublic && window.app.initPublic(); } catch(e){}
    }

    // initial render
    populateSelects();
    renderCustomLists();
    renderAdminTable();
    onCategoryChange();
  }

  // --- Public init ---
  function initPublic() {
    renderPublic();
    window.addEventListener('focus', renderPublic);
  }

  // --- Helpers ---
  function formatCurrency(v) {
    const n = Number(v) || 0;
    return '$' + n.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2});
  }
  function escapeHtml(text){ if (text == null) return ''; return String(text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'); }
  function capitalize(s){ if (!s) return s; return s.charAt(0).toUpperCase() + s.slice(1); }
  function generateColors(n) {
    const base = ['#0066cc','#2b9af3','#00a86b','#ffb020','#ff6b6b','#7b61ff','#00b5ad','#f77f00','#9fb0ff','#ffd6a5','#caffbf','#bdb2ff'];
    const res = []; for (let i=0;i<n;i++) res.push(base[i % base.length]); return res;
  }

  // expose
  return { initAdmin, initPublic, _internals: { readData, saveData, readCfg, saveCfg, computeSummary } };
})();
