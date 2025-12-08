// ... (resto del código data)

// --- CRUD GENERICS ---

// Gasto Normal (Historial)
export const agregarGasto = (gasto) => { 
    state.gastos.push(gasto); 
    state.movimientos.push({
        tipo: 'gasto',
        fecha: gasto.fecha,
        desc: `${gasto.categoria} (${gasto.desc || ''})`,
        monto: gasto.monto
    }); 
    saveData(); 
};

// Gasto Fijo (Afecta Meta Diaria)
export const agregarGastoFijo = (gastoFijo) => { 
    // Aseguramos estructura para gasto fijo
    state.gastosFijosMensuales.push({
        id: gastoFijo.id,
        categoria: gastoFijo.categoria,
        monto: gastoFijo.monto,
        frecuencia: gastoFijo.frecuencia,
        desc: gastoFijo.desc
    });
    // También lo registramos como movimiento del día de hoy (opcional, el primer pago)
    state.movimientos.push({
        tipo: 'gasto',
        fecha: gastoFijo.fecha,
        desc: `Alta Gasto Fijo: ${gastoFijo.categoria}`,
        monto: gastoFijo.monto
    });
    
    recalcularMetaDiaria(); // ¡Esto actualiza el $0.00 del dashboard!
};
