/* Other pages offer an actionable notice; the full sync controls live in Settings. */
export function setSyncNotice(message){
  let notice=document.getElementById('syncNotice');
  if(!message){notice?.remove();return;}
  const main=document.querySelector('main');if(!main)return;
  if(!notice){
    notice=document.createElement('aside');notice.id='syncNotice';notice.className='card sync-notice';notice.setAttribute('role','status');main.prepend(notice);
  }
  const text=document.createElement('p');text.textContent=message;
  const link=document.createElement('a');link.href='settings.html#syncCard';link.textContent='Revisar sincronización';notice.replaceChildren(text,link);
}
