import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files=[
  'js/05_init.js','js/07_sync.js','js/08_pwa.js','js/15_accounts_engine.js','js/16_forecast_engine.js',
  'js/17_automation_engine.js','js/18_health_goals.js','js/19_platform_ui.js','js/20_home_engine.js',
  'js/21_financial_life_v27.js','js/22_home_ui.js','js/23_home_semantics.js','js/24_home_ui_v28.js','js/25_activity_insights.js','sw.js'
];

test('módulos financieros tienen sintaxis JavaScript válida',()=>{
  for(const file of files)assert.doesNotThrow(()=>execFileSync(process.execPath,['--check',file],{stdio:'pipe'}),file);
});

test('service worker v3 cachea plataforma sin depender de addAll',()=>{
  const sw=readFileSync('sw.js','utf8');
  for(const name of ['15_accounts_engine.js','16_forecast_engine.js','17_automation_engine.js','18_health_goals.js','19_platform_ui.js','20_home_engine.js','21_financial_life_v27.js','22_home_ui.js','23_home_semantics.js','24_home_ui_v28.js','25_activity_insights.js','pwa-bootstrap.js'])assert.match(sw,new RegExp(name.replace('.','\\.')));
  assert.match(sw,/home\.html/);assert.match(sw,/hecagus-finance-3\.0\.0-shell/);
  assert.match(sw,/Promise\.allSettled/);assert.doesNotMatch(sw,/cache\.addAll\(/);
});
