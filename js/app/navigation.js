/* Stable routes remain the public entry points for existing installations. */
export const PRIMARY_NAV=Object.freeze([
  {key:'index',href:'index.html',icon:'⌂',label:'Inicio'},
  {key:'home',href:'home.html',icon:'▤',label:'Presupuesto'},
  {key:'admin',href:'admin.html',icon:'▶',label:'Actividad'},
  {key:'wallet',href:'wallet.html',icon:'◉',label:'Dinero'},
  {key:'more',href:'more.html',icon:'⋯',label:'Más'}
]);
export function primaryArea(page){
  if(page==='historial')return 'wallet';
  if(['settings','calendar','stats'].includes(page))return 'more';
  return page;
}
export function renderBottomNav(){
  const nav=document.querySelector('.bottom-nav');if(!nav)return;
  const area=primaryArea(document.body.dataset.page);
  nav.innerHTML=PRIMARY_NAV.map(({key,href,icon,label})=>`<a href="${href}" class="nav-link ${area===key?'active':''}"${area===key?' aria-current="page"':''}><span aria-hidden="true">${icon}</span>${label}</a>`).join('');
}
export function renderMoneyNav(){
  const nav=document.getElementById('moneyNav');if(!nav)return;
  const page=document.body.dataset.page,current=page==='historial'?'movements':(location.hash.slice(1)||'accounts');
  const links=[['accounts','wallet.html#accounts','Cuentas'],['movements','historial.html','Movimientos'],['goals','wallet.html#goals','Metas'],['debts','wallet.html#debts','Deudas']];
  nav.innerHTML=links.map(([key,href,label])=>`<a href="${href}"${key===current?' aria-current="page"':''}>${label}</a>`).join('');
}
