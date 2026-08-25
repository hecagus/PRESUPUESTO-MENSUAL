/* V10.1 - Repositorio local. Unico responsable de localStorage. */
import { STORAGE_KEY, LEGACY_KEYS } from '../01_consts_utils.js';

export const LocalRepository = {
  loadRaw() {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw || raw.length < 50) {
      for (const key of LEGACY_KEYS) {
        const legacy = localStorage.getItem(key);
        if (legacy && legacy.length >= 50) return legacy;
      }
    }
    return raw;
  },
  load() {
    const raw = this.loadRaw();
    if (!raw) return null;
    return JSON.parse(raw);
  },
  save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  },
  export(state) {
    return JSON.stringify(state, null, 2);
  },
  import(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    this.save(data);
    return data;
  },
  clear() {
    localStorage.removeItem(STORAGE_KEY);
  }
};
