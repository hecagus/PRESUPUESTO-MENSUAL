/* v2.7.1 - PWA robusta: captura temprana del prompt, fallback e inicialización idempotente. */
let deferredPrompt=null;
let listenersBound=false;
let registrationPromise=null;

const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
const installHint=()=>{
  const ua=navigator.userAgent||'';
  if(/android/i.test(ua))return 'Si el botón nativo aún no está disponible, abre el menú ⋮ de Chrome y elige “Instalar aplicación” o “Agregar a pantalla principal”.';
  if(/iphone|ipad|ipod/i.test(ua))return 'En Safari toca Compartir y después “Agregar a pantalla de inicio”.';
  return 'También puedes instalarla desde el menú del navegador cuando aparezca la opción “Instalar aplicación”.';
};

export function updateInstallUI(){
  const card=document.getElementById('appInstallCard'),button=document.getElementById('btnInstallApp'),status=document.getElementById('installStatus');
  if(!card)return;
  if(isStandalone()){
    card.classList.add('hidden');
    return;
  }
  card.classList.remove('hidden');
  if(button)button.textContent=deferredPrompt?'Instalar app':'Cómo instalar';
  if(status)status.textContent=deferredPrompt?'Tu navegador ya permite instalar La app del HecAgus.':installHint();
}

function bindLifecycle(){
  if(listenersBound)return;listenersBound=true;
  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    deferredPrompt=event;
    updateInstallUI();
    document.dispatchEvent(new CustomEvent('budget:pwa-installable'));
  });
  window.addEventListener('appinstalled',()=>{
    deferredPrompt=null;
    updateInstallUI();
    document.dispatchEvent(new CustomEvent('budget:pwa-installed'));
  });
  window.matchMedia('(display-mode: standalone)').addEventListener?.('change',updateInstallUI);
  document.addEventListener('DOMContentLoaded',updateInstallUI,{once:true});
}

export function initPWA(){
  /* Los listeners se conectan antes de esperar al service worker. Así no perdemos beforeinstallprompt. */
  bindLifecycle();
  updateInstallUI();
  if(!registrationPromise&&'serviceWorker' in navigator){
    registrationPromise=navigator.serviceWorker.register('./sw.js',{scope:'./'})
      .then(reg=>{updateInstallUI();return reg;})
      .catch(e=>{console.warn('Service worker no disponible:',e);updateInstallUI();return null;});
  }
  return registrationPromise||Promise.resolve(null);
}

export async function promptInstall(){
  if(isStandalone())return true;
  if(!deferredPrompt){updateInstallUI();return false;}
  const prompt=deferredPrompt;
  deferredPrompt=null;
  try{
    await prompt.prompt();
    const choice=await prompt.userChoice;
    updateInstallUI();
    return choice.outcome==='accepted';
  }catch(e){
    console.warn('No se pudo abrir el instalador PWA:',e);
    updateInstallUI();
    return false;
  }
}

export const canPromptInstall=()=>Boolean(deferredPrompt);
export const installationHelp=()=>installHint();
