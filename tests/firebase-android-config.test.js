import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {validateGoogleServices} from '../scripts/android-firebase-config.mjs';
import {signInNativeGoogle, GOOGLE_CONFIGURATION_MESSAGE} from '../native/signin.js';

const fingerprint='0123456789ABCDEF0123456789ABCDEF01234567';
const services=()=>({project_info:{project_id:'app-presupuesto-mensual'},client:[{client_info:{mobilesdk_app_id:'1:123:android:test',android_client_info:{package_name:'com.hecagus.presupuesto'}},api_key:[{current_key:'test-public-key'}],oauth_client:[{client_type:3,client_id:'test-web.apps.googleusercontent.com'},{client_type:1,client_id:'test-android.apps.googleusercontent.com',android_info:{package_name:'com.hecagus.presupuesto',certificate_hash:fingerprint}}]}]});

test('Android Firebase configuration validates project, package and web OAuth client',()=>{
  assert.equal(validateGoogleServices(services()),true);
  const project=services();project.project_info.project_id='another-project';
  assert.throws(()=>validateGoogleServices(project),/otro proyecto/);
  const app=services();app.client[0].client_info.android_client_info.package_name='another.package';
  assert.throws(()=>validateGoogleServices(app),/configuración Firebase/);
  const web=services();web.client[0].oauth_client=web.client[0].oauth_client.filter(c=>c.client_type!==3);
  assert.throws(()=>validateGoogleServices(web),/OAuth web/);
});

test('Android Firebase configuration requires a matching package and SHA-1 OAuth registration',()=>{
  for(const mutate of [
    config=>{config.client[0].oauth_client=config.client[0].oauth_client.filter(c=>c.client_type!==1);},
    config=>{config.client[0].oauth_client[1].android_info.certificate_hash='invalid';},
    config=>{config.client[0].oauth_client[1].android_info.package_name='another.package';}
  ]){
    const config=services();mutate(config);
    assert.throws(()=>validateGoogleServices(config),/SHA-1/);
  }
  assert.equal(validateGoogleServices(services(),fingerprint.toLowerCase().match(/../g).join(':')),true);
  assert.throws(()=>validateGoogleServices(services(),'F'.repeat(40)),/SHA-1 de esta compilación/);
  assert.throws(()=>validateGoogleServices(services(),'not-a-fingerprint'),/SHA-1 de esta compilación/);
});

test('native Google configuration errors do not invoke authentication or expose internal errors',async()=>{
  const fail=()=>assert.fail('Authentication must not run');
  await assert.rejects(signInNativeGoogle({configured:false,plugin:{signInWithGoogle:fail},sdk:{signInWithCredential:fail}}),error=>{
    assert.equal(error.code,'sync/native-google-configuration');
    assert.match(error.message,/com\.hecagus\.presupuesto/);
    assert.match(error.message,/SHA-1/);
    assert.match(error.message,/google-services\.json/);
    return true;
  });
  for(const original of [{code:'10',message:'internal activity detail'},{message:'com.google.android.gms.common.api.ApiException: 10: internal detail'}]){
    await assert.rejects(signInNativeGoogle({configured:true,plugin:{signInWithGoogle:async()=>{throw original;}},sdk:{signInWithCredential:fail}}),error=>{
      assert.equal(error.code,'sync/native-google-configuration');
      assert.equal(error.message,GOOGLE_CONFIGURATION_MESSAGE);
      assert.doesNotMatch(error.message,/internal detail|activity detail|ApiException/);
      return true;
    });
  }
});

test('native Google preserves cancellation, connection failures and safe unknown failures',async()=>{
  for(const [original,expectedCode] of [
    [{code:'12501'},'auth/popup-closed-by-user'],
    [{message:'user canceled'},'auth/popup-closed-by-user'],
    [{message:'GetCredentialCancellationException'},'auth/popup-closed-by-user'],
    [{message:'Network request failed'},'auth/network-request-failed'],
    [{message:'ApiException: 7: network unavailable'},'auth/network-request-failed'],
    [{message:'No credentials available; internal-token-123'},'sync/native-google-unavailable']
  ]){
    await assert.rejects(signInNativeGoogle({configured:true,plugin:{signInWithGoogle:async()=>{throw original;}},sdk:{signInWithCredential:()=>assert.fail('No token exchange on failure')}}),error=>{
      assert.equal(error.code,expectedCode);
      assert.doesNotMatch(error.message,/internal-token|ApiException|No credentials/);
      return true;
    });
  }
});

test('missing Android configuration is visible on startup without SDK calls or budget mutations',async t=>{
  const dom=new JSDOM('<section id="syncCard" class="hidden"><div id="syncPanel"></div></section>',{url:'https://localhost/'});
  globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.localStorage=dom.window.localStorage;globalThis.CustomEvent=dom.window.CustomEvent;
  Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
  const fail=()=>assert.fail('Unconfigured Android must not call Firebase, Google or schedule synchronization');
  window.__hecagusNative={googleConfigured:false,googleConfigurationMessage:GOOGLE_CONFIGURATION_MESSAGE,signInWithGoogle:fail};
  Object.defineProperty(window.__hecagusNative,'firebaseModules',{get:fail});
  t.mock.method(globalThis,'setInterval',fail);
  const Data=await import('../js/02_data.js');
  Data.restaurar(JSON.stringify({profile:{onboarded:true},movimientos:[{id:'existing',tipo:'ingreso',monto:42,fecha:'2026-10-22'}],parametros:{}}));
  const state=JSON.stringify(Data.getState());
  const storage=Array.from({length:localStorage.length},(_,i)=>[localStorage.key(i),localStorage.getItem(localStorage.key(i))]);
  const Sync=await import('../js/07_sync.js?firebase-android-config-test');
  await Sync.initSync();
  assert.equal(document.getElementById('syncCard').classList.contains('hidden'),false);
  assert.equal(document.getElementById('syncStatus').textContent,GOOGLE_CONFIGURATION_MESSAGE);
  assert.equal(document.getElementById('syncStatus').dataset.tone,'error');
  assert.equal(document.getElementById('btnSyncLogin').disabled,true);
  document.getElementById('btnSyncLogin').click();
  assert.equal(JSON.stringify(Data.getState()),state);
  assert.deepEqual(Array.from({length:localStorage.length},(_,i)=>[localStorage.key(i),localStorage.getItem(localStorage.key(i))]),storage);
  dom.window.close();
});