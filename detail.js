const byId = (id) => document.getElementById(id);
const params = new URLSearchParams(window.location.search);
const requestedId = Number(params.get('id'));
let promptItem = window.PROMPTS.find((item) => Number(item.id) === requestedId) || null;
let activeLanguage = 'en';
const supabaseClient = window.supabaseClient || null;

const paletteByCategory = {
  Portrait: ['#d9a0d0', '#6559c7'], Traditional: ['#d8a15a', '#b44c72'], Couple: ['#ef9ab1', '#7551aa'],
  Wedding: ['#f3b69c', '#9069bb'], Festival: ['#efa74d', '#c34f68'], Family: ['#88b6d6', '#7b69b8'],
  Fashion: ['#d58db3', '#5553a9'], Cinematic: ['#6e85cb', '#414b83'], Logo: ['#6a8ee5', '#744bb2'],
  '3D Art': ['#9e82e8', '#e18db9'], '3D Animation': ['#9e82e8', '#e18db9'], Nature: ['#70b9a1', '#4b7f9d'],
  Product: ['#74a4ce', '#7a6cae'], Travel: ['#83b9d1', '#6479b3'], YouTube: ['#e67d84', '#8d4e9e'],
  Sports: ['#82a7cc', '#5558a6'], Birthday: ['#f0a0a7', '#8660bf'], Background: ['#8a80cf', '#d78eac'],
  'Photo to Video': ['#688fce', '#7e65b1'], Dance: ['#e398c1', '#7857a8'], 'Social Media': ['#83a7db', '#6f58aa'],
  Automotive: ['#667eab', '#5b4a8b']
};
const icons = {Portrait:'◉',Traditional:'✿',Couple:'♡',Wedding:'✧',Festival:'✦',Family:'⌂',Fashion:'◇',Cinematic:'▶',Logo:'✳','3D Art':'⬡','3D Animation':'⬡',Nature:'❋',Product:'▣',Travel:'⌖',YouTube:'▶',Sports:'✦',Birthday:'✺',Background:'▧','Photo to Video':'▣',Dance:'♫','Social Media':'◎',Automotive:'◈','Photo Editing':'✧'};
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function overviewFor(item, language) {
  const info = window.PROMPT_INFO[item.category] || window.PROMPT_INFO[item.type] || {};
  if (info[language]) return info[language];
  const field = language === 'hi' ? item.about_hi : item.about_en;
  return field || (language === 'hi' ? 'यह प्रॉम्प्ट AI से बेहतर फोटो या वीडियो बनाने में मदद करता है। नीचे दिया गया टेक्स्ट कॉपी करके अपने पसंदीदा जनरेटर में इस्तेमाल करें।' : 'This prompt helps you create a more polished AI photo or video. Copy the ready-to-use text below and paste it into your preferred generator.');
}
function setPromptLanguage(language) {
  activeLanguage = language;
  const text = language === 'hi' ? promptItem.prompt_hi : promptItem.prompt_en;
  byId('promptText').textContent = text || (language === 'hi' ? 'हिन्दी प्रॉम्प्ट उपलब्ध नहीं है।' : 'English prompt is not available.');
  byId('copyPrompt').textContent = language === 'hi' ? '▢ हिन्दी प्रॉम्प्ट कॉपी करें' : '▢ Copy English Prompt';
  document.querySelectorAll('[data-prompt-lang]').forEach((button) => {
    const selected = button.dataset.promptLang === language;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', String(selected));
  });
  byId('copyFeedback').textContent = '';
}
async function copyCurrentPrompt() {
  const text = activeLanguage === 'hi' ? promptItem.prompt_hi : promptItem.prompt_en;
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
    else { const field=document.createElement('textarea'); field.value=text; field.style.position='fixed'; field.style.opacity='0'; document.body.appendChild(field); field.select(); const copied=document.execCommand('copy'); field.remove(); if(!copied) throw new Error('copy unavailable'); }
    byId('copyFeedback').textContent = activeLanguage === 'hi' ? 'प्रॉम्प्ट कॉपी हो गया।' : 'Prompt copied successfully.';
  } catch { byId('copyFeedback').textContent = activeLanguage === 'hi' ? 'टेक्स्ट चुनकर कॉपी करें।' : 'Please select and copy the prompt text.'; }
}
function renderRelated(item) {
  const related = window.PROMPTS.filter((candidate) => Number(candidate.id) !== Number(item.id) && (candidate.category === item.category || candidate.type === item.type)).slice(0, 3);
  byId('relatedGrid').innerHTML = related.map((candidate) => {
    const colors = paletteByCategory[candidate.category] || ['#8d82d5', '#c58bb5'];
    return `<a class="related-card" href="prompt.html?id=${encodeURIComponent(candidate.id)}"><span class="related-art" style="--related-a:${colors[0]};--related-b:${colors[1]}">${escapeHtml(icons[candidate.category] || '✦')}</span><span class="related-type">${escapeHtml(candidate.type)} · ${escapeHtml(candidate.category)}</span><strong>${escapeHtml(candidate.title)}</strong><span class="related-open">View prompt →</span></a>`;
  }).join('');
  byId('relatedSection').hidden = related.length === 0;
}
function renderExtraSections(sections) {
  const host = byId('extraSections');
  const valid = Array.isArray(sections) ? sections : [];
  host.innerHTML = valid.map((section) => {
    const en = section.content_en || section.paragraph_en || '';
    const hi = section.content_hi || section.paragraph_hi || '';
    const image = section.image_url ? `<img class="extra-section-image" src="${escapeHtml(section.image_url)}" alt="${escapeHtml(section.image_alt || section.heading_en || 'Prompt information image')}" loading="lazy">` : '';
    return `<article class="extra-section-card"><h2>${escapeHtml(section.heading_en || section.heading_hi || 'More information')}</h2>${en ? `<p>${escapeHtml(en)}</p>` : ''}${hi ? `<p class="extra-hindi" lang="hi">${escapeHtml(hi)}</p>` : ''}${image}</article>`;
  }).join('');
  host.hidden = valid.length === 0;
}
function showNotFound() { byId('notFound').hidden=false; byId('detailContent').hidden=true; document.title='Prompt Not Found | FreePromptLibraryAI'; }
function renderDetail(item) {
  promptItem = item;
  const isVideo = item.type === 'Video';
  const colors = paletteByCategory[item.category] || ['#8d82d5', '#c58bb5'];
  byId('detailKicker').textContent = isVideo ? 'FREE AI VIDEO PROMPT' : 'FREE AI PHOTO PROMPT';
  byId('detailTitle').textContent = item.title || '';
  byId('detailTitleHi').textContent = item.title_hi || '';
  byId('crumbTitle').textContent = item.title || 'Prompt details';
  byId('detailTags').innerHTML = `<span>${escapeHtml(item.type)} Prompt</span><span>${escapeHtml(item.category)}</span><span>English + Hindi</span>`;
  byId('previewArt').style.setProperty('--preview-a', colors[0]);
  byId('previewArt').style.setProperty('--preview-b', colors[1]);
  byId('previewIcon').textContent = icons[item.category] || '✦';
  byId('previewCategory').textContent = `${String(item.category || '').toUpperCase()} ${isVideo ? 'VIDEO' : 'PHOTO'} PROMPT`;
  byId('previewName').textContent = item.title || '';
  const sample = byId('sampleImage');
  if (item.image_url) { sample.src=item.image_url; sample.hidden=false; byId('previewArt').classList.add('has-sample-image'); byId('previewNote').textContent='Sample image for this prompt.'; }
  else { sample.hidden=true; sample.removeAttribute('src'); byId('previewArt').classList.remove('has-sample-image'); byId('previewNote').textContent='Illustrative category preview. A sample image can be added from the Admin Panel.'; }
  byId('aboutEnglish').textContent = overviewFor(item, 'en');
  byId('aboutHindi').textContent = overviewFor(item, 'hi');
  const facts = [['Type', item.type], ['Category', item.category], ['Aspect ratio', item.aspect_ratio || 'Not specified']];
  if (isVideo && item.duration) facts.push(['Suggested duration', item.duration]);
  byId('quickFacts').innerHTML = facts.map(([label,value]) => `<div class="fact-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
  renderExtraSections(item.extra_sections);
  byId('detailContent').hidden=false; byId('notFound').hidden=true;
  document.title = `${item.title} ${item.type} Prompt in English & Hindi | FreePromptLibraryAI`;
  const desc = `${item.title}: free ${String(item.type).toLowerCase()} prompt in English and Hindi. Read the details and copy the prompt.`;
  const meta=document.querySelector('meta[name="description"]'); if(meta) meta.setAttribute('content',desc);
  byId('promptSchema').textContent=JSON.stringify({'@context':'https://schema.org','@type':'CreativeWork',name:item.title,inLanguage:['en','hi'],description:overviewFor(item,'en'),text:item.prompt_en});
  setPromptLanguage('en'); renderRelated(item);
}
document.querySelectorAll('[data-prompt-lang]').forEach(button=>button.addEventListener('click',()=>setPromptLanguage(button.dataset.promptLang)));
byId('copyPrompt').addEventListener('click',copyCurrentPrompt);
byId('detailYear').textContent=new Date().getFullYear();
async function initDetail() {
  if (supabaseClient && requestedId) {
    try {
      const {data,error}=await supabaseClient.from('prompts').select('*').eq('id',requestedId).eq('status','published').maybeSingle();
      if (error) throw error;
      if (data) { const normalized={...data,id:Number(data.id)}; const index=window.PROMPTS.findIndex(p=>Number(p.id)===requestedId); if(index>=0) window.PROMPTS[index]=normalized; else window.PROMPTS.unshift(normalized); renderDetail(normalized); return; }
      showNotFound(); return;
    } catch(error) { console.warn('Supabase detail load failed; using bundled prompt data.',error); }
  }
  if (promptItem) renderDetail(promptItem); else showNotFound();
}
initDetail();
