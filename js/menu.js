const btn = document.querySelector('.menu-toggle');
const menu = document.querySelector('.nav-menu');

btn?.addEventListener('click', () => {
  menu.classList.toggle('active');
});
