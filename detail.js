const byId = (id) => document.getElementById(id);
const params = new URLSearchParams(window.location.search);
const requestedId = Number(params.get('id'));
const promptItem = window.PROMPTS.find((item) => item.id === requestedId);
let activeLanguage = 'en';

const paletteByCategory = {
  Portrait: ['#d9a0d0', '#6559c7'], Traditional: ['#d8a15a', '#b44c72'],
  Couple: ['#ef9ab1', '#7551aa'], Wedding: ['#f3b69c', '#9069bb'],
  Festival: ['#efa74d', '#c34f68'], Family: ['#88b6d6', '#7b69b8'],
  Fashion: ['#d58db3', '#5553a9'], Cinematic: ['#6e85cb', '#414b83'],
  Logo: ['#6a8ee5', '#744bb2'], '3D Art': ['#9e82e8', '#e18db9'],
  '3D Animation': ['#9e82e8', '#e18db9'], Nature: ['#70b9a1', '#4b7f9d'],
  Product: ['#74a4ce', '#7a6cae'], Travel: ['#83b9d1', '#6479b3'],
  YouTube: ['#e67d84', '#8d4e9e'], Sports: ['#82a7cc', '#5558a6'],
  Birthday: ['#f0a0a7', '#8660bf'], Background: ['#8a80cf', '#d78eac'],
  'Photo to Video': ['#688fce', '#7e65b1'], Dance: ['#e398c1', '#7857a8'],
  'Social Media': ['#83a7db', '#6f58aa'], Automotive: ['#667eab', '#5b4a8b']
};
const icons = {
  Portrait: '◉', Traditional: '✿', Couple: '♡', Wedding: '✧', Festival: '✦',
  Family: '⌂', Fashion: '◇', Cinematic: '▶', Logo: '✳', '3D Art': '⬡',
  '3D Animation': '⬡', Nature: '❋', Product: '▣', Travel: '⌖', YouTube: '▶',
  Sports: '✦', Birthday: '✺', Background: '▧', 'Photo to Video': '▣',
  Dance: '♫', 'Social Media': '◎', Automotive: '◈', 'Photo Editing': '✧'
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function overviewFor(item, language) {
  const info = window.PROMPT_INFO[item.category] || window.PROMPT_INFO[item.type] || {};
  if (info[language]) return info[language];
  return language === 'hi'
    ? 'यह प्रॉम्प्ट AI से बेहतर फोटो या वीडियो बनाने में मदद करता है। नीचे दिया गया टेक्स्ट कॉपी करके अपने पसंदीदा जनरेटर में इस्तेमाल करें।'
    : 'This prompt helps you create a more polished AI photo or video. Copy the ready-to-use text below and paste it into your preferred generator.';
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
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const field = document.createElement('textarea');
      field.value = text;
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      const copied = document.execCommand('copy');
      field.remove();
      if (!copied) throw new Error('Copy command was not available');
    }
    byId('copyFeedback').textContent = activeLanguage === 'hi' ? 'प्रॉम्प्ट कॉपी हो गया।' : 'Prompt copied successfully.';
  } catch (error) {
    byId('copyFeedback').textContent = activeLanguage === 'hi' ? 'टेक्स्ट चुनकर कॉपी करें।' : 'Please select and copy the prompt text.';
  }
}

function renderRelated(item) {
  const related = window.PROMPTS.filter((candidate) => candidate.id !== item.id && (candidate.category === item.category || candidate.type === item.type)).slice(0, 3);
  byId('relatedGrid').innerHTML = related.map((candidate) => {
    const colors = paletteByCategory[candidate.category] || ['#8d82d5', '#c58bb5'];
    return `<a class="related-card" href="prompt.html?id=${encodeURIComponent(candidate.id)}">
      <span class="related-art" style="--related-a:${colors[0]};--related-b:${colors[1]}">${escapeHtml(icons[candidate.category] || '✦')}</span>
      <span class="related-type">${escapeHtml(candidate.type)} · ${escapeHtml(candidate.category)}</span>
      <strong>${escapeHtml(candidate.title)}</strong>
      <span class="related-open">View prompt →</span>
    </a>`;
  }).join('');
  byId('relatedSection').hidden = related.length === 0;
}

function showNotFound() {
  byId('notFound').hidden = false;
  byId('detailContent').hidden = true;
  document.title = 'Prompt Not Found | FreePromptLibraryAI';
}

function renderDetail(item) {
  const isVideo = item.type === 'Video';
  const colors = paletteByCategory[item.category] || ['#8d82d5', '#c58bb5'];
  byId('detailKicker').textContent = isVideo ? 'FREE AI VIDEO PROMPT' : 'FREE AI PHOTO PROMPT';
  byId('detailTitle').textContent = item.title;
  byId('detailTitleHi').textContent = item.title_hi || '';
  byId('crumbTitle').textContent = item.title;
  byId('detailTags').innerHTML = `<span>${escapeHtml(item.type)} Prompt</span><span>${escapeHtml(item.category)}</span><span>English + Hindi</span>`;
  byId('previewArt').style.setProperty('--preview-a', colors[0]);
  byId('previewArt').style.setProperty('--preview-b', colors[1]);
  byId('previewIcon').textContent = icons[item.category] || '✦';
  byId('previewCategory').textContent = `${item.category.toUpperCase()} ${isVideo ? 'VIDEO' : 'PHOTO'} PROMPT`;
  byId('previewName').textContent = item.title;
  byId('aboutEnglish').textContent = overviewFor(item, 'en');
  byId('aboutHindi').textContent = overviewFor(item, 'hi');
  const facts = [
    ['Type', item.type], ['Category', item.category], ['Aspect ratio', item.aspect_ratio || 'Not specified']
  ];
  if (isVideo && item.duration) facts.push(['Suggested duration', item.duration]);
  byId('quickFacts').innerHTML = facts.map(([label, value]) => `<div class="fact-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
  byId('detailContent').hidden = false;
  byId('notFound').hidden = true;
  document.title = `${item.title} ${item.type} Prompt in English & Hindi | FreePromptLibraryAI`;
  const desc = `${item.title}: free ${item.type.toLowerCase()} prompt in English and Hindi. Read the details and copy the prompt.`;
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) metaDescription.setAttribute('content', desc);
  const schema = {
    '@context': 'https://schema.org', '@type': 'CreativeWork',
    name: item.title, inLanguage: ['en', 'hi'],
    description: overviewFor(item, 'en'),
    text: item.prompt_en
  };
  byId('promptSchema').textContent = JSON.stringify(schema);
  setPromptLanguage('en');
  renderRelated(item);
}

document.querySelectorAll('[data-prompt-lang]').forEach((button) => {
  button.addEventListener('click', () => setPromptLanguage(button.dataset.promptLang));
});
byId('copyPrompt').addEventListener('click', copyCurrentPrompt);
byId('detailYear').textContent = new Date().getFullYear();

if (promptItem) renderDetail(promptItem);
else showNotFound();
