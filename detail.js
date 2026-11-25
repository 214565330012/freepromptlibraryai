const byId = (id) => document.getElementById(id);
const params = new URLSearchParams(window.location.search);
const requestedId = Number(params.get('id'));
let promptItem = (window.PROMPTS || []).find((item) => Number(item.id) === requestedId) || null;
let activePromptText = '';
const supabaseClient = window.supabaseClient || null;
const paletteByCategory = {
  Portrait:['#d9a0d0','#6559c7'], Traditional:['#d8a15a','#b44c72'], Couple:['#ef9ab1','#7551aa'],
  Wedding:['#f3b69c','#9069bb'], Festival:['#efa74d','#c34f68'], Family:['#88b6d6','#7b69b8'],
  Fashion:['#d58db3','#5553a9'], Cinematic:['#6e85cb','#414b83'], Logo:['#6a8ee5','#744bb2'],
  '3D Art':['#9e82e8','#e18db9'], '3D Animation':['#9e82e8','#e18db9'], Nature:['#70b9a1','#4b7f9d'],
  Product:['#74a4ce','#7a6cae'], Travel:['#83b9d1','#6479b3'], YouTube:['#e67d84','#8d4e9e'],
  Sports:['#82a7cc','#5558a6'], Birthday:['#f0a0a7','#8660bf'], Background:['#8a80cf','#d78eac'],
  'Photo to Video':['#688fce','#7e65b1'], Dance:['#e398c1','#7857a8'], 'Social Media':['#83a7db','#6f58aa'],
  Automotive:['#667eab','#5b4a8b']
};
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function showNotFound(){byId('notFound').hidden=false;byId('detailContent').hidden=true;document.title=`${detailText('notFound')} | FreePromptLibraryAI`;}
function getDisplayTitle(item){return currentDetailLanguage === 'hi' && item.title_hi ? item.title_hi : (item.title || '');}
function getMainPromptText(item){return currentDetailLanguage === 'hi' && item.prompt_hi ? item.prompt_hi : (item.content_text || item.prompt_en || '');}
function getHowToUse(item){return item.how_to_use || detailText('defaultHowTo');}
function setActivePrompt(text, ratio=''){
  activePromptText=text||'';
  byId('promptText').textContent=activePromptText;
  const fact=byId('activeFormatFact');
  if(fact) fact.textContent=ratio?`${detailText('selectedFormat')} ${ratio}`:'';
  byId('copyFeedback').textContent='';
}
function renderVariants(item){
  const host=byId('formatVariants');
  if(!host)return;
  const alternatives=Array.isArray(item.prompt_variants)?item.prompt_variants.filter(v=>v&&String(v.prompt_text||'').trim()):[];
  const normalized=alternatives.map((variant,index)=>{
    const marker=`${variant.format_key||''} ${variant.name||''} ${variant.layout||''}`.toLowerCase();
    const key=marker.includes('instagram')||marker.includes('insta')?'instagram':marker.includes('portrait')||marker.includes('story')?'portrait':(variant.format_key||`custom-${index+1}`);
    return {...variant,format_key:key,layout:variant.layout||(key==='landscape'?'landscape':'side'),name:variant.name||(key==='instagram'?'Instagram Post':key==='portrait'?'Portrait / Story':`Format ${index+1}`)};
  }).filter(variant=>variant.format_key!=='landscape');
  const order={portrait:0,instagram:1};
  normalized.sort((a,b)=>(order[a.format_key]??2)-(order[b.format_key]??2));
  host.innerHTML=normalized.map((variant,index)=>{
    const sideLayout=variant.layout!=='landscape';
    const image=variant.image_url?`<img src="${escapeHtml(variant.image_url)}" alt="${escapeHtml(variant.name)} sample image" loading="lazy">`:'<div class="format-variant-placeholder"><span>✦</span><small>Sample image</small></div>';
    const label=variant.format_key==='portrait'?'PORTRAIT / STORY FORMAT':variant.format_key==='instagram'?'INSTAGRAM POST FORMAT':String(variant.name).toUpperCase();
    const about=variant.about_text||item.about_text||item.about||detailText('defaultAbout');
    const how=variant.how_to_use||item.how_to_use||detailText('defaultHowTo');
    return `<article class="format-variant-card ${sideLayout?'format-variant-side':'format-variant-landscape'}" data-format-variant="${escapeHtml(variant.format_key)}">
      <div class="format-variant-image">${image}</div>
      <section class="format-variant-about"><span class="section-eyebrow">ABOUT</span><h3>About this prompt</h3><p>${escapeHtml(about)}</p></section>
      <div class="format-variant-prompt-area">
        <div class="format-variant-kicker">${escapeHtml(label)}</div>
        <h2>${escapeHtml(item.title||'Prompt')} · ${escapeHtml(variant.name)}</h2>
        <div class="format-variant-meta">${variant.aspect_ratio?`<span>${detailText('aspectPrefix')} ${escapeHtml(variant.aspect_ratio)}</span>`:''}${variant.duration?`<span>${escapeHtml(variant.duration)}</span>`:''}</div>
        <div class="format-variant-prompt-heading"><h3>Prompt</h3><div class="format-variant-actions"><button type="button" class="copy-format-prompt" data-copy-format-prompt="${index}">Copy Prompt</button><span class="format-variant-copy-feedback" aria-live="polite"></span></div></div>
        <pre class="format-variant-prompt-text">${escapeHtml(variant.prompt_text||'')}</pre>
        <button type="button" class="format-variant-see-more" aria-expanded="false">See More</button>
      </div>
      <section class="format-variant-how"><span class="section-eyebrow">HOW TO USE</span><h3>How to use this prompt</h3><p>${escapeHtml(how)}</p></section>
    </article>`;
  }).join('');
  host.hidden=!normalized.length;
  host.querySelectorAll('.format-variant-see-more').forEach(button=>button.addEventListener('click',()=>{
    const card=button.closest('.format-variant-card');
    const text=button.previousElementSibling;
    const expanded=button.getAttribute('aria-expanded')==='true';
    text.classList.toggle('is-expanded',!expanded);
    button.setAttribute('aria-expanded',String(!expanded));
    button.textContent=expanded?'See More':'See Less';
  }));
  host.querySelectorAll('[data-copy-format-prompt]').forEach(button=>button.addEventListener('click',async()=>{
    const variant=normalized[Number(button.dataset.copyFormatPrompt)];
    const feedback=button.parentElement.querySelector('.format-variant-copy-feedback');
    try{
      if(navigator.clipboard&&window.isSecureContext) await navigator.clipboard.writeText(variant.prompt_text||'');
      else{const field=document.createElement('textarea');field.value=variant.prompt_text||'';field.style.position='fixed';field.style.opacity='0';document.body.appendChild(field);field.select();const ok=document.execCommand('copy');field.remove();if(!ok)throw new Error('Copy unavailable');}
      feedback.textContent=detailText('copied');
    }catch{feedback.textContent=detailText('selectCopy');}
  }));
}
async function copyCurrentPrompt(){
  try{
    if(navigator.clipboard&&window.isSecureContext) await navigator.clipboard.writeText(activePromptText);
    else{const field=document.createElement('textarea');field.value=activePromptText;field.style.position='fixed';field.style.opacity='0';document.body.appendChild(field);field.select();const ok=document.execCommand('copy');field.remove();if(!ok)throw new Error('Copy unavailable');}
    byId('copyFeedback').textContent=detailText('copied');
  }catch{byId('copyFeedback').textContent=detailText('selectCopy');}
}
function renderExtraSections(sections){
  const host=byId('extraSections');const valid=Array.isArray(sections)?sections:[];
  host.innerHTML=valid.map(section=>{
    const heading=section.heading||section.heading_en||section.heading_hi||'More information';
    const content=section.content||section.content_en||section.content_hi||section.paragraph_en||section.paragraph_hi||'';
    const image=section.image_url?`<img class="extra-section-image" src="${escapeHtml(section.image_url)}" alt="${escapeHtml(section.image_alt||heading)}" loading="lazy">`:'';
    return `<article class="extra-section-card">${image}<h2>${escapeHtml(heading)}</h2>${content?`<p>${escapeHtml(content)}</p>`:''}</article>`;
  }).join('');host.hidden=!valid.length;
}
function renderContentBlocks(blocks){
  const host=byId('contentBlocks');
  const valid=Array.isArray(blocks)?blocks.filter(block=>block&&((block.type==='about'&&block.heading)||(block.type==='prompt'&&block.title&&block.prompt_text))):[];
  if(!host)return;
  host.innerHTML=valid.map((block,index)=>{
    const image=block.image_url?`<div class="content-block-image"><img src="${escapeHtml(block.image_url)}" alt="${escapeHtml(block.heading||block.title||'Section image')}" loading="lazy"></div>`:`<div class="content-block-image content-block-image-empty"><span>✦</span></div>`;
    if(block.type==='about'){
      const safeUrl=/^https?:\/\//i.test(block.url||'')?block.url:'';
      return `<article class="content-block-card content-block-about">${block.image_url?image:''}<div class="content-block-body"><span class="content-block-kicker">INFORMATION</span><h2>${escapeHtml(block.heading||'')}</h2>${block.content?`<p>${escapeHtml(block.content)}</p>`:''}${safeUrl?`<a class="content-block-link" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">Visit link ↗</a>`:''}</div></article>`;
    }
    const type=block.prompt_type||'Photo';
    const layout=['portrait','instagram'].includes(block.layout)?block.layout:'landscape';
    const imageMarkup=block.image_url?image:'<div class="content-block-image content-block-image-empty"><span>✦</span></div>';
    const aboutMarkup=block.about_text?`<section class="content-block-about-text"><strong>About</strong><p>${escapeHtml(block.about_text)}</p></section>`:'';
    const promptMarkup=`<div class="content-block-prompt-area"><div class="content-block-kicker">${layout==='portrait'?'PORTRAIT / STORY':layout==='instagram'?'INSTAGRAM POST':'LANDSCAPE'} PROMPT</div><div class="content-block-meta"><span>${escapeHtml(type)}</span>${block.category?`<span>${escapeHtml(block.category)}</span>`:''}${block.aspect_ratio?`<span>${escapeHtml(block.aspect_ratio)}</span>`:''}${block.duration?`<span>${escapeHtml(block.duration)}</span>`:''}</div><h2>${escapeHtml(block.title||'')}</h2><div class="content-block-actions"><button type="button" class="copy-content-block" data-copy-content-block="${index}">Copy Prompt</button><span class="content-block-copy-feedback" aria-live="polite"></span></div><pre class="content-block-prompt-text">${escapeHtml(block.prompt_text||'')}</pre><button type="button" class="content-block-see-more" aria-expanded="false">See More</button></div>`;
    const howMarkup=block.how_to_use?`<div class="content-block-how"><strong>How to use</strong><p>${escapeHtml(block.how_to_use)}</p></div>`:'';
    return `<article class="content-block-card content-block-prompt content-block-layout-${layout}">${imageMarkup}${aboutMarkup}${promptMarkup}${howMarkup}</article>`;
  }).join('');
  host.hidden=!valid.length;
  host.querySelectorAll('.content-block-see-more').forEach(button=>button.addEventListener('click',()=>{
    const text=button.previousElementSibling;
    const expanded=button.getAttribute('aria-expanded')==='true';
    text.classList.toggle('is-expanded',!expanded);
    button.setAttribute('aria-expanded',String(!expanded));
    button.textContent=expanded?'See More':'See Less';
  }));
  host.querySelectorAll('[data-copy-content-block]').forEach(button=>button.addEventListener('click',async()=>{
    const block=valid[Number(button.dataset.copyContentBlock)];
    const feedback=button.parentElement.querySelector('.content-block-copy-feedback');
    try{
      if(navigator.clipboard&&window.isSecureContext) await navigator.clipboard.writeText(block.prompt_text||'');
      else{const field=document.createElement('textarea');field.value=block.prompt_text||'';field.style.position='fixed';field.style.opacity='0';document.body.appendChild(field);field.select();const ok=document.execCommand('copy');field.remove();if(!ok)throw new Error('Copy unavailable');}
      feedback.textContent=detailText('copied');
    }catch{feedback.textContent=detailText('selectCopy');}
  }));
}
function renderRelatedCollection(item){
  const host=byId('relatedPromptDetails');
  const related=Array.isArray(item.related_prompts)?item.related_prompts:[];
  host.innerHTML=related.map((entry,index)=>`<article class="related-prompt-detail"><div class="related-prompt-image">${entry.image_url?`<img src="${escapeHtml(entry.image_url)}" alt="${escapeHtml(entry.title||'Related prompt')}" loading="lazy">`:'<span>✦</span>'}</div><div class="related-prompt-body"><span class="related-index">PROMPT ${index+1}</span><h3>${escapeHtml(entry.title||'Related prompt')}</h3>${entry.aspect_ratio?`<small>${detailText('aspectPrefix')} ${escapeHtml(entry.aspect_ratio)}</small>`:''}<pre>${escapeHtml(entry.prompt_text||'')}</pre><button class="copy-related" type="button" data-copy-related="${index}">${detailText('copyRelated')}</button></div></article>`).join('');
  byId('relatedCollection').hidden=!related.length;
  host.querySelectorAll('[data-copy-related]').forEach(button=>button.addEventListener('click',async()=>{
    const entry=related[Number(button.dataset.copyRelated)];
    try{await navigator.clipboard.writeText(entry.prompt_text||'');button.textContent=detailText('copiedShort');setTimeout(()=>button.textContent=detailText('copyRelated'),1600);}catch{button.textContent=detailText('selectShort');}
  }));
}
function renderRelated(item){
  const related=(window.PROMPTS||[]).filter(candidate=>Number(candidate.id)!==Number(item.id)&&(candidate.category===item.category||candidate.type===item.type)).slice(0,3);
  byId('relatedGrid').innerHTML=related.map(candidate=>{
    const colors=paletteByCategory[candidate.category]||['#8d82d5','#c58bb5'];
    const image=candidate.image_url?`<img src="${escapeHtml(candidate.image_url)}" alt="${escapeHtml(candidate.title)}" loading="lazy">`:'';
    return `<a class="related-card" href="prompt.html?id=${encodeURIComponent(candidate.id)}"><span class="related-art" style="--related-a:${colors[0]};--related-b:${colors[1]}">${image}</span><span class="related-type">${escapeHtml(candidate.type)} · ${escapeHtml(candidate.category)}</span><strong>${escapeHtml(candidate.title)}</strong><span class="related-open">${detailText('viewPrompt')}</span></a>`;
  }).join('');byId('relatedSection').hidden=!related.length;
}
function renderDetail(item){
  promptItem=item;const isVideo=item.type==='Video';const colors=paletteByCategory[item.category]||['#8d82d5','#c58bb5'];
  byId('detailKicker').textContent=isVideo?detailText('videoKicker'):detailText('photoKicker');
  byId('detailTitle').textContent=getDisplayTitle(item);byId('crumbTitle').textContent=getDisplayTitle(item)||'Prompt details';
  byId('detailTags').innerHTML=`<span>${escapeHtml(item.type)}</span><span>${escapeHtml(item.category)}</span>${item.aspect_ratio?`<span>${escapeHtml(item.aspect_ratio)}</span>`:''}`;
  byId('previewArt').style.setProperty('--preview-a',colors[0]);byId('previewArt').style.setProperty('--preview-b',colors[1]);
  const sample=byId('sampleImage');
  if(item.image_url){sample.src=item.image_url;sample.hidden=false;byId('previewArt').classList.add('has-sample-image');byId('previewNote').hidden=true;byId('previewNote').textContent='';byId('previewIcon').hidden=true;byId('previewCategory').hidden=true;byId('previewName').hidden=true;byId('previewLabel').hidden=true;}
  else{sample.hidden=true;sample.removeAttribute('src');byId('previewArt').classList.remove('has-sample-image');byId('previewNote').hidden=false;byId('previewNote').textContent=detailText('previewNote');byId('previewIcon').hidden=false;byId('previewCategory').hidden=false;byId('previewName').hidden=false;byId('previewLabel').hidden=false;byId('previewIcon').textContent='✦';byId('previewCategory').textContent=`${String(item.category||'').toUpperCase()} ${isVideo?'VIDEO':'PHOTO'} PROMPT`;byId('previewName').textContent=getDisplayTitle(item);}
  byId('aboutContent').textContent=item.about_text||item.about||detailText('defaultAbout');
  const facts=[[detailText('type'),item.type],[detailText('category'),item.category],[detailText('aspect'),item.aspect_ratio||detailText('notSpecified')]];if(isVideo&&item.duration)facts.push([detailText('duration'),item.duration]);
  byId('quickFacts').innerHTML=facts.map(([label,value])=>`<div class="fact-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');byId('quickFacts').hidden=true;
  setActivePrompt(getMainPromptText(item),item.aspect_ratio||'');renderVariants(item);
  byId('howToUseContent').textContent=getHowToUse(item);
  renderExtraSections(item.extra_sections);renderRelatedCollection(item);renderContentBlocks(item.content_blocks);byId('detailContent').hidden=false;byId('notFound').hidden=true;
  document.title=`${item.title} ${item.type} Prompt | FreePromptLibraryAI`;
  const desc=`${item.title}: free ${String(item.type).toLowerCase()} prompt. Read details and copy the prompt.`;
  const meta=document.querySelector('meta[name="description"]');if(meta)meta.setAttribute('content',desc);
  const schema=byId('promptSchema');if(schema)schema.textContent=JSON.stringify({'@context':'https://schema.org','@type':'CreativeWork',name:item.title,inLanguage:'en',description:byId('aboutContent').textContent,text:getMainPromptText(item)});
  renderRelated(item);
}
byId('copyPrompt').addEventListener('click',copyCurrentPrompt);
byId('detailYear').textContent=new Date().getFullYear();
const DETAIL_UI = {
  en: {
    home:'Home', prompts:'Prompts', back:'← Back to Home', about:'About this prompt', aboutEyebrow:'ABOUT', readyEyebrow:'READY TO COPY', howEyebrow:'HOW TO USE', collectionEyebrow:'SAME COLLECTION', relatedEyebrow:'KEEP EXPLORING',
    prompt:'Prompt', defaultFormat:'Default', how:'How to use this prompt', relatedCollection:'More prompts in this collection',
    related:'Related prompts', viewAll:'View all prompts →', copy:'Copy Prompt',
    copied:'Copied successfully.', selectCopy:'Select the prompt text and copy it.',
    copyRelated:'Copy Prompt', copiedShort:'Copied', selectShort:'Select and copy',
    photoKicker:'FREE AI PHOTO PROMPT', videoKicker:'FREE AI VIDEO PROMPT',
    previewNote:'A sample image can be added from the Admin Panel.',
    selectedFormat:'Selected format:', type:'Type', category:'Category',
    aspect:'Aspect ratio', notSpecified:'Not specified', duration:'Suggested duration',
    promptPrefix:'PROMPT', aspectPrefix:'Aspect ratio:', browse:'Browse all prompts', viewPrompt:'View prompt →',
    notFound:'Prompt not found', notFoundDesc:'This prompt may have been removed or the link is incorrect.',
    defaultAbout:'A ready-to-use photo or video prompt from this collection.',
    defaultHowTo:'Copy the prompt, open your preferred photo or video generator, add a reference image when required, and paste the prompt.',
    footerDescription:'Free AI photo and video prompts.'
  },
  hi: {
    home:'होम', prompts:'प्रॉम्प्ट', back:'← होम पेज पर जाएँ', about:'इस प्रॉम्प्ट के बारे में', aboutEyebrow:'जानकारी', readyEyebrow:'कॉपी के लिए तैयार', howEyebrow:'उपयोग कैसे करें', collectionEyebrow:'इसी संग्रह में', relatedEyebrow:'और प्रॉम्प्ट देखें',
    prompt:'प्रॉम्प्ट', defaultFormat:'डिफ़ॉल्ट', how:'इस प्रॉम्प्ट का उपयोग कैसे करें', relatedCollection:'इस संग्रह के अन्य प्रॉम्प्ट',
    related:'संबंधित प्रॉम्प्ट', viewAll:'सभी प्रॉम्प्ट देखें →', copy:'प्रॉम्प्ट कॉपी करें',
    copied:'सफलतापूर्वक कॉपी हुआ।', selectCopy:'प्रॉम्प्ट चुनें और कॉपी करें।',
    copyRelated:'प्रॉम्प्ट कॉपी करें', copiedShort:'कॉपी हुआ', selectShort:'चुनें और कॉपी करें',
    photoKicker:'मुफ़्त AI फोटो प्रॉम्प्ट', videoKicker:'मुफ़्त AI वीडियो प्रॉम्प्ट',
    previewNote:'नमूना फोटो Admin Panel से जोड़ी जा सकती है।',
    selectedFormat:'चुना गया फ़ॉर्मेट:', type:'प्रकार', category:'श्रेणी',
    aspect:'आस्पेक्ट रेशियो', notSpecified:'निर्दिष्ट नहीं', duration:'सुझाई गई अवधि',
    promptPrefix:'प्रॉम्प्ट', aspectPrefix:'आस्पेक्ट रेशियो:', browse:'सभी प्रॉम्प्ट देखें', viewPrompt:'प्रॉम्प्ट देखें →',
    notFound:'प्रॉम्प्ट नहीं मिला', notFoundDesc:'यह प्रॉम्प्ट हटाया गया हो सकता है या लिंक गलत है।',
    defaultAbout:'इस संग्रह से तैयार उपयोग योग्य फोटो या वीडियो प्रॉम्प्ट।',
    defaultHowTo:'प्रॉम्प्ट कॉपी करें, अपना पसंदीदा फोटो या वीडियो जनरेटर खोलें, ज़रूरत होने पर रेफरेंस फोटो जोड़ें और प्रॉम्प्ट पेस्ट करें।',
    footerDescription:'मुफ़्त AI फोटो और वीडियो प्रॉम्प्ट।'
  }
};
let currentDetailLanguage = 'en';
function detailText(key) { return DETAIL_UI[currentDetailLanguage]?.[key] ?? DETAIL_UI.en[key] ?? key; }
function applyDetailLanguage(language) {
  currentDetailLanguage = language === 'hi' ? 'hi' : 'en';
  const t = DETAIL_UI[currentDetailLanguage];
  const setText = (selector, value) => { const node = document.querySelector(selector); if (node) node.textContent = value; };
  setText('.back-link', t.back);
  setText('.breadcrumbs a:first-child', t.home);
  setText('.breadcrumbs a:nth-of-type(2)', t.prompts);
  setText('.info-panel h2', t.about); setText('.info-panel .section-eyebrow', t.aboutEyebrow);
  setText('.prompt-panel h2', t.prompt); setText('.prompt-panel .section-eyebrow', t.readyEyebrow);
  setText('.copy-action', t.copy);
  setText('.how-to-panel h2', t.how); setText('.how-to-panel .section-eyebrow', t.howEyebrow);
  setText('.related-collection h2', t.relatedCollection); setText('.related-collection .section-eyebrow', t.collectionEyebrow);
  setText('.related-section h2', t.related); setText('.related-section .section-eyebrow', t.relatedEyebrow);
  setText('.related-section .view-all', t.viewAll);
  setText('.detail-footer p', t.footerDescription);
  setText('#notFound h1', t.notFound);
  setText('#notFound p', t.notFoundDesc);
  setText('#notFound .primary-link', t.browse);
  document.querySelectorAll('[data-language]').forEach((button) => {
    const active = button.dataset.language === currentDetailLanguage;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.documentElement.lang = currentDetailLanguage;
  localStorage.setItem('fpl-language', currentDetailLanguage);
  if (promptItem) renderDetail(promptItem);
}
(function setupSiteControls() {
  const theme = localStorage.getItem('fpl-theme') || 'light';
  document.documentElement.dataset.theme = theme;
  const toggle = byId('themeToggle');
  if (toggle) {
    toggle.textContent = theme === 'dark' ? '☀' : '◐';
    toggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    toggle.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('fpl-theme', next);
      toggle.textContent = next === 'dark' ? '☀' : '◐';
      toggle.setAttribute('aria-label', next === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    });
  }
  applyDetailLanguage(localStorage.getItem('fpl-language') || 'en');
  document.querySelectorAll('[data-language]').forEach((button) => button.addEventListener('click', () => applyDetailLanguage(button.dataset.language)));
})();

function visitorId(){try{let id=localStorage.getItem('fpl-visitor-id');if(!id){id=crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;localStorage.setItem('fpl-visitor-id',id);}return id;}catch{return crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;}}
function trackPromptView(id){if(!supabaseClient)return;supabaseClient.from('page_views').insert({page_path:location.pathname,prompt_id:id,visitor_id:visitorId()}).then(({error})=>{if(error)console.debug('Prompt analytics not enabled yet.',error.message);}).catch(()=>{});}
async function initDetail(){
  if(supabaseClient&&requestedId){
    try{const {data,error}=await supabaseClient.from('prompts').select('*').eq('id',requestedId).eq('status','published').maybeSingle();if(error)throw error;if(data){const normalized={...data,id:Number(data.id)};const index=window.PROMPTS.findIndex(p=>Number(p.id)===requestedId);if(index>=0)window.PROMPTS[index]=normalized;else window.PROMPTS.unshift(normalized);renderDetail(normalized);trackPromptView(requestedId);return;}showNotFound();return;}
    catch(error){console.warn('Supabase detail load failed; using bundled prompt data.',error);}
  }
  if(promptItem){renderDetail(promptItem);trackPromptView(requestedId);}else showNotFound();
}
initDetail();
