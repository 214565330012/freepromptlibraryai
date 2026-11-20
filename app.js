const $ = (selector) => document.querySelector(selector);

const PAGE_SIZE = 18;
const PAGE_BUTTON_WINDOW = 6;
let currentPage = 1;
let activeFilter = 'All';
let appliedSearchTerm = '';
let activeSpecialFilter = 'All';

const palettes = {
  Photo:['#f4a6bc','#8b5cc4'],Portrait:['#d7a0ce','#6459c7'],Traditional:['#d8a15a','#b44c72'],
  Couple:['#ef9ab1','#7551aa'],Wedding:['#f3b69c','#9069bb'],Festival:['#efa74d','#c34f68'],
  Family:['#88b6d6','#7b69b8'],Fashion:['#d58db3','#5553a9'],Cinematic:['#6e85cb','#414b83'],
  Logo:['#6a8ee5','#744bb2'],'3D Art':['#9e82e8','#e18db9'],Video:['#6a8ce5','#6c58ad'],
  Nature:['#70b9a1','#4b7f9d'],Product:['#74a4ce','#7a6cae'],Travel:['#83b9d1','#6479b3'],
  YouTube:['#e67d84','#8d4e9e'],Sports:['#82a7cc','#5558a6'],Birthday:['#f0a0a7','#8660bf'],
  Background:['#8a80cf','#d78eac'],'Photo to Video':['#688fce','#7e65b1'],Dance:['#e398c1','#7857a8'],
  Social:['#83a7db','#6f58aa'],Automotive:['#667eab','#5b4a8b']
};

function palette(prompt) {
  return palettes[prompt.category] || palettes[prompt.type] || ['#8d82d5','#c58bb5'];
}

function renderCard(prompt, newTag = false) {
  const colors = palette(prompt);
  const headline = prompt.category === 'Couple' ? 'COUPLE'
    : prompt.category === 'Wedding' ? 'WEDDING'
    : prompt.category === 'Festival' ? 'FESTIVAL'
    : prompt.type === 'Video' ? 'VIDEO'
    : String(prompt.category || prompt.type).toUpperCase();

  const detailUrl = `prompt.html?id=${encodeURIComponent(prompt.id)}`;
  return `<a class="prompt-card" href="${detailUrl}" aria-label="Open ${prompt.title} prompt">
    <div class="card-image" style="--a:${colors[0]};--b:${colors[1]}">
      ${newTag ? '<span class="new-tag">NEW</span>' : ''}
      <div class="card-art"><b>${headline}</b><span>${prompt.type === 'Video' ? 'VIDEO PROMPT' : 'AI PHOTO PROMPT'}</span></div>
    </div>
    <div class="card-body">
      <h3>${prompt.title}</h3>
      <p>${prompt.prompt_en.slice(0,175)}${prompt.prompt_en.length > 175 ? '…' : ''}</p>
      <span class="get-prompt">Get Prompts →</span>
    </div>
  </a>`;
}

function matchesSpecialFilter(prompt) {
  if (activeSpecialFilter === 'celebration') {
    const text = `${prompt.title} ${prompt.title_hi || ''} ${prompt.category || ''} ${prompt.prompt_en || ''}`.toLowerCase();
    return /(birthday|wedding|festival|engagement|mehendi|diwali|garba|celebration)/.test(text);
  }
  return true;
}

function getFilteredPrompts() {
  const query = appliedSearchTerm.toLowerCase().trim();
  return PROMPTS.filter((prompt) => {
    const typeMatches = activeFilter === 'All' || prompt.type === activeFilter;
    const specialMatches = matchesSpecialFilter(prompt);
    const haystack = [prompt.title, prompt.title_hi, prompt.category, prompt.type, prompt.prompt_en, prompt.prompt_hi]
      .filter(Boolean).join(' ').toLowerCase();
    const searchMatches = !query || haystack.includes(query);
    return typeMatches && specialMatches && searchMatches;
  });
}

