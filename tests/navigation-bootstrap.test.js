import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import * as Data from '../js/02_data.js';
test('actual bootstrap loads each old and new page with an existing account and renders its controls',async()=>{
  const base=new URL('../js/05_init.js',import.meta.url);
  let source=await readFile(base,'utf8');
  source=source.replace(/import \{ initSync, notifyLocalChange, signOutAccount \} from '[^']+';/,'const initSync=async()=>{},notifyLocalChange=()=>{},signOutAccount=async()=>{};');
  source=source.replace(/import \{ initPWA, promptInstall, canPromptInstall \} from '[^']+';/,'const initPWA=()=>{},promptInstall=async()=>{},canPromptInstall=()=>false;');
  source=source.replace(/from '(\.\/[^']+)'/g,(_match,path)=>`from '${new URL(path,base).href}'`);
  for(const file of ['index.html','home.html','admin.html','wallet.html','historial.html','calendar.html','stats.html','more.html','settings.html']){
    const dom=new JSDOM(await readFile(new URL('../'+file,import.meta.url),'utf8'),{url:'https://app.example/'+file});
    const errors=[];dom.window.addEventListener('error',event=>errors.push(event.error));
    globalThis.document=dom.window.document;globalThis.window=dom.window;globalThis.localStorage=dom.window.localStorage;globalThis.Option=dom.window.Option;globalThis.CustomEvent=dom.window.CustomEvent;globalThis.location=dom.window.location;
    globalThis.alert=message=>errors.push(message);globalThis.confirm=()=>false;
    window.setInterval=()=>0;
    Data.restaurar(JSON.stringify({...Data.createEmptyState(),profile:{onboarded:true,useCases:['personal'],transportMode:'none'},workSources:[{id:'job',name:'Trabajo',kind:'freelance',compensation:'variable',active:true,trackTime:false}],movimientos:[{id:'cash',tipo:'ingreso',monto:777,fecha:'2026-09-30T12:00:00Z',accountId:'acct-personal',affectsPersonal:true}]}));
    await import(`data:text/javascript;base64,${Buffer.from(source+'\n// '+file).toString('base64')}`);
    document.dispatchEvent(new window.Event('DOMContentLoaded'));await Promise.resolve();
    assert.deepEqual(errors,[],file);assert.equal(document.querySelectorAll('.bottom-nav a').length,5,file);
    if(file==='index.html')assert.match(document.getElementById('mainSummaryValue').textContent,/777/);
    if(file==='wallet.html'){assert.match(document.getElementById('valWallet').textContent,/777/);assert.ok(document.getElementById('debtList'));assert.equal(document.querySelectorAll('#moneyNav a').length,4);}
    if(file==='settings.html'){assert.ok(document.querySelector('[data-settings-source]'));assert.ok(document.querySelector('[data-platform-action="min-free"]'));}
    if(file==='historial.html')assert.match(document.getElementById('tablaBody').textContent,/777/);
    assert.equal(Data.getState().wallet.saldo,777,file);
    dom.window.close();
  }
});
