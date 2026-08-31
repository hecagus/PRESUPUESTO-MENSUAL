/* Captura mínima y temprana del instalador de Chromium. Debe cargarse en <head>. */
window.__hecagusInstallPrompt=window.__hecagusInstallPrompt||null;
window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  window.__hecagusInstallPrompt=event;
  document.dispatchEvent(new CustomEvent('budget:pwa-installable-early'));
});
window.addEventListener('appinstalled',()=>{window.__hecagusInstallPrompt=null;});
