import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {signInNativeGoogle} from '../native/signin.js';

test('native Google identity goes through existing Firebase JS auth, with no browser popup',async()=>{
  let calls=0;
  const session={},credential={providerId:'google.com'},user={uid:'same-user'};
  const result=await signInNativeGoogle({configured:true,session,plugin:{signInWithGoogle:async options=>{assert.deepEqual(options,{skipNativeAuth:true});return {credential:{idToken:'native-token'}};}},sdk:{GoogleAuthProvider:{credential:token=>{assert.equal(token,'native-token');return credential;}},signInWithCredential:async(a,b)=>{assert.equal(a,session);assert.equal(b,credential);calls++;return {user};}}});
  assert.equal(result.user,user);assert.equal(calls,1);
});
test('missing Android Firebase configuration never opens a browser or mutates auth',async()=>{
  const fail=()=>assert.fail('No auth operation should run');
  await assert.rejects(signInNativeGoogle({configured:false,plugin:{signInWithGoogle:fail},sdk:{signInWithCredential:fail}}),/configuración Android de Firebase/);
  await assert.rejects(signInNativeGoogle({configured:true,plugin:{signInWithGoogle:async()=>({})},sdk:{signInWithCredential:fail}}),/credencial válida/);
});
test('Android packages local screens and assets instead of loading a remote server URL',async()=>{
  const config=JSON.parse(await readFile(new URL('../capacitor.config.json',import.meta.url),'utf8'));
  assert.equal(config.webDir,'www');assert.equal(config.server.url,undefined);
  assert.equal(config.appId,'com.hecagus.presupuesto');
  const vars=await readFile(new URL('../android/variables.gradle',import.meta.url),'utf8');
  assert.match(vars,/minSdkVersion = 29/);
  const files=await readdir(new URL('../',import.meta.url));
  assert.ok(files.includes('offline.html'));
});
