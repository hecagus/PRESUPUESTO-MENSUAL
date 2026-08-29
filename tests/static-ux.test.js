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

test('onboarding permite cambiar situación y configurar transporte público',async()=>{
  const html=await read('onboarding.html'),js=await read('js/10_onboarding.js');
  assert.match(html,/¿Cómo llegas a trabajar\?/);assert.match(html,/¿Cuánto cuesta vivir\?/);
  assert.match(js,/source-status/);assert.match(js,/public-out/);assert.match(js,/public-back/);assert.match(js,/updateSourceLife/);
});

test('calendario financiero forma parte del shell offline',async()=>{
  const html=await read('calendar.html'),sw=await read('sw.js');
  assert.match(html,/Calendario financiero/);assert.match(html,/Dinero realmente libre|situación real/i);
  assert.match(sw,/calendar\.html/);assert.match(sw,/13_financial_life\.js/);assert.match(sw,/14_calendar_ui\.js/);
});
