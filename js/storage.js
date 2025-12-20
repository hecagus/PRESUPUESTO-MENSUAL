const KEY = 'finanzas_v2';

function loadData() {
  const old = localStorage.getItem('finanzas');
  if (old && !localStorage.getItem(KEY)) {
    localStorage.setItem(KEY, old);
  }
  return JSON.parse(localStorage.getItem(KEY)) || {
    turno:null, gastos:[], deudas:[], gasolina:[],
    kmActual:null, mantenimiento:{}, ingresos:[]
  };
}

function saveData(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

function exportJSON() {
  const data = loadData();
  const blob = new Blob([JSON.stringify(data)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'finanzas.json';
  a.click();
}
