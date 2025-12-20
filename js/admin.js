const data = loadData();

/* ===== MENU ===== */
menuToggle.onclick = () => navMenu.classList.toggle('active');

/* ===== TURNO ===== */
btnTurno.onclick = () => {
  data.turno = { inicio:Date.now(), kmInicio:data.kmActual };
  turnoEstado.textContent = '🟢 Turno activo';
  turnoEstado.className = 'estado on';
  btnTurno.classList.add('hidden');
  turnoFinal.classList.remove('hidden');
  saveData(data);
};

finalizarTurno.onclick = () => {
  data.kmActual = Number(kmFinal.value);
  data.ingresos.push(Number(gananciaTurno.value));
  data.turno = null;
  saveData(data);
  location.reload();
};

/* ===== GASTOS ===== */
const categorias = {
  hogar:['Luz','Renta','Internet','Streaming'],
  operativo:['Talachas','Mecánico','Refacciones']
};

function renderCategorias() {
  categoriaGasto.innerHTML = '';
  categorias[tipoGasto.value].forEach(c=>{
    const o=document.createElement('option'); o.textContent=c;
    categoriaGasto.appendChild(o);
  });
}
tipoGasto.onchange = renderCategorias;
renderCategorias();

gastoRecurrente.onchange = ()=>fechaPago.classList.toggle('hidden',!gastoRecurrente.checked);

registrarGasto.onclick = ()=>{
  data.gastos.push({
    tipo:tipoGasto.value,
    categoria:categoriaGasto.value,
    monto:+montoGasto.value,
    fecha:fechaPago.value||null
  });
  saveData(data);
};

/* ===== GASOLINA ===== */
guardarGasolina.onclick = ()=>{
  data.gasolina.push({
    km:+kmGasolina.value,
    litros:+litros.value,
    costo:+costoGas.value
  });
  saveData(data);
};

/* ===== DEUDAS ===== */
registrarDeuda.onclick = ()=>{
  data.deudas.push({
    nombre:deudaNombre.value,
    total:+deudaTotal.value,
    pago:+deudaPago.value,
    fecha:deudaFecha.value,
    abonos:[]
  });
  saveData(data);
  location.reload();
};

/* ===== META ===== */
const totalRecurrentes =
  data.gastos.filter(g=>g.fecha).reduce((a,b)=>a+b.monto,0) +
  data.deudas.reduce((a,b)=>a+b.pago,0);

metaDiaria.textContent = '$'+(totalRecurrentes/6).toFixed(2);

/* ===== IMPORT / EXPORT ===== */
exportar.onclick = exportJSON;

importar.onchange = e=>{
  const r=new FileReader();
  r.onload=()=>{ localStorage.setItem(KEY,r.result); location.reload(); };
  r.readAsText(e.target.files[0]);
};
