import {before,after,beforeEach,test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,deleteDoc} from 'firebase/firestore';
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-hecagus-audit',firestore:{rules:await readFile(new URL('../../firestore.rules',import.meta.url),'utf8')}});});
beforeEach(async()=>{await env.clearFirestore();});
after(async()=>{await env?.cleanup();});
const ref=(context,path='users/alice/budget/state')=>doc(context.firestore(),path);
const payload={state:{movimientos:[]},revision:1};
test('owner may read, write and delete their budget',async()=>{
  const own=env.authenticatedContext('alice');
  await assertSucceeds(setDoc(ref(own),payload));await assertSucceeds(getDoc(ref(own)));await assertSucceeds(deleteDoc(ref(own)));
});
test('another authenticated user cannot read, overwrite or delete the budget',async()=>{
  const owner=env.authenticatedContext('alice'),other=env.authenticatedContext('bob');await assertSucceeds(setDoc(ref(owner),payload));
  await assertFails(getDoc(ref(other)));await assertFails(setDoc(ref(other),payload));await assertFails(deleteDoc(ref(other)));
});
test('anonymous requests and documents outside the budget namespace are denied',async()=>{
  const anonymous=env.unauthenticatedContext(),own=env.authenticatedContext('alice');
  await assertFails(getDoc(ref(anonymous)));await assertFails(setDoc(ref(anonymous),payload));
  for(const path of ['users/alice/profile/private','users/alice','unprotected/data']){
    await assertFails(getDoc(ref(own,path)));await assertFails(setDoc(ref(own,path),payload));
  }
});
