/* V11 - PWA bootstrap. No bloquea la app si el navegador no soporta SW. */
let deferredPrompt=null;

export async function initPWA(){
  if('serviceWorker' in navigator){
    try{await navigator.serviceWorker.register('./sw.js',{scope:'./'});}catch(e){console.warn('Service worker no disponible:',e);}
  }
  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    deferredPrompt=event;
    document.dispatchEvent(new CustomEvent('budget:pwa-installable'));
  });
  window.addEventListener('appinstalled',()=>{deferredPrompt=null;document.dispatchEvent(new CustomEvent('budget:pwa-installed'));});
}

export async function promptInstall(){
  if(!deferredPrompt) return false;
  await deferredPrompt.prompt();
  const choice=await deferredPrompt.userChoice;
  deferredPrompt=null;
  return choice.outcome==='accepted';
}

export const canPromptInstall=()=>Boolean(deferredPrompt);
