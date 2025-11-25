/**
 * app.js
 * Lógica para index (público) y admin.
 *
 * Keys en localStorage:
 *  - budget_data_v1  -> JSON array de movimientos
 *  - budget_cfg_v1   -> objeto de configuración { price_per_km: number }
 *
 * Movimiento:
 * {
 *   fecha: "YYYY-MM-DD",
 *   tipo: "ingreso"|"gasto",
 *   categoria: string,
 *   descripcion: string,
 *   monto: number,
 *   km: number|null,
 *   price_per_km: number|null
 * }
 */

window.app = (function () {
  const DATA_KEY = 'budget_data_v1';
  const CFG_KEY = 'budget_cfg_v1';

  // --- Utilities ---
  function readData() {
    try {
      const raw = localStorage.getItem(DATA_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Error leyendo data', e);
      return [];
    }
  }
  function saveData(data) {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
  }
  function readCfg() {
    try {
      const raw = localStorage.getItem(CFG_KEY);
      return raw ? JSON.parse(raw) : { price_per_km: 0.0 };
    } catch (e) {
      console.error('Error leyendo cfg', e);
      return { price_per_km: 0.0 };
    }
  }
  function saveCfg(cfg) {
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  }

  // calcular monto efectivo de gasto (considerando gasolina)
  function amountEffective(item, cfg) {
    const m = Number(item.monto) || 0;
    if (String(item.categoria).toLowerCase() === 'gasolina' || String(item.categoria).toLowerCase() === 'gas') {
      const km = Number(item.km) || 0;
      const price = Number(item.price_per_km != null ? item.price_per_km : cfg.price_per_km) || 0;
      return +(km * price);
    }
    return +m;
  }

  // --- Cálculos resumen ---
  function computeSummary(data, cfg) {
    let ingresos = 0;
    let gastos = 0;
    data.forEach(it => {
      if (it.tipo === 'ingreso') {
        ingresos += Number(it.monto) || 0;
      } else {
        gastos += amountEffective(it, cfg);
      }
    });
    return {
      ingresos: +ingresos,
      gastos: +gastos,
      balance: +(ingresos - gastos)
    };
  }

  // --- Render index (public) ---
  let pieChart = null, barChart = null;
  function renderPublic() {
    const data = readData();
    const cfg = readCfg();
    const summary = computeSummary(data, cfg);

    document.getElementById('total-income').textContent = formatCurrency(summary.ingresos);
    document.getElementById('total-expense').textContent = formatCurrency(summary.gastos);
    document.getElementById('balance').textContent = formatCurrency(summary.balance);

    // Recent table (máximo 12) - orden descendente por fecha
    const tbody = document.querySelector('#recent-table tbody');
    tbody.innerHTML = '';
    const sorted = data.slice().sort((a,b) => (b.fecha || '') .localeCompare(a.fecha || ''));
    sorted.slice(0,12).forEach(row => {
      const tr = document.createElement('tr');
      const monto = row.tipo === 'ingreso' ? Number(row.monto) : amountEffective(row, cfg);
      tr.innerHTML = `
        <td>${escapeHtml(row.fecha || '')}</td>
        <td>${escapeHtml(capitalize(row.tipo || ''))}</td>
        <td>${escapeHtml(row.categoria || '')}</td>
        <td>${escapeHtml(row.descripcion || '')}</td>
        <td>${formatCurrency(monto)}</td>
      `;
      tbody.appendChild(tr);
    });

    // Charts
    renderPieExpenses(data, cfg);
    renderBarBalance(data, cfg);
  }

  // Pie: gastos por categoría
  function renderPieExpenses(data, cfg) {
    const gastos = data.filter(d => d.tipo === 'gasto');
    const byCat = {};
    gastos.forEach(g => {
      const cat = g.categoria || 'Otros';
      byCat[cat] = (byCat[cat] || 0) + amountEffective(g, cfg);
    });
    const labels = Object.keys(byCat);
    const values = labels.map(l => +byCat[l].toFixed(2));

    const ctx = document.getElementById('pie-expense').getContext('2d');
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: generateColors(labels.length)
        }]
      },
      options: {
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  // Bar: balance por mes (YYYY-MM)
  function renderBarBalance(data, cfg) {
    // Agrupa por mes
    const byMonth = {}; // YYYY-MM -> { ingresos, gastos }
    data.forEach(it => {
      const fecha = it.fecha || '';
      if (!fecha) return;
      const month = fecha.slice(0,7); // YYYY-MM
      byMonth[month] = byMonth[month] || { ingresos:0, gastos:0 };
      if (it.tipo === 'ingreso') {
        byMonth[month].ingresos += Number(it.monto) || 0;
      } else {
        byMonth[month].gastos += amountEffective(it, cfg);
      }
    });

    // Orden meses ascendente
    const months = Object.keys(byMonth).sort();
    const balances = months.map(m => +(byMonth[m].ingresos - byMonth[m].gastos).toFixed(2));

    const ctx = document.getElementById('bar-balance').getContext('2d');
    if (barChart) barChart.destroy();
    barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [{
          label: 'Balance',
          data: balances,
          backgroundColor: generateColors(months.length)
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }

  // --- Admin functions ---
  function initAdmin() {
    const form = document.getElementById('movement-form');
    const mCategory = document.getElementById('m-category');
    const kmWrap = document.getElementById('km-wrap');
    const mType = document.getElementById('m-type');
    const cfgPrice = document.getElementById('cfg-price-km');
    const btnSaveCfg = document.getElementById('btn-save-cfg');
    const btnClear = document.getElementById('btn-clear');
    const allTableBody = document.querySelector('#all-table tbody');
    const btnExport = document.getElementById('btn-export');
    const btnImport = document.getElementById('btn-import');
    const importFile = document.getElementById('import-file');
    const importText = document.getElementById('import-text');
    const btnImportPaste = document.getElementById('btn-import-paste');

    // Rellenar cfg actual
    const cfg = readCfg();
    cfgPrice.value = Number(cfg.price_per_km || 0);

    // Mostrar/ocultar km si categoría Gasolina
    function toggleKm() {
      const cat = (mCategory.value || '').toLowerCase();
      if (cat === 'gasolina' || cat === 'gas') {
        kmWrap.style.display = 'block';
      } else {
        kmWrap.style.display = 'none';
      }
    }
    mCategory.addEventListener('change', toggleKm);
    toggleKm();

    // Guardar cfg
    btnSaveCfg.addEventListener('click', () => {
      const val = parseFloat(cfgPrice.value) || 0;
      saveCfg({ price_per_km: val });
      alert('Configuración guardada.');
    });

    // Submit movimiento
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const date = document.getElementById('m-date').value;
      const tipo = document.getElementById('m-type').value;
      const categoria = document.getElementById('m-category').value;
      const descripcion = document.getElementById('m-desc').value;
      const monto = parseFloat(document.getElementById('m-amount').value) || 0;
      const km = parseFloat(document.getElementById('m-km').value) || 0;
      const cfgLocal = readCfg();
      const item = {
        fecha: date || new Date().toISOString().slice(0,10),
        tipo,
        categoria,
        descripcion,
        monto: +monto,
        km: categoria.toLowerCase() === 'gasolina' ? +km : null,
        price_per_km: categoria.toLowerCase() === 'gasolina' ? (+cfgLocal.price_per_km || 0) : null
      };
      const data = readData();
      data.push(item);
      saveData(data);
      form.reset();
      cfgPrice.value = cfgLocal.price_per_km || 0;
      toggleKm();
      renderAdminTable();
      alert('Movimiento agregado.');
    });

    // Borrar todos movimientos
    btnClear.addEventListener('click', () => {
      if (!confirm('¿Borrar todos los movimientos? Esta acción no se puede deshacer.')) return;
      saveData([]);
      renderAdminTable();
      alert('Todos los movimientos fueron borrados.');
    });

    // Exportar datos a JSON
    btnExport.addEventListener('click', () => {
      const data = { data: readData(), cfg: readCfg() };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `presupuesto_export_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // Importar desde archivo
    btnImport.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', (ev) => {
      const f = ev.target.files && ev.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const parsed = JSON.parse(e.target.result);
          if (parsed.data && Array.isArray(parsed.data)) {
            saveData(parsed.data);
          } else if (Array.isArray(parsed)) {
            // si archivo fue un array de movimientos directo
            saveData(parsed);
          } else {
            throw new Error('Formato JSON no reconocido');
          }
          if (parsed.cfg) saveCfg(parsed.cfg);
          renderAdminTable();
          alert('Importación exitosa.');
        } catch (err) {
          alert('Error importando JSON: ' + err.message);
        }
      };
      reader.readAsText(f);
      // limpiar input
      ev.target.value = '';
    });

    // Importar desde texto (textarea)
    btnImportPaste.addEventListener('click', () => {
      const txt = importText.value.trim();
      if (!txt) { alert('Pega un JSON válido'); return; }
      try {
        const parsed = JSON.parse(txt);
        if (parsed.data && Array.isArray(parsed.data)) {
          saveData(parsed.data);
        } else if (Array.isArray(parsed)) {
          saveData(parsed);
        } else {
          throw new Error('Formato JSON no reconocido');
        }
        if (parsed.cfg) saveCfg(parsed.cfg);
        renderAdminTable();
        alert('Importación exitosa.');
      } catch (err) {
        alert('Error importando JSON: ' + err.message);
      }
    });

    // Render all table and refresh public if exists
    function renderAdminTable() {
      const data = readData();
      const cfgLocal = readCfg();
      allTableBody.innerHTML = '';
      // orden por fecha descendente
      const sorted = data.slice().sort((a,b)=> (b.fecha || '').localeCompare(a.fecha || ''));
      sorted.forEach((it, idx) => {
        const tr = document.createElement('tr');
        const monto = it.tipo === 'ingreso' ? Number(it.monto) : amountEffective(it, cfgLocal);
        tr.innerHTML = `
          <td>${escapeHtml(it.fecha || '')}</td>
          <td>${escapeHtml(it.tipo)}</td>
          <td>${escapeHtml(it.categoria)}</td>
          <td>${escapeHtml(it.descripcion || '')}</td>
          <td>${it.km != null ? escapeHtml(it.km) : ''}</td>
          <td>${formatCurrency(monto)}</td>
          <td>
            <button class="btn" data-idx="${idx}" data-action="delete">Eliminar</button>
          </td>
        `;
        allTableBody.appendChild(tr);
      });

      // Attach delete handlers (note: idx is correspond to sorted array - find item and remove by matching date+desc+monto)
      allTableBody.querySelectorAll('button[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const index = Number(btn.getAttribute('data-idx'));
          const itemToRemove = sorted[index];
          if (!confirm('Eliminar este movimiento?')) return;
          // find and remove first matching element in original array (by JSON string compare)
          const original = readData();
          const idxOrig = original.findIndex(o => JSON.stringify(o) === JSON.stringify(itemToRemove));
          if (idxOrig >= 0) {
            original.splice(idxOrig,1);
            saveData(original);
            renderAdminTable();
            alert('Movimiento eliminado.');
          } else {
            alert('No se encontró el movimiento para eliminar.');
          }
        });
      });

      // También refresca la vista pública si está abierta (siempre que exista función)
      try { window.app && window.app.initPublic && window.app.initPublic(); } catch(e){}
    }

    // Inicial render
    renderAdminTable();
  }

  // --- Public init ---
  function initPublic() {
    renderPublic();
    // refrescar cada vez que la ventana reciba foco (por si editaron en otra pestaña)
    window.addEventListener('focus', renderPublic);
  }

  // --- Helpers ---
  function formatCurrency(v) {
    const n = Number(v) || 0;
    // Formateo simple (MXN style, no locale dependency)
    return '$' + n.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2});
  }

  function escapeHtml(text) {
    if (text == null) return '';
    return String(text)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;');
  }

  function capitalize(s) {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // Generador de colores simple
  function generateColors(n) {
    const base = [
      '#0066cc','#2b9af3','#00a86b','#ffb020','#ff6b6b','#7b61ff','#00b5ad','#f77f00',
      '#9fb0ff','#ffd6a5','#caffbf','#bdb2ff'
    ];
    const res = [];
    for (let i=0;i<n;i++) res.push(base[i % base.length]);
    return res;
  }

  // Exponer funciones públicas
  return {
    initAdmin,
    initPublic,
    // helpers expuestas para uso interno si se requiere
    _internals: {
      readData, saveData, readCfg, saveCfg, computeSummary, amountEffective
    }
  };
})();
