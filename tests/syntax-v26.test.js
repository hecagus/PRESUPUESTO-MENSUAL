import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files=[
  'js/05_init.js','js/07_sync.js','js/15_accounts_engine.js','js/16_forecast_engine.js',
  'js/17_automation_engine.js','js/18_health_goals.js','js/19_platform_ui.js','sw.js'
];

test('módulos v2.6 tienen sintaxis JavaScript válida',()=>{
  for(const file of files){
    assert.doesNotThrow(()=>execFileSync(process.execPath,['--check',file],{stdio:'pipe'}),file);
  }
});

test('service worker cachea los módulos financieros nuevos',()=>{
  const sw=readFileSync('sw.js','utf8');
  for(const name of ['15_accounts_engine.js','16_forecast_engine.js','17_automation_engine.js','18_health_goals.js','19_platform_ui.js'])assert.match(sw,new RegExp(name.replace('.','\\.')));
  assert.match(sw,/hecagus-finance-2\.6\.\d+-shell/);
});
