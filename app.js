const views = [...document.querySelectorAll('.view')];
const navLinks = [...document.querySelectorAll('[data-view]')];
const searchInput = document.querySelector('#resource-search');
const overlaySearch = document.querySelector('#overlay-search');
const searchOverlay = document.querySelector('.search-overlay');

function showView(name) {
  const target = document.querySelector(`#${name}`);
  if (!target) return;
  views.forEach((view) => {
    const active = view === target;
    view.hidden = !active;
    view.classList.toggle('is-visible', active);
  });
  navLinks.forEach((link) => link.classList.toggle('is-active', link.dataset.view === name));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('[data-view]').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    showView(link.dataset.view);
    history.replaceState(null, '', `#${link.dataset.view}`);
  });
});

document.querySelectorAll('[data-scroll]').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    showView('home');
    history.replaceState(null, '', '#tutoriales');
    requestAnimationFrame(() => document.querySelector('#tutoriales').scrollIntoView({ behavior: 'smooth' }));
  });
});

function filterResources(value) {
  const query = value.trim().toLocaleLowerCase('es');
  const cards = [...document.querySelectorAll('.resource-card')];
  let count = 0;
  cards.forEach((card) => {
    const matches = !query || `${card.dataset.search} ${card.textContent}`.toLocaleLowerCase('es').includes(query);
    card.hidden = !matches;
    if (matches) count += 1;
  });
  document.querySelector('.empty-search').hidden = count > 0;
}

searchInput.addEventListener('input', () => filterResources(searchInput.value));
overlaySearch.addEventListener('input', () => {
  showView('home');
  searchInput.value = overlaySearch.value;
  filterResources(overlaySearch.value);
});

document.querySelector('.search-toggle').addEventListener('click', () => {
  searchOverlay.hidden = false;
  overlaySearch.focus();
});
document.querySelector('.close-search').addEventListener('click', () => {
  searchOverlay.hidden = true;
  overlaySearch.value = '';
  overlaySearch.blur();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') searchOverlay.hidden = true;
});

const initialView = location.hash === '#info' ? 'info' : 'home';
showView(initialView);
