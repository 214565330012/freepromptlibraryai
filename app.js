const $ = (selector) => document.querySelector(selector);

const PAGE_SIZE = 18;
const PAGE_BUTTON_WINDOW = 6;
let currentPage = 1;
let activeFilter = 'All';
let appliedSearchTerm = '';
let activeSpecialFilter = 'All';
let PROMPT_DATA = window.PROMPTS || [];
const supabaseClient = window.supabaseClient || null;

function escapeText(value) {
  return String(value ?? '').replace(/[&<>\"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;', "'":'&#39;'}[char]));
}

async function loadPromptsFromSupabase() {
  if (!supabaseClient) return;
  try {
    const { data, error } = await supabaseClient.from('prompts').select('*').eq('status', 'published').order('id', { ascending: true });
    if (error) throw error;
    PROMPT_DATA = (data || []).map((row) => ({...row, id:Number(row.id)}));
    window.PROMPTS = PROMPT_DATA;
    render();
    loadCustomHomepageSections();
  } catch (error) {
    console.warn('Could not load published prompts from Supabase; showing bundled prompts.', error);
  }
}

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
  const detailUrl = `prompt.html?id=${encodeURIComponent(prompt.id)}`;
  const displayTitle = currentSiteLanguage === 'hi' && prompt.title_hi ? prompt.title_hi : prompt.title;
  const displayPrompt = currentSiteLanguage === 'hi' && prompt.prompt_hi ? prompt.prompt_hi : (prompt.content_text || prompt.prompt_en || '');
  return `<a class="prompt-card" href="${detailUrl}" aria-label="Open ${escapeText(displayTitle)} prompt">
    <div class="card-image" style="--a:${colors[0]};--b:${colors[1]}">
      ${prompt.image_url ? `<img class="card-sample-image" src="${escapeText(prompt.image_url)}" alt="${escapeText(prompt.title)} sample" loading="lazy">` : '<span class="card-image-placeholder" aria-hidden="true">✦</span>'}
      ${newTag ? `<span class="new-tag">${siteText('newBadge')}</span>` : ''}
    </div>
    <div class="card-body">
      <h3>${escapeText(displayTitle)}</h3>
      <p>${escapeText(displayPrompt.slice(0,175))}${displayPrompt.length > 175 ? '…' : ''}</p>
      <span class="get-prompt">${siteText('getPrompt')} →</span>
    </div>
  </a>`;
}

function matchesSpecialFilter(prompt) {
  if (activeSpecialFilter === 'trending') return Boolean(prompt.is_trending);
  if (activeSpecialFilter === 'celebration') {
    const text = `${escapeText(prompt.title)} ${prompt.title_hi || ''} ${prompt.category || ''} ${prompt.prompt_en || ''}`.toLowerCase();
    return /(birthday|wedding|festival|engagement|mehendi|diwali|garba|celebration)/.test(text);
  }
  return true;
}

function getFilteredPrompts() {
  const query = appliedSearchTerm.toLowerCase().trim();
  return PROMPT_DATA.filter((prompt) => {
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
    buttons += `<button type="button" class="page-nav" data-page="${currentPage - 1}" aria-label="${siteText('previous')}">‹ ${siteText('previous')}</button>`;
  }
  for (let page = startPage; page <= endPage; page += 1) {
    buttons += `<button type="button" class="page-number${page === currentPage ? ' active' : ''}" data-page="${page}"${page === currentPage ? ' aria-current="page"' : ''}>${page}</button>`;
  }
  if (currentPage < totalPages) {
    buttons += `<button type="button" class="page-nav" data-page="${currentPage + 1}" aria-label="${siteText('next')}">${siteText('next')} ›</button>`;
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

  $('#photoGrid').innerHTML = PROMPT_DATA.filter((prompt) => prompt.type === 'Photo').slice(0,3).map((prompt) => renderCard(prompt)).join('');
  $('#videoGrid').innerHTML = PROMPT_DATA.filter((prompt) => prompt.type === 'Video').slice(0,3).map((prompt) => renderCard(prompt)).join('');
}


// Website language switch translates the interface. User-authored prompt text stays
// exactly as entered in Admin; automatic translation of arbitrary content requires
// a separate translation provider/API.
const SITE_UI = {
  en: {
    getPrompt:'Get Prompt', newBadge:'NEW', previous:'Previous', next:'Next',
    noResults:'No prompts matched your search. Try another word.',
    subtitle:'New AI Trending Photo & Video Prompts Every Day — Copy And Paste For Gemini, ChatGPT, Flow AI And Other Creative Tools.',
    search:'Search', latestTitle:'New Prompts on FreePromptLibraryAI',
    latestSubtitle:'New copy-paste prompts added regularly – celebrations, portraits, couples and creative trends.',
    photoTitle:'Free AI Photo Editing Prompts', photoSubtitle:'Explore photo editing prompts for portraits, couples, weddings and more.',
    videoTitle:'Free AI Video Prompts', videoSubtitle:'Copy video prompts for cinematic clips, reels and photo animation.',
    categoriesTitle:'Browse Prompt Categories', howTitle:'How to Use These Prompts',
    chooseTitle:'Choose a Prompt', chooseText:'Browse the latest photo or video prompt collection.',
    getTitle:'Get the Prompt', getText:'Open the prompt and review its available formats.',
    copyTitle:'Copy and Create', copyText:'Paste it into Gemini, ChatGPT or your preferred creative app.',
    footerExplore:'Explore', footerInfo:'Information', footerSupport:'Support',
    footerAbout:'About Us', footerContact:'Contact Us', footerPrivacy:'Privacy Policy',
    footerTerms:'Terms & Conditions', footerDisclaimer:'Disclaimer', footerDmca:'DMCA', followUs:'Follow Us', complaint:'Complaint / Suggestion', emailUs:'Email us',
    footerCopyright:'All rights reserved.', navLatest:'New Prompts', navPhoto:'Photo Prompts',
    navVideo:'Video Prompts', navCategories:'Categories', navStory:'AI Story Prompt',
    trendingTitle:'🔥 Trending Prompt 🔥', trendingAll:'All Trending Prompts',
    trendingSapua:'Sapua Video Prompt', trendingCelebration:'All Celebration Prompt',
    trendingSubtitle:'Birthday, Wedding, Festival, Engagement, Mehendi, All Prompts',
    categoryNames:['Photo Editing','Gemini Photo','Couple','Wedding','Saree','Birthday','Festival','3D Cartoon','Video Generation','Photo to Video','Cinematic','YouTube Thumbnail','Family','Fashion','Travel','Nature','Product','Dance','Logo','Sports','Background']
  },
  hi: {
    getPrompt:'प्रॉम्प्ट देखें', newBadge:'नया', previous:'पिछला', next:'अगला',
    noResults:'आपकी खोज से कोई प्रॉम्प्ट नहीं मिला। कोई दूसरा शब्द आज़माएँ।',
    subtitle:'हर दिन नए ट्रेंडिंग AI फोटो और वीडियो प्रॉम्प्ट — Gemini, ChatGPT और अन्य क्रिएटिव टूल्स के लिए।',
    search:'खोजें', latestTitle:'FreePromptLibraryAI पर नए प्रॉम्प्ट',
    latestSubtitle:'नए फोटो और वीडियो प्रॉम्प्ट नियमित रूप से जोड़े जाते हैं।',
    photoTitle:'मुफ़्त AI फोटो एडिटिंग प्रॉम्प्ट', photoSubtitle:'पोर्ट्रेट, कपल, शादी और अन्य फोटो प्रॉम्प्ट देखें।',
    videoTitle:'मुफ़्त AI वीडियो प्रॉम्प्ट', videoSubtitle:'सिनेमैटिक क्लिप, रील और फोटो एनिमेशन के लिए प्रॉम्प्ट कॉपी करें।',
    categoriesTitle:'प्रॉम्प्ट श्रेणियाँ', howTitle:'इन प्रॉम्प्ट का उपयोग कैसे करें',
    chooseTitle:'प्रॉम्प्ट चुनें', chooseText:'नए फोटो या वीडियो प्रॉम्प्ट देखें।',
    getTitle:'प्रॉम्प्ट खोलें', getText:'प्रॉम्प्ट खोलें और उपलब्ध फ़ॉर्मेट देखें।',
    copyTitle:'कॉपी करें और बनाएँ', copyText:'इसे Gemini, ChatGPT या अपने पसंदीदा क्रिएटिव ऐप में पेस्ट करें।',
    footerExplore:'देखें', footerInfo:'जानकारी', footerSupport:'सहायता',
    footerAbout:'हमारे बारे में', footerContact:'संपर्क करें', footerPrivacy:'गोपनीयता नीति',
    footerTerms:'नियम और शर्तें', footerDisclaimer:'अस्वीकरण', footerDmca:'DMCA', followUs:'हमें फ़ॉलो करें', complaint:'शिकायत / सुझाव', emailUs:'ईमेल करें',
    footerCopyright:'सर्वाधिकार सुरक्षित।', navLatest:'नए प्रॉम्प्ट', navPhoto:'फोटो प्रॉम्प्ट',
    navVideo:'वीडियो प्रॉम्प्ट', navCategories:'श्रेणियाँ', navStory:'AI स्टोरी प्रॉम्प्ट',
    trendingTitle:'🔥 ट्रेंडिंग प्रॉम्प्ट 🔥', trendingAll:'सभी ट्रेंडिंग प्रॉम्प्ट',
    trendingSapua:'सपुआ वीडियो प्रॉम्प्ट', trendingCelebration:'सभी समारोह प्रॉम्प्ट',
    trendingSubtitle:'जन्मदिन, शादी, त्योहार, सगाई, मेहंदी और सभी प्रॉम्प्ट',
    categoryNames:['फोटो एडिटिंग','Gemini फोटो','कपल','शादी','साड़ी','जन्मदिन','त्योहार','3D कार्टून','वीडियो जनरेशन','फोटो से वीडियो','सिनेमैटिक','YouTube थंबनेल','परिवार','फैशन','यात्रा','प्रकृति','प्रोडक्ट','डांस','लोगो','खेल','बैकग्राउंड']
  }
};
let currentSiteLanguage = 'en';
function siteText(key) {
  return SITE_UI[currentSiteLanguage]?.[key] ?? SITE_UI.en[key] ?? key;
}
function applySiteLanguage(language) {
  currentSiteLanguage = language === 'hi' ? 'hi' : 'en';
  const text = SITE_UI[currentSiteLanguage];
  const setText = (selector, value) => { const element = $(selector); if (element && value != null) element.textContent = value; };
  setText('.hero-headings h1', currentSiteLanguage === 'hi' ? 'मुफ़्त Gemini फोटो एडिटिंग प्रॉम्प्ट' : 'Free Gemini Photo Editing Prompts');
  setText('.hero-headings h2', currentSiteLanguage === 'hi' ? 'मुफ़्त Google Flow वीडियो प्रॉम्प्ट' : 'Free Google Flow Video Prompts');
  setText('.hero-subtitle', text.subtitle); setText('#searchForm button', text.search);
  setText('#latest h2', text.latestTitle); setText('#latest .section-subtitle', text.latestSubtitle);
  setText('#photo h2', text.photoTitle); setText('#photo .section-subtitle', text.photoSubtitle);
  setText('#video h2', text.videoTitle); setText('#video .section-subtitle', text.videoSubtitle);
  setText('#categories h2', text.categoriesTitle); setText('.how-section h2', text.howTitle);
  setText('#noResults', text.noResults);
  setText('.how-grid article:nth-child(1) h3', text.chooseTitle); setText('.how-grid article:nth-child(1) p', text.chooseText);
  setText('.how-grid article:nth-child(2) h3', text.getTitle); setText('.how-grid article:nth-child(2) p', text.getText);
  setText('.how-grid article:nth-child(3) h3', text.copyTitle); setText('.how-grid article:nth-child(3) p', text.copyText);
  setText('.hero-nav a:nth-child(1)', text.navLatest); setText('.hero-nav a:nth-child(2)', text.navPhoto);
  setText('.hero-nav a:nth-child(3)', text.navVideo); setText('.hero-nav a:nth-child(4)', text.navCategories);
  setText('.hero-nav a:nth-child(5)', text.navStory); setText('#trendingTitle', text.trendingTitle);
  setText('.trending-card:nth-child(1) .trending-card-title', text.trendingAll);
  setText('.trending-card:nth-child(2) .trending-card-title', text.trendingSapua);
  setText('.trending-card:nth-child(3) .trending-card-title', text.trendingCelebration);
  setText('.trending-card-subtitle', text.trendingSubtitle);
  setText('.footer-info-column h3', text.footerInfo);
  setText('.footer-support-column h3', text.footerSupport);
  setText('.footer-follow-column h3', text.followUs);
  setText('#searchComplaintLink', text.complaint);
  setText('#footerEmailLink', text.emailUs);
  const infoLinks = $('#footerInfoLinks');
  if (infoLinks) infoLinks.innerHTML = `<a href="page.html?slug=about">${escapeText(text.footerAbout)}</a><a href="page.html?slug=contact">${escapeText(text.footerContact)}</a><a href="page.html?slug=privacy">${escapeText(text.footerPrivacy)}</a><a href="page.html?slug=terms">${escapeText(text.footerTerms)}</a>`;
  const supportLinks = $('#footerSupportLinks');
  if (supportLinks) supportLinks.innerHTML = `<a href="page.html?slug=disclaimer">${escapeText(text.footerDisclaimer)}</a><a href="page.html?slug=dmca">${escapeText(text.footerDmca)}</a><a href="page.html?slug=contact#complaint">${escapeText(text.complaint)}</a><a href="page.html?slug=contact">${escapeText(text.footerContact)}</a>`;
  setText('.copyright a', currentSiteLanguage === 'hi' ? 'एडमिन' : 'Admin');
  const copyright = $('.copyright');
  if (copyright) {
    const year = $('#year')?.textContent || new Date().getFullYear();
    copyright.innerHTML = `© <span id="year">${escapeText(year)}</span> FreePromptLibraryAI. ${escapeText(text.footerCopyright)} · <a href="/admin/" style="color:inherit">Admin</a>`;
  }
  const input = $('#searchInput');
  if (input) input.placeholder = currentSiteLanguage === 'hi' ? 'कपल, साड़ी, कार्टून या त्योहार के प्रॉम्प्ट खोजें…' : 'Search Couple, Saree, Cartoon, Festival Prompts...';
  document.querySelectorAll('[data-language]').forEach((button) => {
    const active = button.dataset.language === currentSiteLanguage;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.documentElement.lang = currentSiteLanguage;
  localStorage.setItem('fpl-language', currentSiteLanguage);
  if ($('#categoryList')) {
    document.querySelectorAll('#categoryList [data-category-index]').forEach((link, index) => {
      const category = text.categoryNames[index];
      if (category) { link.textContent = category; link.dataset.cat = SITE_UI.en.categoryNames[index]; }
    });
  }
  render();
  if (window.FPL_SITE_SETTINGS) applyConfiguredSiteSettings(window.FPL_SITE_SETTINGS);
}
(function setupSiteControls() {
  const savedTheme = localStorage.getItem('fpl-theme') || 'light';
  document.documentElement.dataset.theme = savedTheme;
  const themeButton = $('#themeToggle');
  if (themeButton) {
    themeButton.textContent = savedTheme === 'dark' ? '☀' : '◐';
    themeButton.setAttribute('aria-label', savedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    themeButton.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('fpl-theme', next);
      themeButton.textContent = next === 'dark' ? '☀' : '◐';
      themeButton.setAttribute('aria-label', next === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    });
  }
  applySiteLanguage(localStorage.getItem('fpl-language') || 'en');
  document.querySelectorAll('[data-language]').forEach((button) => button.addEventListener('click', () => applySiteLanguage(button.dataset.language)));
})();

function getVisitorId(){
  try { let id=localStorage.getItem('fpl-visitor-id'); if(!id){id=crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;localStorage.setItem('fpl-visitor-id',id);} return id; }
  catch { const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;return [...bytes].map((b,i)=>`${[4,6,8,10].includes(i)?'-':''}${b.toString(16).padStart(2,'0')}`).join(''); }
}
function trackPageView(promptId=null){
  if(!supabaseClient) return;
  supabaseClient.from('page_views').insert({page_path:location.pathname, prompt_id:promptId, visitor_id:getVisitorId()})
    .then(({error})=>{if(error) console.debug('Page view analytics is not enabled yet.',error.message);})
    .catch(()=>{});
}
trackPageView(null);

async function loadCustomHomepageSections(){
  if(!supabaseClient) return;
  document.querySelectorAll('.custom-home-section').forEach(node=>node.remove());
  try{
    const {data,error}=await supabaseClient.from('homepage_sections').select('*').eq('is_published',true).order('placement',{ascending:true}).order('sort_order',{ascending:true}).order('id',{ascending:true});
    if(error) throw error;
    const anchors={after_trending:document.querySelector('#trending'),after_latest:document.querySelector('#latest'),after_photo:document.querySelector('#photo'),after_video:document.querySelector('#video'),after_categories:document.querySelector('#categories'),after_howto:document.querySelector('.how-section')};
    const lastByPlacement=new Map();
    (data||[]).forEach(section=>{
      const anchor=lastByPlacement.get(section.placement)||anchors[section.placement];
      if(!anchor) return;
      const node=document.createElement('section');
      node.className=`custom-home-section custom-home-${section.section_type||'info'}`;
      node.innerHTML=`<h2>${escapeText(section.title||'')}</h2>${section.description?`<p class="section-subtitle">${escapeText(section.description)}</p>`:''}`;
      if(section.section_type==='cards'){
        const grid=document.createElement('div');grid.className='cards-grid custom-home-card-grid';
        (Array.isArray(section.items)?section.items:[]).forEach(item=>{
          const card=document.createElement('a');card.className='prompt-card custom-home-card';
          card.href=item.prompt_id?`prompt.html?id=${encodeURIComponent(item.prompt_id)}`:'#latest';
          const image=document.createElement('div');image.className='card-image custom-home-card-image';
          if(item.image_url){const img=document.createElement('img');img.src=item.image_url;img.alt=item.title||'Collection image';img.loading='lazy';image.appendChild(img);} else image.classList.add('no-image');
          const body=document.createElement('div');body.className='card-body';
          const title=document.createElement('h3');title.textContent=item.title||'';
          const desc=document.createElement('p');desc.textContent=item.description||'';
          const button=document.createElement('span');button.className='get-prompt';button.textContent='Get Prompt →';
          body.append(title,desc,button);card.append(image,body);grid.appendChild(card);
        });
        node.appendChild(grid);
      } else if(section.content){
        const content=document.createElement('div');content.className='custom-home-info-content';content.textContent=section.content;node.appendChild(content);
      }
      anchor.insertAdjacentElement('afterend',node);
      lastByPlacement.set(section.placement,node);
    });
  }catch(error){console.debug('Custom homepage sections are not enabled yet.',error.message);}
}

// Public, database-managed homepage controls. Only visual text/appearance and public links are read here.
let loadedSiteSettings = null;
const SITE_SAFE_FONTS = new Set(['Poppins','DM Sans','Manrope','Arial']);
function safeSiteUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '#';
  if (/^#[A-Za-z0-9_-]+$/.test(url)) return url;
  if (/^(page\.html\?slug=[a-z0-9-]+(?:#[a-z0-9-]+)?|prompt\.html\?id=\d+)$/i.test(url)) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return '#';
}
function safeColor(value, fallback) { return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : fallback; }
function applyConfiguredSiteSettings(settings = loadedSiteSettings) {
  if (!settings || typeof settings !== 'object') return;
  loadedSiteSettings = settings;
  window.FPL_SITE_SETTINGS = settings;
  const hero = settings.hero || {};
  const search = settings.search || {};
  const footer = settings.footer || {};
  const font = SITE_SAFE_FONTS.has(hero.fontFamily) ? hero.fontFamily : 'Poppins';
  const root = document.documentElement;
  root.style.setProperty('--hero-font-family', `'${font}', Arial, sans-serif`);
  const title1Size=Math.min(56,Math.max(14,Number(hero.title1Size)||32));
  const title2Size=Math.min(52,Math.max(14,Number(hero.title2Size)||29));
  root.style.setProperty('--hero-title1-size', `${title1Size}px`);
  root.style.setProperty('--hero-title2-size', `${title2Size}px`);
  root.style.setProperty('--hero-title1-mobile-size', `${Math.min(21,Math.max(12,Math.round(title1Size*0.66)))}px`);
  root.style.setProperty('--hero-title2-mobile-size', `${Math.min(20,Math.max(12,Math.round(title2Size*0.69)))}px`);
  if (hero.title1) $('.hero-headings h1').textContent = hero.title1;
  if (hero.title2) $('.hero-headings h2').textContent = hero.title2;
  if (hero.subtitle) $('.hero-subtitle').textContent = hero.subtitle;
  const searchButton = $('#searchButton');
  if (searchButton) {
    if (search.buttonText) searchButton.textContent = search.buttonText;
    const first = safeColor(search.buttonStart,'#6688ea'), second = safeColor(search.buttonEnd,'#874bb0');
    searchButton.style.background = `linear-gradient(110deg,${first},${second})`;
    searchButton.style.color = '#fff';
    searchButton.classList.toggle('search-button-animated', search.hoverAnimation !== false);
  }
  const complaintLink = $('#searchComplaintLink');
  if (complaintLink) { complaintLink.textContent = search.complaintText || siteText('complaint'); complaintLink.href = 'page.html?slug=contact#complaint'; }
  const nav = $('#nav');
  if (nav && Array.isArray(settings.navLinks) && settings.navLinks.length) {
    nav.innerHTML = '';
    settings.navLinks.filter(item => item && item.enabled !== false && item.label && item.url).forEach(item => {
      const anchor = document.createElement('a'); anchor.textContent = item.label; anchor.href = safeSiteUrl(item.url);
      if (/^https?:\/\//i.test(item.url)) { anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; }
      nav.appendChild(anchor);
    });
  }
  const footerFont = SITE_SAFE_FONTS.has(footer.fontFamily) ? footer.fontFamily : 'Poppins';
  root.style.setProperty('--site-footer-bg', safeColor(footer.background,'#071a33'));
  root.style.setProperty('--site-footer-color', safeColor(footer.textColor,'#f5f7ff'));
  root.style.setProperty('--site-footer-font', `'${footerFont}', Arial, sans-serif`);
  root.style.setProperty('--site-footer-font-size', `${Math.min(20,Math.max(10,Number(footer.fontSize)||13))}px`);
  const email = String(settings.contactEmail || '').trim();
  const emailLink = $('#footerEmailLink');
  if (emailLink) { emailLink.href = 'page.html?slug=contact'; emailLink.textContent = email ? `Email: ${email}` : siteText('emailUs'); }
  renderConfiguredSocials(Array.isArray(settings.socials) ? settings.socials : []);
}
function renderConfiguredSocials(socials) {
  const visible = socials.filter(item => item && item.url && /^https?:\/\//i.test(item.url));
  const socialSection = $('#socialSection');
  const grid = $('#socialLinkGrid');
  const footerGrid = $('#footerSocialLinks');
  if (socialSection && grid) {
    socialSection.hidden = !visible.length;
    grid.innerHTML = visible.map(item => `<a class="social-link-card" href="${escapeText(item.url)}" target="_blank" rel="noopener noreferrer"><span class="social-link-icon">${escapeText((item.platform||'S').slice(0,1).toUpperCase())}</span><strong>${escapeText(item.platform||'Social')}</strong><span>Follow ↗</span></a>`).join('');
  }
  if (footerGrid) footerGrid.innerHTML = visible.length ? visible.map(item => `<a href="${escapeText(item.url)}" target="_blank" rel="noopener noreferrer">${escapeText(item.platform||'Social')} ↗</a>`).join('') : '<span class="footer-social-empty">Social links will appear here.</span>';
}
async function loadPublicSiteSettings() {
  if (!supabaseClient) return;
  try {
    const {data,error} = await supabaseClient.from('site_settings').select('settings').eq('id',1).maybeSingle();
    if (error) throw error;
    if (data?.settings) applyConfiguredSiteSettings(data.settings);
  } catch (error) { console.debug('Homepage controls are not enabled yet.', error.message); }
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
    if (action === 'all') activeSpecialFilter = 'trending';
    if (action === 'celebration') activeSpecialFilter = 'celebration';
    currentPage = 1;
    render();
    $('#latest').scrollIntoView({behavior:'smooth', block:'start'});
  });
});

const categories = ['Photo Editing','Gemini Photo','Couple','Wedding','Saree','Birthday','Festival','3D Cartoon','Video Generation','Photo to Video','Cinematic','YouTube Thumbnail','Family','Fashion','Travel','Nature','Product','Dance','Logo','Sports','Background'];
$('#categoryList').innerHTML = categories.map((category, index) => `<a class="category-link" href="#latest" data-cat="${category}" data-category-index="${index}">${category}</a>`).join('');
applySiteLanguage(currentSiteLanguage);

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
loadCustomHomepageSections();
loadPublicSiteSettings();

// Load the CMS-managed collection after the local fallback has rendered.
loadPromptsFromSupabase();
