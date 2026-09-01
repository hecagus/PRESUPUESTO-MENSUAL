/* v3.0.0 - Arranque PWA mínimo. Se ejecuta en <head> antes del motor de la app. */
window.__hecagusInstallPrompt=window.__hecagusInstallPrompt||null;
window.__hecagusSWError=null;

window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  window.__hecagusInstallPrompt=event;
  document.dispatchEvent(new CustomEvent('budget:pwa-installable-early'));
});
window.addEventListener('appinstalled',()=>{
  window.__hecagusInstallPrompt=null;
  document.dispatchEvent(new CustomEvent('budget:pwa-installed-early'));
});

if('serviceWorker' in navigator&&!window.__hecagusSWRegistrationPromise){
  window.__hecagusSWRegistrationPromise=navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'})
    .then(async registration=>{
      try{await registration.update();}catch{}
      try{await navigator.serviceWorker.ready;}catch{}
      document.dispatchEvent(new CustomEvent('budget:pwa-sw-ready'));
      return registration;
    })
    .catch(error=>{
      window.__hecagusSWError=error;
      console.warn('No se pudo registrar el service worker:',error);
      document.dispatchEvent(new CustomEvent('budget:pwa-sw-error',{detail:{message:String(error?.message||error)}}));
      return null;
    });
}
