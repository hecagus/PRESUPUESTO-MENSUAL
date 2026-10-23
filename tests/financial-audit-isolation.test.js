import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

globalThis.localStorage = { data: new Map(), getItem(key) { return this.data.get(key) ?? null; }, setItem(key, value) { this.data.set(key, String(value)); } };
const Data = await import('../js/02_data.js');
const UI = await import('../js/30_financial_audit_ui.js');
const now = new Date('2026-10-21T18:00:00Z');
test.beforeEach(t => {
  t.mock.timers.enable({ apis: ['Date'], now });
  Data.restaurar(JSON.stringify({ ...Data.createEmptyState(), profile: { onboarded: true }, savingsGoals: [], financialPlan: { freshness: { lastConfirmedAt: now.toISOString() } } }));
  const dom = new JSDOM('<body style="overflow:scroll"><main id="background"><button id="outside">Acción anterior</button></main><aside id="alreadyInert" inert="existing"></aside></body>', { url: 'https://audit.test/' });
  globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.CustomEvent = dom.window.CustomEvent;
});

const open = () => UI.showFinancialAudit(() => {}, { manual: true });
const cancel = () => [...document.querySelectorAll('.audit-form button')].find(button => button.textContent === 'Volver sin guardar').click();
const tab = (target, shiftKey = false) => { const event = new window.KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true }); target.dispatchEvent(event); return event; };

test('la auditoría aísla acciones y foco del fondo, y restaura el estado al cancelar', () => {
  const outside = document.getElementById('outside'), main = document.getElementById('background'), inert = document.getElementById('alreadyInert');
  let clicks = 0; outside.addEventListener('click', () => clicks++); outside.focus(); open();
  assert.equal(main.hasAttribute('inert'), true); assert.equal(inert.hasAttribute('inert'), true);
  outside.click(); assert.equal(clicks, 0); assert.equal(document.getElementById('financialAuditOverlay').contains(document.activeElement), true);
  outside.focus(); assert.equal(document.getElementById('financialAuditOverlay').contains(document.activeElement), true);
  cancel(); assert.equal(main.hasAttribute('inert'), false); assert.equal(inert.getAttribute('inert'), 'existing'); assert.equal(document.body.style.overflow, 'scroll');
  assert.equal(document.activeElement, outside); outside.click(); assert.equal(clicks, 1);
});

test('ShiftTab desde el título queda en el diálogo e incluye enlaces y tabindex visibles', () => {
  open(); const dialog = document.getElementById('financialAuditOverlay'), section = document.getElementById('auditSyncCard'); section.classList.remove('hidden');
  section.innerHTML = '<a id="auditHelp" href="#help">Ayuda</a><span id="auditExtra" tabindex="0">Otra opción</span><button hidden>Oculto</button><div style="display:none"><button>También oculto</button></div><button disabled>Deshabilitado</button>';
  const title = dialog.querySelector('h1'), first = dialog.querySelector('input'), last = document.getElementById('auditExtra'), link = document.getElementById('auditHelp');
  title.focus(); assert.equal(tab(title, true).defaultPrevented, true); assert.equal(document.activeElement, last);
  assert.equal(tab(last).defaultPrevented, true); assert.equal(document.activeElement, first);
  assert.equal(tab(first, true).defaultPrevented, true); assert.equal(document.activeElement, last);
  link.focus(); assert.equal(tab(link).defaultPrevented, false);
  cancel();
});

test('reconstruir y cerrar una revisión vigente limpia listeners e inert una sola vez', () => {
  const outside = document.getElementById('outside'), main = document.getElementById('background'); let clicks = 0;
  outside.addEventListener('click', () => clicks++); outside.focus(); open();
  UI.showFinancialAudit(() => {}, { manual: true, rebuild: true });
  assert.equal(document.querySelectorAll('#financialAuditOverlay').length, 1); assert.equal(main.hasAttribute('inert'), true);
  outside.click(); assert.equal(clicks, 0);
  assert.equal(UI.showFinancialAudit(() => {}, { rebuild: true }), false);
  assert.equal(UI.isFinancialAuditOpen(), false); assert.equal(main.hasAttribute('inert'), false); assert.equal(document.body.style.overflow, 'scroll');
  outside.click(); assert.equal(clicks, 1);
  open(); cancel(); outside.click(); assert.equal(clicks, 2); assert.equal(main.hasAttribute('inert'), false);
});
