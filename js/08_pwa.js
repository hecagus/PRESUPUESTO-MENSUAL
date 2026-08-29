/* V11 - PWA bootstrap. La UI de instalación solo aparece cuando el navegador ofrece instalación real. */
let deferredPrompt=null;

const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
const updateInstallUI=()=>{
  const card=document.getElementById('appInstallCard');
  if(!card)return;
  const shouldShow=!isStandalone()&&Boolean(deferredPrompt);
  card.classList.toggle('hidden',!shouldShow);
};

export async function initPWA(){
  updateInstallUI();
  if('serviceWorker' in navigator){
    try{await navigator.serviceWorker.register('./sw.js',{scope:'./'});}catch(e){console.warn('Service worker no disponible:',e);}
  }
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
}

export async function promptInstall(){
  if(isStandalone()) return true;
  if(!deferredPrompt) return false;
  await deferredPrompt.prompt();
  const choice=await deferredPrompt.userChoice;
  deferredPrompt=null;
  updateInstallUI();
  return choice.outcome==='accepted';
}

export const canPromptInstall=()=>Boolean(deferredPrompt);
