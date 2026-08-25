/* V10.3 - Repositorio Firestore. Datos aislados por UID. */
import { initFirebase } from '../services/firebase_service.js';

const statePath = uid => ['users', uid, 'budget', 'state'];
export const CloudRepository = {
  async load(uid) {
    const ctx=await initFirebase(); if(!ctx.enabled) throw new Error(ctx.reason);
    const snap=await ctx.firestoreMod.getDoc(ctx.firestoreMod.doc(ctx.db,...statePath(uid)));
    return snap.exists() ? snap.data() : null;
  },
  async save(uid,state,meta={}) {
    const ctx=await initFirebase(); if(!ctx.enabled) throw new Error(ctx.reason);
    const payload={...structuredClone(state),_sync:{updatedAt:Date.now(),...meta}};
    await ctx.firestoreMod.setDoc(ctx.firestoreMod.doc(ctx.db,...statePath(uid)),payload);
    return payload;
  }
};
