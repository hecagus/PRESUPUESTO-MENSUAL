/* V10.2 - Firebase bootstrap + Auth. Configurar firebaseConfig antes de activar. */
const FIREBASE_CONFIG = globalThis.PRESUPUESTO_FIREBASE_CONFIG || null;
let app = null, auth = null, db = null;

export async function initFirebase() {
  if (!FIREBASE_CONFIG) return { enabled:false, reason:'FIREBASE_CONFIG_MISSING' };
  const [{ initializeApp }, authMod, firestoreMod] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js')
  ]);
  app ||= initializeApp(FIREBASE_CONFIG);
  auth ||= authMod.getAuth(app);
  db ||= firestoreMod.getFirestore(app);
  return { enabled:true, app, auth, db, authMod, firestoreMod };
}

export async function loginGoogle() {
  const ctx = await initFirebase();
  if (!ctx.enabled) throw new Error(ctx.reason);
  return ctx.authMod.signInWithPopup(ctx.auth, new ctx.authMod.GoogleAuthProvider());
}
export async function logout() { const ctx=await initFirebase(); if(ctx.enabled) await ctx.authMod.signOut(ctx.auth); }
export async function currentUser() { const ctx=await initFirebase(); return ctx.enabled ? ctx.auth.currentUser : null; }