function renderPagination(totalPages) {
  const pagination = $('#pagination');
  if (!pagination) return;
  if (totalPages <= 1) {
    pagination.innerHTML = '';
    pagination.hidden = true;
    return;
  }

  pagination.hidden = false;
  const halfWindow = Math.floor(PAGE_BUTTON_WINDOW / 2);
  let startPage = Math.max(1, currentPage - halfWindow);
  let endPage = Math.min(totalPages, startPage + PAGE_BUTTON_WINDOW - 1);
  startPage = Math.max(1, endPage - PAGE_BUTTON_WINDOW + 1);

  let buttons = '';
  if (currentPage > 1) {
    buttons += `<button type="button" class="page-nav" data-page="${currentPage - 1}" aria-label="Previous page">‹ Previous</button>`;
  }
  for (let page = startPage; page <= endPage; page += 1) {
    buttons += `<button type="button" class="page-number${page === currentPage ? ' active' : ''}" data-page="${page}"${page === currentPage ? ' aria-current="page"' : ''}>${page}</button>`;
  }
  if (currentPage < totalPages) {
    buttons += `<button type="button" class="page-nav" data-page="${currentPage + 1}" aria-label="Next page">Next ›</button>`;
  }
  pagination.innerHTML = buttons;
}

function render() {
  const filtered = getFilteredPrompts();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  currentPage = Math.min(currentPage, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pagePrompts = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  $('#latestGrid').innerHTML = pagePrompts.map((prompt) => renderCard(prompt, true)).join('');
  $('#noResults').hidden = filtered.length !== 0;
  renderPagination(totalPages);

  $('#photoGrid').innerHTML = PROMPTS.filter((prompt) => prompt.type === 'Photo').slice(0,3).map((prompt) => renderCard(prompt)).join('');
  $('#videoGrid').innerHTML = PROMPTS.filter((prompt) => prompt.type === 'Video').slice(0,3).map((prompt) => renderCard(prompt)).join('');
}

// Search is intentionally applied only on form submission (Search button or Enter).
$('#searchForm').addEventListener('submit', (event) => {
  event.preventDefault();
  appliedSearchTerm = $('#searchInput').value.trim();
  activeFilter = 'All';
  activeSpecialFilter = 'All';
  currentPage = 1;
  render();
  $('#latest').scrollIntoView({behavior:'smooth', block:'start'});
});

// Pagination uses event delegation because its buttons are regenerated on every render.
$('#pagination').addEventListener('click', (event) => {
  const button = event.target.closest('[data-page]');
  if (!button) return;
  const page = Number(button.dataset.page);
  if (!Number.isInteger(page) || page < 1) return;
  currentPage = page;
  render();
  $('#latest').scrollIntoView({behavior:'smooth', block:'start'});
});

// Trending cards open the corresponding prompt collection below.
document.querySelectorAll('[data-trend-action]').forEach((card) => {
  card.addEventListener('click', (event) => {
    event.preventDefault();
    const action = card.dataset.trendAction;
    appliedSearchTerm = '';
    $('#searchInput').value = '';
    activeSpecialFilter = 'All';
    activeFilter = 'All';
    if (action === 'video') activeFilter = 'Video';
    if (action === 'celebration') activeSpecialFilter = 'celebration';
    currentPage = 1;
    render();
    $('#latest').scrollIntoView({behavior:'smooth', block:'start'});
  });
});

const categories = ['Photo Editing','Gemini Photo','Couple','Wedding','Saree','Birthday','Festival','3D Cartoon','Video Generation','Photo to Video','Cinematic','YouTube Thumbnail','Family','Fashion','Travel','Nature','Product','Dance','Logo','Sports','Background'];
$('#categoryList').innerHTML = categories.map((category) => `<a class="category-link" href="#latest" data-cat="${category}">${category}</a>`).join('');

document.querySelectorAll('[data-cat]').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    const category = link.dataset.cat;
    $('#searchInput').value = category;
    appliedSearchTerm = category.toLowerCase();
    activeFilter = category.toLowerCase().includes('video') ? 'Video' : 'All';
    activeSpecialFilter = 'All';
    currentPage = 1;
    render();
    $('#latest').scrollIntoView({behavior:'smooth', block:'start'});
  });
});

$('#mobileMenu').addEventListener('click', () => $('#nav').classList.toggle('open'));
$('#year').textContent = new Date().getFullYear();
render();
