function updateAdminUI() {
    // A. Actualizar KM Visual
    if($('kmActual')) $('kmActual').innerText = `${store.parametros.ultimoKM} km`;
    
    // B. Meta Diaria
    const metaHoy = store.wallet.sobres.reduce((a,b) => a + (b.meta - b.acumulado > 0 ? (b.meta/7) : 0), 0) + (120 * safeFloat(store.parametros.costoPorKm));
    if($('metaDiariaValor')) $('metaDiariaValor').innerText = fmtMoney(metaHoy);
    
    // C. CORRECCIÓN LÓGICA DE TURNO (CRÍTICO)
    const activo = !!store.turnoActivo;
    const btnIniciar = $('btnTurnoIniciar');
    const btnFinalizar = $('btnTurnoFinalizar');
    
    if($('turnoEstado')) {
        $('turnoEstado').innerHTML = activo 
            ? `<span style="color:green; font-weight:bold; animation:pulse 2s infinite;">🟢 EN CURSO</span>` 
            : `<span style="color:#64748b; font-weight:bold;">🔴 DETENIDO</span>`;
    }

    // Toggle de botones (Estado consistente)
    if(btnIniciar) btnIniciar.style.display = activo ? 'none' : 'block';
    if(btnFinalizar) btnFinalizar.style.display = activo ? 'block' : 'none';

    // D. MENÚ GASTOS RECURRENTES
    const cardHogar = $('btnGastoHogar')?.closest('.card');
    if(cardHogar && !document.getElementById('zoneRecurrentes')) {
        const div = document.createElement('div');
        div.id = 'zoneRecurrentes';
        div.style = "background:#f1f5f9; padding:10px; border-radius:8px; margin-bottom:15px; border:1px solid #cbd5e1;";
        div.innerHTML = `
            <h4 style="margin-top:0; font-size:0.9rem; color:#475569">Pagar Gasto Recurrente</h4>
            <div style="display:flex; gap:5px;">
                <select id="selRecurrente" class="input-control" style="flex:1;"><option value="">Seleccionar...</option></select>
                <button id="btnPagarRecurrente" class="btn btn-success" style="padding:5px 10px;">Pagar</button>
            </div>`;
        cardHogar.insertBefore(div, $('btnGastoHogar'));
        
        div.querySelector('#btnPagarRecurrente').onclick = () => {
            const id = $('selRecurrente').value;
            if(!id) return alert("Selecciona un gasto primero");
            if(confirm("¿Confirmar pago?")) pagarGastoRecurrente(id);
        };
    }
    const selR = $('selRecurrente');
    if(selR) {
        selR.innerHTML = '<option value="">Seleccionar...</option>';
        store.gastosFijosMensuales.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id; opt.innerText = `${g.desc} (${fmtMoney(g.monto)})`;
            selR.appendChild(opt);
        });
    }

    // E. CORRECCIÓN DEUDAS (FEEDBACK VISUAL)
    // Renderizamos lista informativa si existe el contenedor, o solo el select
    const sel = $('abonoDeudaSelect');
    if(sel) { 
        sel.innerHTML = '<option value="">-- Pagar Deuda --</option>'; 
        store.deudas.forEach(d => {
            if(d.saldo < 1) return; 
            
            // Calculamos estado del sobre asociado
            const s = store.wallet.sobres.find(x => x.refId === d.id);
            const acumulado = s ? safeFloat(s.acumulado) : 0;
            const meta = s ? safeFloat(s.meta) : d.montoCuota;
            const falta = meta - acumulado;

            const opt = document.createElement('option'); 
            opt.value = d.id; 
            // Texto enriquecido en el select para decisión rápida
            opt.innerText = `${d.desc} (Faltan ${fmtMoney(falta)} en sobre)`; 
            sel.appendChild(opt);
        });
    }

    // Botón Reporte (Inyección segura)
    const zone = document.querySelector('#btnExportJSON')?.parentNode;
    if(zone && !document.getElementById('btnVerReporte')) {
        const btn = document.createElement('button'); btn.id = 'btnVerReporte'; 
        btn.className = 'btn btn-primary'; btn.style.marginBottom = '10px'; 
        btn.innerText = '📈 Ver Reporte'; btn.onclick = generarReporteSemanal; 
        zone.prepend(btn);
    }
}
function init() {
    console.log("🚀 APP V4.0 CORRECCIONES LÓGICAS"); loadData();
    const page = document.body.dataset.page;
    document.querySelectorAll('.nav-link').forEach(l=>{if(l.getAttribute('href').includes(page))l.classList.add('active')});

    if(page === 'index') {
        const hoy=new Date().toDateString();
        const gan=store.turnos.filter(t=>new Date(t.fecha).toDateString()===hoy).reduce((a,b)=>a+b.ganancia,0);
        if($('resGananciaBruta')) $('resGananciaBruta').innerText=fmtMoney(gan);
        const m=document.querySelector('main.container'); let rd=$('resumenHumano');
        if(!rd&&m){rd=document.createElement('div');rd.id='resumenHumano';const c=m.querySelector('.card');if(c)c.insertAdjacentElement('afterend',rd);else m.prepend(rd);}
        if(rd) rd.innerHTML=generarResumenHumanoHoy(store);
    }
    if(page === 'historial') renderHistorialBlindado(store);
    if(page === 'wallet') {
        let comp=0; store.wallet.sobres.forEach(s=>comp+=safeFloat(s.acumulado));
        if($('valWallet')) $('valWallet').innerHTML=`${fmtMoney(store.wallet.saldo)}<br><small style="color:${store.wallet.saldo-comp>=0?'green':'orange'}">Libre: ${fmtMoney(store.wallet.saldo-comp)}</small>`;
        const m=document.querySelector('main.container'); let c=$('sobresContainer');
        if(!c&&m){c=document.createElement('div');c.id='sobresContainer';m.appendChild(c);}
        if(c) c.innerHTML=store.wallet.sobres.map(s=>`
            <div class="card" style="padding:12px; margin-top:10px; border-left:4px solid ${s.tipo==='deuda'?'#ef4444':'#3b82f6'}">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px"><strong>${s.desc}</strong><small>${fmtMoney(s.acumulado)} / ${fmtMoney(s.meta)}</small></div>
                <div style="background:#e2e8f0; height:8px; border-radius:4px;"><div style="width:${Math.min((s.acumulado/s.meta)*100,100)}%; background:${s.tipo==='deuda'?'#ef4444':'#3b82f6'}; height:100%; border-radius:4px;"></div></div>
            </div>`).join('');
    }
    if(page === 'admin') {
        updateAdminUI();
        setInterval(()=>{if($('turnoTimer')&&store.turnoActivo){const d=Date.now()-store.turnoActivo.inicio,h=Math.floor(d/3600000),m=Math.floor((d%3600000)/60000);$('turnoTimer').innerText=`${h}h ${m}m`}},1000);
        const bind=(i,f)=>{const e=$(i);if(e)e.onclick=x=>{x.preventDefault();f();updateAdminUI()}};
        
        // --- 🔒 BLINDAJE DE KILOMETRAJE ---
        const btnKm = $('btnConfigKM');
        if(btnKm) {
            btnKm.className = 'btn btn-outline'; // Visualmente menos agresivo
            btnKm.onclick = (e) => {
                e.preventDefault();
                alert("🔒 ACCIÓN PROTEGIDA\n\nEl kilometraje se actualiza automáticamente al registrar Gasolina o Finalizar Turno.\n\nNo se permite edición manual para evitar inconsistencias financieras.");
            };
        }

        // --- 🎨 NORMALIZACIÓN VISUAL (Gasto Operativo) ---
        const btnOp = $('btnGastoOperativo');
        if(btnOp) {
            // Eliminamos clases de peligro o alerta si existen
            btnOp.classList.remove('btn-danger', 'btn-outline-danger');
            btnOp.classList.add('btn-primary'); // Forzamos estilo neutral/positivo
        }

        // Binds normales
        bind('btnTurnoIniciar',()=>!store.turnoActivo&&(store.turnoActivo={inicio:Date.now()},saveData(),updateAdminUI()));
        bind('btnTurnoFinalizar',()=>Modal.showInput("Fin",[{label:"KM Final (Tablero)",key:"km",type:"number"},{label:"Ganancia Total",key:"g",type:"number"}],d=>finalizarTurno(d.km,d.g)));
        
        const wiz=(g)=>Modal.showInput(`Nuevo Gasto ${g}`,[{label:"Desc",key:"d"},{label:"$$",key:"m",type:"number"},{label:"Cat",key:"c",type:"select",options:CATEGORIAS[g.toLowerCase()].map(x=>({value:x,text:x}))},{label:"Freq",key:"f",type:"select",options:Object.keys(FRECUENCIAS).map(x=>({value:x,text:x}))}],d=>procesarNuevoGasto(d.d,d.m,g,d.c,d.f));
        bind('btnGastoHogar',()=>wiz('Hogar')); 
        // Nota: GastoOperativo ya fue normalizado visualmente arriba, aquí solo atamos la lógica
        if($('btnGastoOperativo')) $('btnGastoOperativo').onclick = (e) => { e.preventDefault(); wiz('Operativo'); updateAdminUI(); };

        bind('btnGasolina',()=>Modal.showInput("Gas",[{label:"L",key:"l",type:"number"},{label:"$$",key:"c",type:"number"},{label:"KM",key:"k",type:"number"}],d=>registrarGasolina(d.l,d.c,d.k)));
        bind('btnDeudaNueva',()=>Modal.showInput("Deuda",[{label:"N",key:"n"},{label:"T",key:"t",type:"number"},{label:"C",key:"c",type:"number"},{label:"F",key:"f",type:"select",options:Object.keys(FRECUENCIAS).map(x=>({value:x,text:x}))},{label:"Día",key:"dp",type:"select",options:DIAS_SEMANA}],d=>agregarDeuda(d.n,d.t,d.c,d.f,d.dp)));
        bind('btnAbonoCuota',()=>abonarDeuda($('abonoDeudaSelect').value, store.deudas.find(x=>x.id==$('abonoDeudaSelect').value)?.montoCuota));
        bind('btnExportJSON',()=>navigator.clipboard.writeText(JSON.stringify(store)).then(()=>alert("Copiado")));
        bind('btnRestoreBackup',()=>Modal.showInput("Restaurar",[{label:"JSON",key:"j"}],d=>{try{store={...INITIAL_STATE,...JSON.parse(d.j)};sanearDatos();saveData();location.reload()}catch(e){alert("Error")}}));
    }
           }

