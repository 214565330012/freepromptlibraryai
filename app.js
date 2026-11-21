// FreePromptLibraryAI - Core Application Logic
// Dynamic Supabase Database Sync with Seamless Offline Fallback

(function() {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  let allPrompts = window.PROMPTS || [];
  let currentCategory = 'All';
  let searchTerm = '';

  // Palette gradients for cards without preview images
  const categoryGradients = {
    Portrait: 'linear-gradient(135deg, #2b1055 0%, #7597de 100%)',
    Traditional: 'linear-gradient(135deg, #431c53 0%, #e056fd 100%)',
    Couple: 'linear-gradient(135deg, #511235 0%, #f77062 100%)',
    Wedding: 'linear-gradient(135deg, #3d1b54 0%, #c373f2 100%)',
    Festival: 'linear-gradient(135deg, #4a2800 0%, #f6a623 100%)',
    Family: 'linear-gradient(135deg, #103254 0%, #4ea5d9 100%)',
    Fashion: 'linear-gradient(135deg, #3f0d3a 0%, #ba5370 100%)',
    Cinematic: 'linear-gradient(135deg, #0d1b2a 0%, #415a77 100%)',
    Logo: 'linear-gradient(135deg, #161a30 0%, #31304d 100%)',
    '3D Art': 'linear-gradient(135deg, #240046 0%, #7b2cbf 100%)',
    Nature: 'linear-gradient(135deg, #0b2518 0%, #198754 100%)',
    Product: 'linear-gradient(135deg, #182035 0%, #3a506b 100%)',
    Travel: 'linear-gradient(135deg, #083344 0%, #06b6d4 100%)',
    YouTube: 'linear-gradient(135deg, #4c0519 0%, #e11d48 100%)',
    Sports: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)',
    Birthday: 'linear-gradient(135deg, #4c0519 0%, #f43f5e 100%)'
  };

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

  function copyToClipboard(text, btnElement) {
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
      btnElement.innerHTML = `✓ Copied!`;
      setTimeout(() => {
        btnElement.classList.remove('copied');
        btnElement.innerHTML = originalText;
      }, 2000);
    }

    showToast('Prompt copied to clipboard!');
  }

  // Fetch prompts dynamically from Supabase
  async function loadPromptsFromSupabase() {
    if (!window.supabaseClient) {
      console.log('Using local high-speed prompt index.');
      render();
      return;
    }

    try {
      const { data, error } = await window.supabaseClient
        .from('prompts')
        .select('*')
        .eq('status', 'published')
        .order('id', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        allPrompts = data.map(item => ({
          ...item,
          id: Number(item.id),
          tools: item.tools || ['Google Gemini', 'ChatGPT', 'Midjourney']
        }));
        window.PROMPTS = allPrompts;
      }
    } catch (err) {
      console.warn('Supabase dynamic query failed, serving bundled prompts:', err);
    } finally {
      render();
    }
  }

  function filterPrompts() {
    return allPrompts.filter(item => {
      // Category Filter
      if (currentCategory === 'Trending' && !item.is_trending) return false;
      if (currentCategory === 'Photo' && item.type !== 'Photo') return false;
      if (currentCategory === 'Video' && item.type !== 'Video') return false;
      if (currentCategory !== 'All' && currentCategory !== 'Trending' && currentCategory !== 'Photo' && currentCategory !== 'Video') {
        if (item.category !== currentCategory) return false;
      }

      // Search Term Filter
      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        const inTitle = (item.title || '').toLowerCase().includes(query);
        const inPrompt = (item.prompt_en || '').toLowerCase().includes(query);
        const inCat = (item.category || '').toLowerCase().includes(query);
        const inTools = (item.tools || []).some(t => t.toLowerCase().includes(query));
        if (!inTitle && !inPrompt && !inCat && !inTools) return false;
      }

      return true;
    });
  }

  function renderCard(item) {
    const bgGradient = categoryGradients[item.category] || 'linear-gradient(135deg, #1e1945 0%, #2f2566 100%)';
    const hasImage = item.image_url && item.image_url.trim() !== '';
    const tools = item.tools && item.tools.length ? item.tools : ['Google Gemini', 'Midjourney'];

    return `
      <article class="prompt-card" data-id="${item.id}">
        <div class="card-media" style="${!hasImage ? `background: ${bgGradient};` : ''}">
          ${hasImage ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title)}" loading="lazy">` : ''}
          <div class="card-badge-top">
            <span class="badge-tag">${escapeHtml(item.category)}</span>
            ${item.is_trending ? `<span class="badge-tag badge-trending">Trending</span>` : ''}
          </div>
          ${item.aspect_ratio ? `<span class="badge-ratio">${escapeHtml(item.aspect_ratio)}</span>` : ''}
        </div>

        <div class="card-body">
          <h3 class="card-title">
            <a href="prompt.html?id=${item.id}">${escapeHtml(item.title)}</a>
          </h3>

          <div class="card-tools">
            ${tools.slice(0, 3).map(t => `<span class="tool-chip">${escapeHtml(t)}</span>`).join('')}
          </div>

          <p class="card-prompt-preview">${escapeHtml(item.prompt_en)}</p>

          <div class="card-actions">
            <button class="btn-copy" type="button" data-prompt="${escapeHtml(item.prompt_en)}">
              <span>📋</span> Copy Prompt
            </button>
            <a class="btn-view" href="prompt.html?id=${item.id}">Details →</a>
          </div>
        </div>
      </article>
    `;
  }

  function render() {
    const container = $('#promptsGrid');
    if (!container) return;

    const filtered = filterPrompts();
    const countEl = $('#promptCount');
    if (countEl) countEl.textContent = `${filtered.length} Prompts`;

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">🔍</div>
          <h3>No matching prompts found</h3>
          <p style="color: var(--text-muted); margin-top: 0.5rem;">Try searching for different keywords or clear the category filter.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(renderCard).join('');

    // Attach Copy listeners
    $$('.btn-copy').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const text = btn.getAttribute('data-prompt');
        copyToClipboard(text, btn);
      });
    });
  }

  // Initialize Search & Filters
  function setupEvents() {
    // Search Box
    const searchInput = $('#searchInput');
    const searchForm = $('#searchForm');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchTerm = e.target.value;
        render();
      });
    }

    if (searchForm) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (searchInput) searchTerm = searchInput.value;
        render();
      });
    }

    // Category Filter Pills
    $$('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCategory = btn.getAttribute('data-category') || 'All';
        render();
      });
    });
  }

  // DOM Ready
  document.addEventListener('DOMContentLoaded', () => {
    setupEvents();
    loadPromptsFromSupabase();
  });

})();
