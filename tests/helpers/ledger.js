// Historical queries need a historical opening entry, not today's Date.now().
export function historicalOpening(Data, amount, date = '2026-01-01T00:00:00.000Z') {
  Data.saldoInicial(amount);
  Data.getState().movimientos.at(-1).fecha = date;
  Data.sanearDatos();
}
