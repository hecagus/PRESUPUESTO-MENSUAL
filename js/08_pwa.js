/* v3.0.0 - PWA estable: estado real, prompt sólo cuando Chromium lo permite y sin bucles de alertas. */
let deferredPrompt=window.__hecagusInstallPrompt||null;
let listenersBound=false;
let registrationPromise=window.__hecagusSWRegistrationPromise||null;

export const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
export const canPromptInstall=()=>Boolean(deferredPrompt||window.__hecagusInstallPrompt);

function installHint(){
  if(!window.isSecureContext)return 'La instalación requiere una conexión segura HTTPS.';
  if(!('serviceWorker' in navigator))return 'Este navegador no admite la instalación offline de esta aplicación.';
  if(window.__hecagusSWError)return 'No se pudo preparar el modo offline. Recarga la página para volver a intentarlo.';
  const ua=navigator.userAgent||'';
  if(/iphone|ipad|ipod/i.test(ua))return 'En Safari usa Compartir → Agregar a pantalla de inicio.';
  if(/android/i.test(ua))return 'La app ya está preparada. Si Chrome habilita el instalador, aparecerá aquí automáticamente; también puede ofrecer “Instalar aplicación” desde ⋮.';
  return 'La app ya está preparada. El botón aparecerá cuando el navegador habilite la instalación.';
}

export const installationHelp=()=>installHint();

export function updateInstallUI(){
  if(!deferredPrompt&&window.__hecagusInstallPrompt)deferredPrompt=window.__hecagusInstallPrompt;
  const card=document.getElementById('appInstallCard'),button=document.getElementById('btnInstallApp'),status=document.getElementById('installStatus');
  if(!card)return;
  if(isStandalone()){
    card.classList.add('hidden');
    if(button)button.classList.add('hidden');
    return;
  }
  card.classList.remove('hidden');
  const ready=canPromptInstall();
  if(button){
    button.textContent='Instalar app';
    button.disabled=!ready;
    button.classList.toggle('hidden',!ready);
  }
  if(status)status.textContent=ready?'✅ Lista para instalar.':installHint();
}

function capturePrompt(event){
  event.preventDefault?.();
  deferredPrompt=event;
  window.__hecagusInstallPrompt=event;
  updateInstallUI();
  document.dispatchEvent(new CustomEvent('budget:pwa-installable'));
}

function bindLifecycle(){
  if(listenersBound)return;listenersBound=true;
  window.addEventListener('beforeinstallprompt',capturePrompt);
  document.addEventListener('budget:pwa-installable-early',()=>{if(window.__hecagusInstallPrompt){deferredPrompt=window.__hecagusInstallPrompt;updateInstallUI();}});
  document.addEventListener('budget:pwa-sw-ready',updateInstallUI);
  document.addEventListener('budget:pwa-sw-error',updateInstallUI);
  window.addEventListener('appinstalled',()=>{deferredPrompt=null;window.__hecagusInstallPrompt=null;updateInstallUI();});
  document.addEventListener('budget:pwa-installed-early',()=>{deferredPrompt=null;updateInstallUI();});
  navigator.serviceWorker?.addEventListener?.('controllerchange',updateInstallUI);
  window.matchMedia('(display-mode: standalone)').addEventListener?.('change',updateInstallUI);
  document.addEventListener('DOMContentLoaded',updateInstallUI,{once:true});
}

export function initPWA(){
  bindLifecycle();updateInstallUI();
  if(!registrationPromise&&'serviceWorker' in navigator){
    registrationPromise=navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'})
      .then(async reg=>{try{await reg.update();await navigator.serviceWorker.ready;}catch{}updateInstallUI();return reg;})
      .catch(error=>{window.__hecagusSWError=error;console.warn('Service worker no disponible:',error);updateInstallUI();return null;});
    window.__hecagusSWRegistrationPromise=registrationPromise;
  }
  return registrationPromise||Promise.resolve(null);
}

export async function promptInstall(){
  if(isStandalone())return true;
  if(!deferredPrompt&&window.__hecagusInstallPrompt)deferredPrompt=window.__hecagusInstallPrompt;
  if(!deferredPrompt){updateInstallUI();return false;}
  const prompt=deferredPrompt;deferredPrompt=null;window.__hecagusInstallPrompt=null;
  try{
    await prompt.prompt();
    const choice=await prompt.userChoice;
    updateInstallUI();
    return choice.outcome==='accepted';
  }catch(error){
    console.warn('No se pudo abrir el instalador PWA:',error);updateInstallUI();return false;
  }
}
