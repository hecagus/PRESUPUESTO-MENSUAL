import './00_migrate.js';
import { STORAGE_KEY } from './01_consts_utils.js';

const base = {
  turno: null,
  gastos: [],
  deudas: [
    { id: 1, nombre: 'Moto', saldo: 13919 },
    { id: 2, nombre: 'Uber Pro Card', saldo: 516 }
  ]
};

export const load = () =>
  JSON.parse(localStorage.getItem(STORAGE_KEY)) || structuredClone(base);

export const save = d =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
