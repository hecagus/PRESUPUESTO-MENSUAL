/* v3.1.0 - PWA estable: readiness verificable, prompt real y cero bucles de instalación. */
let deferredPrompt=window.__hecagusInstallPrompt||null;
let listenersBound=false;
let registrationPromise=window.__hecagusSWRegistrationPromise||null;
let readiness={checked:false,secure:window.isSecureContext,manifest:false,icons:false,serviceWorker:false,error:null};
let readinessPromise=null;

export const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
export const canPromptInstall=()=>Boolean(deferredPrompt||window.__hecagusInstallPrompt);
export const pwaReadiness=()=>({...readiness,installPrompt:canPromptInstall(),standalone:isStandalone()});

function baseHint(){
  if(!window.isSecureContext)return 'La instalación requiere una conexión segura HTTPS.';
  if(!('serviceWorker' in navigator))return 'Este navegador no admite Service Workers para esta aplicación.';
  if(window.__hecagusSWError)return 'No se pudo preparar el modo offline. Recarga la página para volver a intentarlo.';
  if(readiness.checked&&!readiness.manifest)return 'El manifiesto de instalación no pudo validarse. Recarga la página; si continúa, hay un problema de despliegue.';
  if(readiness.checked&&!readiness.icons)return 'Los iconos requeridos por la instalación no pudieron validarse.';
  if(readiness.checked&&!readiness.serviceWorker)return 'El modo offline todavía no quedó activo. Recarga una vez para terminar de activarlo.';
  const ua=navigator.userAgent||'';
  if(/iphone|ipad|ipod/i.test(ua))return 'En Safari usa Compartir → Agregar a pantalla de inicio.';
  if(readiness.checked&&readiness.manifest&&readiness.icons&&readiness.serviceWorker){
    if(/android/i.test(ua))return '✅ Modo app validado. Chrome aún no ofrece el instalador; cuando lo habilite aparecerá el botón y también puede mostrar “Instalar aplicación” en ⋮.';
    return '✅ Modo app validado. El botón aparecerá cuando el navegador habilite la instalación.';
  }
  return 'Validando manifiesto, iconos y modo offline…';
}

export const installationHelp=()=>baseHint();

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
  if(button){button.textContent='Instalar app';button.disabled=!ready;button.classList.toggle('hidden',!ready);}
  if(status)status.textContent=ready?'✅ Chrome habilitó la instalación.':baseHint();
}

async function fetchOk(url){try{const response=await fetch(url,{cache:'no-store'});return response.ok;}catch{return false;}}
async function checkReadiness(){
  if(readinessPromise)return readinessPromise;
  readinessPromise=(async()=>{
    const next={checked:true,secure:window.isSecureContext,manifest:false,icons:false,serviceWorker:false,error:null};
    try{
      if(next.secure){
        const manifestResponse=await fetch('/manifest.webmanifest',{cache:'no-store'});
        if(manifestResponse.ok){
          const manifest=await manifestResponse.json(),icons=Array.isArray(manifest.icons)?manifest.icons:[];
          next.manifest=Boolean(manifest.name&&manifest.start_url&&manifest.scope&&manifest.display&&icons.some(x=>x.sizes==='192x192')&&icons.some(x=>x.sizes==='512x512'));
          if(next.manifest){const required=icons.filter(x=>['192x192','512x512'].includes(x.sizes)).map(x=>x.src);next.icons=(await Promise.all(required.map(fetchOk))).every(Boolean);}
        }
        if('serviceWorker' in navigator){
          const registration=await (registrationPromise||window.__hecagusSWRegistrationPromise||navigator.serviceWorker.ready);
          next.serviceWorker=Boolean(registration?.active||navigator.serviceWorker.controller);
        }
      }
    }catch(error){next.error=String(error?.message||error);}
    readiness=next;window.__hecagusPwaReadiness=pwaReadiness();updateInstallUI();return pwaReadiness();
  })();
  return readinessPromise;
}

function capturePrompt(event){
  event.preventDefault?.();deferredPrompt=event;window.__hecagusInstallPrompt=event;updateInstallUI();
  document.dispatchEvent(new CustomEvent('budget:pwa-installable'));
}

function bindLifecycle(){
  if(listenersBound)return;listenersBound=true;
  window.addEventListener('beforeinstallprompt',capturePrompt);
  document.addEventListener('budget:pwa-installable-early',()=>{if(window.__hecagusInstallPrompt){deferredPrompt=window.__hecagusInstallPrompt;updateInstallUI();}});
  document.addEventListener('budget:pwa-sw-ready',()=>{readinessPromise=null;checkReadiness();});
  document.addEventListener('budget:pwa-sw-error',()=>{readinessPromise=null;checkReadiness();});
  window.addEventListener('appinstalled',()=>{deferredPrompt=null;window.__hecagusInstallPrompt=null;updateInstallUI();});
  document.addEventListener('budget:pwa-installed-early',()=>{deferredPrompt=null;updateInstallUI();});
  navigator.serviceWorker?.addEventListener?.('controllerchange',()=>{readinessPromise=null;checkReadiness();});
  window.matchMedia('(display-mode: standalone)').addEventListener?.('change',updateInstallUI);
  document.addEventListener('DOMContentLoaded',()=>{updateInstallUI();checkReadiness();},{once:true});
}

export function initPWA(){
  bindLifecycle();updateInstallUI();
  if(!registrationPromise&&'serviceWorker' in navigator){
    registrationPromise=navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'})
      .then(async reg=>{try{await reg.update();await navigator.serviceWorker.ready;}catch{}readinessPromise=null;await checkReadiness();return reg;})
      .catch(error=>{window.__hecagusSWError=error;console.warn('Service worker no disponible:',error);readinessPromise=null;checkReadiness();return null;});
    window.__hecagusSWRegistrationPromise=registrationPromise;
  }else if(registrationPromise)registrationPromise.finally(()=>{readinessPromise=null;checkReadiness();});
  return registrationPromise||Promise.resolve(null);
}

export async function promptInstall(){
  if(isStandalone())return true;
  if(!deferredPrompt&&window.__hecagusInstallPrompt)deferredPrompt=window.__hecagusInstallPrompt;
  if(!deferredPrompt){updateInstallUI();return false;}
  const prompt=deferredPrompt;deferredPrompt=null;window.__hecagusInstallPrompt=null;
  try{await prompt.prompt();const choice=await prompt.userChoice;updateInstallUI();return choice.outcome==='accepted';}
  catch(error){console.warn('No se pudo abrir el instalador PWA:',error);updateInstallUI();return false;}
}