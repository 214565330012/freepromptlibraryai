// FreePromptLibraryAI - Prompt Detail View & Interaction Handler

(function() {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const urlParams = new URLSearchParams(window.location.search);
  const promptId = Number(urlParams.get('id')) || 1;

  function showToast(message) {
    let toast = $('#toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function copyText(text, btnElement) {
    if (!navigator.clipboard) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } else {
      navigator.clipboard.writeText(text);
    }

    if (btnElement) {
      const originalText = btnElement.innerHTML;
      btnElement.classList.add('copied');
      btnElement.innerHTML = `<span>✓</span> Copied Successfully!`;
      setTimeout(() => {
        btnElement.classList.remove('copied');
        btnElement.innerHTML = originalText;
      }, 2200);
    }

    showToast('Prompt copied! Paste it into Gemini or ChatGPT.');
  }

  async function getPromptData() {
    // 1. Try Supabase if available
    if (window.supabaseClient) {
      try {
        const { data, error } = await window.supabaseClient
          .from('prompts')
          .select('*')
          .eq('id', promptId)
          .single();

        if (!error && data) {
          return {
            ...data,
            id: Number(data.id),
            how_to_use_hi: data.prompt_hi || data.how_to_use_hi || 'रेफरेंस फोटो अपलोड करके यह प्रॉम्प्ट अपने एआई टूल में पेस्ट करें।'
          };
        }
      } catch (e) {
        console.warn('Supabase prompt fetch error, falling back to local list:', e);
      }
    }

    // 2. Fallback to local index
    if (window.getPromptById) {
      return window.getPromptById(promptId);
    }

    const list = window.PROMPTS || [];
    return list.find(item => Number(item.id) === promptId) || null;
  }

  function renderRelated(category, currentId) {
    const list = window.PROMPTS || [];
    const related = list
      .filter(item => Number(item.id) !== currentId && (item.category === category || item.is_trending))
      .slice(0, 3);

    const container = $('#relatedGrid');
    if (!container) return;

    if (related.length === 0) {
      $('#relatedSection').style.display = 'none';
      return;
    }

    container.innerHTML = related.map(item => `
      <article class="prompt-card">
        <div class="card-body">
          <div class="card-tools" style="margin-bottom: 0.5rem;">
            <span class="badge-tag">${escapeHtml(item.category)}</span>
            ${item.aspect_ratio ? `<span class="badge-ratio" style="position: static; margin-left: auto;">${escapeHtml(item.aspect_ratio)}</span>` : ''}
          </div>
          <h3 class="card-title">
            <a href="prompt.html?id=${item.id}">${escapeHtml(item.title)}</a>
          </h3>
          <p class="card-prompt-preview">${escapeHtml(item.prompt_en)}</p>
          <div class="card-actions">
            <a class="btn-copy" style="text-align: center;" href="prompt.html?id=${item.id}">View Prompt →</a>
          </div>
        </div>
      </article>
    `).join('');
  }

  async function renderDetail() {
    const item = await getPromptData();

    if (!item) {
      $('#detailContainer').innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">⚠️</div>
          <h2>Prompt Not Found</h2>
          <p style="color: var(--text-muted); margin: 0.75rem 0 1.5rem;">The prompt you are looking for does not exist or has been moved.</p>
          <a class="nav-btn" href="index.html">← Back to All Prompts</a>
        </div>
      `;
      return;
    }

    // Update Meta Title & Breadcrumbs
    document.title = `${item.title} - Free AI Prompt | FreePromptLibraryAI`;
    const crumbTitle = $('#crumbTitle');
    if (crumbTitle) crumbTitle.textContent = item.title;

    // Badges & Title
    $('#promptCategoryBadge').textContent = item.category;
    $('#promptTypeBadge').textContent = item.type === 'Video' ? 'Video Prompt' : 'Photo Prompt';
    $('#promptHeading').textContent = item.title;

    // AI Tools Chips
    const tools = item.tools && item.tools.length ? item.tools : ['Google Gemini', 'ChatGPT Plus', 'Midjourney'];
    $('#promptToolsList').innerHTML = tools.map(t => `<span class="tool-chip">${escapeHtml(t)}</span>`).join('');

    // English Prompt Box
    $('#promptContent').textContent = item.prompt_en;

    // Hindi How To Use Box
    const hindiGuide = item.how_to_use_hi || item.prompt_hi || 'रेफरेंस फोटो अपलोड करके इस प्रॉम्प्ट को अपने एआई जनरेटर (Gemini, ChatGPT या Midjourney) में पेस्ट करें।';
    $('#hindiGuideText').textContent = hindiGuide;

    // Direct Tool Launch Links
    const encodedPrompt = encodeURIComponent(item.prompt_en);
    $('#launchChatGpt').href = `https://chatgpt.com/?q=${encodedPrompt}`;
    $('#launchGemini').href = `https://gemini.google.com/app`;

    // Sidebar Specs
    $('#specCategory').textContent = item.category;
    $('#specType').textContent = item.type;
    $('#specRatio').textContent = item.aspect_ratio || '1:1 / 4:5';
    $('#specDuration').textContent = item.duration || 'N/A';
    $('#specModel').textContent = item.type === 'Video' ? 'Google Flow AI / Runway Gen-3' : 'Google Gemini 1.5 / Midjourney v6';

    // Copy Button Action
    const copyBtn = $('#btnCopyPrompt');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        copyText(item.prompt_en, copyBtn);
      });
    }

    // Related Prompts
    renderRelated(item.category, item.id);
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderDetail();
  });

})();
