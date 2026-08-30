import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('panel ofrece login e instalación a usuarios nuevos hasta completar setup',async()=>{
  const html=await read('index.html'),init=await read('js/05_init.js');
  assert.match(html,/id="syncCard"/);assert.match(html,/id="syncPanel"/);
  assert.match(html,/id="appInstallCard"/);assert.match(html,/id="btnInstallApp"/);
  assert.match(init,/initGlobalEvents/);assert.match(init,/promptInstall/);
});

test('usuarios sin datos locales ven acceso y recuperación antes del onboarding',async()=>{
  const html=await read('onboarding.html'),js=await read('js/10_onboarding.js'),sync=await read('js/07_sync.js');
  assert.match(html,/id="authGate"/);assert.match(html,/recupera lo tuyo/i);
  assert.match(html,/id="syncCard"/);assert.match(html,/id="btnStartFresh"/);
  assert.match(html,/id="setupFlow" class="hidden"/);
  assert.match(js,/initSync\(\)/);assert.match(js,/budget:remote-applied/);assert.match(js,/budget:sync-complete/);
  assert.match(js,/profile\?\.onboarded/);assert.match(js,/notifyLocalChange\(\)/);
  assert.match(sync,/budget:sync-complete/);assert.match(sync,/emitSyncComplete\('pull'\)/);assert.match(sync,/emitSyncComplete\('push'\)/);
});

test('onboarding permite cambiar situación y configurar transporte público',async()=>{
  const html=await read('onboarding.html'),js=await read('js/10_onboarding.js');
  assert.match(html,/¿Cómo llegas a trabajar\?/);assert.match(html,/¿Cuánto cuesta vivir\?/);
  assert.match(js,/source-status/);assert.match(js,/public-out/);assert.match(js,/public-back/);assert.match(js,/updateSourceLife/);
});

test('onboarding final no mezcla editores de fuente con tarjetas de transporte',async()=>{
  const js=await read('js/10_onboarding.js');
  assert.match(js,/const box=\$\('sourceEditors'\);if\(!box\)return;/);
  assert.match(js,/box\.querySelectorAll\('\.source-editor'\)/);
  assert.doesNotMatch(js,/document\.querySelectorAll\('\.source-editor'\)/);
  assert.match(js,/function save\(\)\{\s*try\{/);
});

test('calendario financiero forma parte del shell offline',async()=>{
  const html=await read('calendar.html'),sw=await read('sw.js');
  assert.match(html,/Calendario financiero/);assert.match(html,/Dinero realmente libre|situación real/i);
  assert.match(sw,/calendar\.html/);assert.match(sw,/13_financial_life\.js/);assert.match(sw,/14_calendar_ui\.js/);
});

test('saldo inicial se oculta después de declararlo y deuda permite pago único',async()=>{
  const init=await read('js/05_init.js');
  assert.match(init,/btnConfigSaldo/);
  assert.match(init,/saldoInicialConfigurado/);
  assert.match(init,/classList\.toggle\('hidden'/);
  assert.match(init,/Una sola vez/);
});

test('nuevo logo es el icono PWA y forma parte del shell offline',async()=>{
  const html=await read('index.html'),manifest=await read('manifest.webmanifest'),sw=await read('sw.js');
  assert.match(html,/hecagus-finance-192\.png/);
  assert.match(manifest,/hecagus-finance-192\.png/);assert.match(manifest,/hecagus-finance-512\.png/);
  assert.match(sw,/hecagus-finance-192\.png/);assert.match(sw,/hecagus-finance-512\.png/);
});