/* v2.9.0 - PWA: captura temprana, registro raíz e instalación sin alertas engañosas. */
let deferredPrompt=window.__hecagusInstallPrompt||null;
let listenersBound=false;
let registrationPromise=null;

export const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
const installHint=()=>{
  const ua=navigator.userAgent||'';
  if(/android/i.test(ua))return 'Chrome aún no entregó el instalador nativo. Abre ⋮ y busca “Instalar aplicación” o “Agregar a pantalla principal”. Si no aparece, recarga Panel una vez y vuelve a intentarlo.';
  if(/iphone|ipad|ipod/i.test(ua))return 'En Safari toca Compartir y después “Agregar a pantalla de inicio”.';
  return 'El navegador todavía no ofrece el instalador. También puedes instalarla desde su menú cuando aparezca “Instalar aplicación”.';
};

export function updateInstallUI(){
  if(!deferredPrompt&&window.__hecagusInstallPrompt)deferredPrompt=window.__hecagusInstallPrompt;
  const card=document.getElementById('appInstallCard'),button=document.getElementById('btnInstallApp'),status=document.getElementById('installStatus');
  if(!card)return;
  if(isStandalone()){
    card.classList.add('hidden');
    return;
  }
  card.classList.remove('hidden');
  if(button){button.textContent=deferredPrompt?'Instalar ahora':'Comprobar instalación';button.disabled=false;}
  if(status)status.textContent=deferredPrompt?'✅ Chrome ya permite instalar La app del HecAgus.':installHint();
}

function bindLifecycle(){
  if(listenersBound)return;listenersBound=true;
  const capture=event=>{
    event.preventDefault?.();
    deferredPrompt=event;
    window.__hecagusInstallPrompt=event;
    updateInstallUI();
    document.dispatchEvent(new CustomEvent('budget:pwa-installable'));
  };
  window.addEventListener('beforeinstallprompt',capture);
  document.addEventListener('budget:pwa-installable-early',()=>{if(window.__hecagusInstallPrompt){deferredPrompt=window.__hecagusInstallPrompt;updateInstallUI();}});
  window.addEventListener('appinstalled',()=>{
    deferredPrompt=null;window.__hecagusInstallPrompt=null;
    updateInstallUI();
    document.dispatchEvent(new CustomEvent('budget:pwa-installed'));
  });
  window.matchMedia('(display-mode: standalone)').addEventListener?.('change',updateInstallUI);
  document.addEventListener('DOMContentLoaded',updateInstallUI,{once:true});
}

export function initPWA(){
  bindLifecycle();
  updateInstallUI();
  if(!registrationPromise&&'serviceWorker' in navigator){
    registrationPromise=navigator.serviceWorker.register('/sw.js',{scope:'/'})
      .then(async reg=>{try{await navigator.serviceWorker.ready;}catch{}updateInstallUI();return reg;})
      .catch(e=>{console.warn('Service worker no disponible:',e);updateInstallUI();return null;});
  }
  return registrationPromise||Promise.resolve(null);
}

export async function promptInstall(){
  if(isStandalone())return true;
  if(!deferredPrompt&&window.__hecagusInstallPrompt)deferredPrompt=window.__hecagusInstallPrompt;
  if(!deferredPrompt){await initPWA();updateInstallUI();return false;}
  const prompt=deferredPrompt;
  deferredPrompt=null;window.__hecagusInstallPrompt=null;
  try{
    await prompt.prompt();
    const choice=await prompt.userChoice;
    if(choice.outcome!=='accepted')window.__hecagusInstallPrompt=null;
    updateInstallUI();
    return choice.outcome==='accepted';
  }catch(e){
    console.warn('No se pudo abrir el instalador PWA:',e);
    updateInstallUI();
    return false;
  }
}

export const canPromptInstall=()=>Boolean(deferredPrompt||window.__hecagusInstallPrompt);
export const installationHelp=()=>installHint();
