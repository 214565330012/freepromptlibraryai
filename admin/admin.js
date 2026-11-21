(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const client = window.supabaseClient || null;
  const PAGE_SIZE = 18;
  const state = {
    user: null, prompts: [], homeSections: [], page: 1, pageSize: PAGE_SIZE,
    view: 'overview', imageUrl: '', sectionCount: 0, variantCount: 0,
    relatedCount: 0, homeCardCount: 0, recoveryEmail: '', resendTimer: null,
    otpVerificationInProgress: false, recoveryLinkInProgress: false, analytics: null, editingPrompt: null, contentBlockCount: 0
  };

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  function setMessage(element, message = '', isError = false) {
    if (!element) return;
    element.textContent = message;
    element.classList.toggle('error', isError);
  }

  let toastTimer;
  function toast(message, isError = false) {
    const element = $('#toast');
    if (!element) return;
    element.textContent = message;
    element.classList.toggle('error', isError);
    element.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove('show'), 3600);
  }

  function showLogin(message = '', isError = true) {
    $('#loginView').hidden = false;
    $('#recoveryView').hidden = true;
    $('#dashboardView').hidden = true;
    if (message) setMessage($('#loginMessage'), message, isError);
  }
  function showRecovery() {
    $('#loginView').hidden = true;
    $('#recoveryView').hidden = false;
    $('#dashboardView').hidden = true;
  }
  function setRecoveryStep(step) {
    $('#recoveryRequestForm').hidden = step !== 'request';
    $('#recoveryOtpForm').hidden = step !== 'otp';
    $('#recoveryPasswordForm').hidden = step !== 'password';
  }
  function resetRecovery() {
    if (state.resendTimer) clearInterval(state.resendTimer);
    state.resendTimer = null;
    $('#recoveryRequestForm').reset();
    $('#recoveryOtpForm').reset();
    $('#recoveryPasswordForm').reset();
    $('#recoveryIntro').textContent = 'Enter your admin email. We will send a verification code or secure reset link.';
    ['#recoveryRequestMessage', '#recoveryOtpMessage', '#recoveryPasswordMessage'].forEach((selector) => setMessage($(selector)));
    $('#resendOtpBtn').disabled = true;
    $('#resendOtpBtn').textContent = 'Resend code in 60s';
    setRecoveryStep('request');
  }
  function startResendCooldown(seconds = 60) {
    const button = $('#resendOtpBtn');
    if (state.resendTimer) clearInterval(state.resendTimer);
    let remaining = seconds;
    button.disabled = true;
    button.textContent = `Resend code in ${remaining}s`;
    state.resendTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(state.resendTimer);
        state.resendTimer = null;
        button.disabled = false;
        button.textContent = 'Resend verification code';
      } else button.textContent = `Resend code in ${remaining}s`;
    }, 1000);
  }

  async function verifyAdmin(user) {
    const { data, error } = await client.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
    if (error) throw new Error(`Admin permission check failed: ${error.message}`);
    if (!data) throw new Error('This account is not authorised for the Admin Panel.');
    state.user = user;
  }

  function showDashboard() {
    $('#loginView').hidden = true;
    $('#recoveryView').hidden = true;
    $('#dashboardView').hidden = false;
    const email = state.user?.email || 'Administrator';
    $('#profileEmail').textContent = email;
    $('#profileInitials').textContent = email.slice(0, 1).toUpperCase();
    $('#dashboardView').setAttribute('aria-label', `Signed in as ${email}`);
    loadPrompts();
  }

  // Authentication and password recovery remain Supabase-managed.
  $('#loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.submitter || $('#loginForm button[type="submit"]');
    button.disabled = true;
    setMessage($('#loginMessage'), 'Signing in…');
    try {
      if (!client) throw new Error('Supabase could not be loaded. Refresh the page and try again.');
      const { data, error } = await client.auth.signInWithPassword({
        email: $('#loginEmail').value.trim(), password: $('#loginPassword').value
      });
      if (error) throw error;
      await verifyAdmin(data.user);
      setMessage($('#loginMessage'));
      showDashboard();
    } catch (error) {
      if (client) await client.auth.signOut();
      setMessage($('#loginMessage'), error.message || 'Unable to sign in.', true);
    } finally { button.disabled = false; }
  });

  $('#forgotPasswordBtn').addEventListener('click', () => {
    resetRecovery();
    const email = $('#loginEmail').value.trim();
    if (email) $('#recoveryEmail').value = email;
    showRecovery();
  });
  $('#backToLoginBtn').addEventListener('click', async () => {
    if (client) {
      const { data } = await client.auth.getSession();
      if (data.session) await client.auth.signOut();
    }
    const savedEmail = state.recoveryEmail || $('#recoveryEmail').value.trim();
    resetRecovery();
    if (savedEmail) $('#loginEmail').value = savedEmail;
    showLogin();
  });
  async function requestRecovery(email, messageElement, button) {
    button.disabled = true;
    setMessage(messageElement, 'Sending a secure recovery email…');
    try {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/admin/` });
      if (error) throw error;
      state.recoveryEmail = email;
      $('#recoveryEmail').value = email;
      $('#recoveryIntro').textContent = `Check ${email} for the recovery code or secure reset link.`;
      setRecoveryStep('otp');
      setMessage($('#recoveryOtpMessage'), 'Recovery email requested. Enter its code, or open the secure reset link.');
      startResendCooldown(60);
    } catch (error) {
      setMessage(messageElement, error.message || 'Could not send the recovery email. Check Supabase email settings.', true);
    } finally {
      if (button.id === 'resendOtpBtn') { if (!state.resendTimer) startResendCooldown(60); }
      else button.disabled = false;
    }
  }
  $('#recoveryRequestForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = $('#recoveryEmail').value.trim().toLowerCase();
    if (!email) return;
    state.recoveryEmail = email;
    await requestRecovery(email, $('#recoveryRequestMessage'), $('#sendOtpBtn'));
  });
  $('#resendOtpBtn').addEventListener('click', async () => {
    if (state.recoveryEmail) await requestRecovery(state.recoveryEmail, $('#recoveryOtpMessage'), $('#resendOtpBtn'));
  });
  $('#recoveryOtpForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('#verifyOtpBtn');
    const token = $('#recoveryOtp').value.trim();
    if (!/^\d{6,8}$/.test(token)) { setMessage($('#recoveryOtpMessage'), 'Enter the 6–8 digit code from your email.', true); return; }
    button.disabled = true;
    state.otpVerificationInProgress = true;
    setMessage($('#recoveryOtpMessage'), 'Verifying your email code…');
    try {
      const { data, error } = await client.auth.verifyOtp({ email: state.recoveryEmail, token, type: 'recovery' });
      if (error) throw error;
      const user = data.user || data.session?.user;
      if (!user) throw new Error('The email code did not return a user. Request a new code.');
      await verifyAdmin(user);
      showRecoveryPasswordStep('Email verified. Choose your new password.');
    } catch (error) {
      await client.auth.signOut();
      setMessage($('#recoveryOtpMessage'), error.message || 'The code could not be verified.', true);
    } finally { state.otpVerificationInProgress = false; button.disabled = false; }
  });
  function showRecoveryPasswordStep(message = '') {
    showRecovery();
    setRecoveryStep('password');
    if (message) setMessage($('#recoveryPasswordMessage'), message);
  }
  $('#recoveryPasswordForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('#saveNewPasswordBtn');
    const password = $('#recoveryNewPassword').value;
    const confirmPassword = $('#recoveryConfirmPassword').value;
    if (password.length < 8) { setMessage($('#recoveryPasswordMessage'), 'Use a password with at least 8 characters.', true); return; }
    if (password !== confirmPassword) { setMessage($('#recoveryPasswordMessage'), 'The passwords do not match.', true); return; }
    button.disabled = true;
    setMessage($('#recoveryPasswordMessage'), 'Updating your password…');
    try {
      const { data, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      const user = data.session?.user;
      if (!user) throw new Error('Your recovery session expired. Request a new recovery email.');
      await verifyAdmin(user);
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      await client.auth.signOut();
      state.user = null;
      $('#loginEmail').value = state.recoveryEmail || user.email || '';
      resetRecovery();
      showLogin('Password changed successfully. Sign in with your new password.', false);
    } catch (error) { setMessage($('#recoveryPasswordMessage'), error.message || 'Could not update the password.', true); }
    finally { button.disabled = false; }
  });
  if (client) client.auth.onAuthStateChange((event, session) => {
    if (event !== 'PASSWORD_RECOVERY' || !session?.user || state.otpVerificationInProgress || state.recoveryLinkInProgress) return;
    state.recoveryLinkInProgress = true;
    setTimeout(async () => {
      try {
        await verifyAdmin(session.user);
        state.recoveryEmail = session.user.email || '';
        $('#recoveryEmail').value = state.recoveryEmail;
        $('#recoveryIntro').textContent = 'Your secure recovery link has verified your email.';
        showRecoveryPasswordStep('Your email is verified. Choose a new password.');
      } catch (error) {
        await client.auth.signOut(); resetRecovery(); showLogin(error.message || 'This account is not authorised to reset the admin password.');
      } finally { state.recoveryLinkInProgress = false; }
    }, 0);
  });

  // Navigation.
  const viewTitles = { overview: 'Dashboard', prompts: 'All prompts', categories: 'Categories', media: 'Media library', homepage: 'Homepage builder', analytics: 'Analytics' };
  function switchView(view) {
    state.view = view;
    $$('.view-panel').forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === view));
    $$('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
    $('#breadcrumbTitle').textContent = viewTitles[view] || 'Dashboard';
    $('#sidebar').classList.remove('open');
    if (view === 'prompts') renderPromptList();
    if (view === 'categories') renderCategories();
    if (view === 'media') renderMedia();
    if (view === 'homepage') loadHomeSections();
    if (view === 'analytics') loadAnalytics();
  }
  $$('.nav-item, [data-view]').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
  $('#mobileMenuButton').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  $('#signOutBtn').addEventListener('click', async () => { await client.auth.signOut(); state.user = null; showLogin('You have signed out.', false); });

  function updateMetrics() {
    const prompts = state.prompts;
    $('#totalCount').textContent = prompts.length;
    $('#publishedCount').textContent = prompts.filter((p) => p.status === 'published').length;
    $('#draftCount').textContent = prompts.filter((p) => p.status === 'draft').length;
    $('#trendingCount').textContent = prompts.filter((p) => p.is_trending).length;
    $('#navPromptCount').textContent = prompts.length;
    const photo = prompts.filter((p) => p.type === 'Photo').length;
    const video = prompts.filter((p) => p.type === 'Video').length;
    const max = Math.max(prompts.length, 1);
    $('#typeBreakdown').innerHTML = `<div class="breakdown-line"><span>Photo</span><div class="bar-track"><div class="bar-fill" style="width:${photo / max * 100}%"></div></div><b>${photo}</b></div><div class="breakdown-line"><span>Video</span><div class="bar-track"><div class="bar-fill video" style="width:${video / max * 100}%"></div></div><b>${video}</b></div>`;
  }
  function renderSequencePreview() {
    const preview = [...state.prompts].sort((a, b) => Number(a.id) - Number(b.id)).slice(0, 6);
    $('#sequencePreview').innerHTML = preview.length ? preview.map((prompt) => `<div class="sequence-item"><span class="sequence-number">${escapeHtml(prompt.id)}</span><span class="sequence-title"><strong>${escapeHtml(prompt.title)}</strong><small>${escapeHtml(prompt.category || 'General')}</small></span><span class="type-pill ${prompt.type === 'Video' ? 'video' : ''}">${escapeHtml(prompt.type)}</span><button class="sequence-edit" type="button" data-edit-prompt="${escapeHtml(prompt.id)}">Edit</button></div>`).join('') : '<div class="empty-state">No prompts available yet.</div>';
  }
  async function loadPrompts() {
    $('#sequencePreview').innerHTML = '<div class="loading-row">Loading your prompt sequence…</div>';
    $('#promptCards').innerHTML = '<div class="loading-row">Loading prompts…</div>';
    try {
      const { data, error } = await client.from('prompts').select('*').order('id', { ascending: true });
      if (error) throw error;
      state.prompts = (data || []).sort((a, b) => Number(a.id) - Number(b.id));
      updateMetrics(); renderSequencePreview(); populateCategoryFilters(); renderPromptList(); renderCategories(); renderMedia();
      if (state.view === 'homepage') loadHomeSections();
    } catch (error) {
      const message = escapeHtml(error.message || 'Unable to load prompts.');
      $('#sequencePreview').innerHTML = `<div class="empty-state">${message}</div>`;
      $('#promptCards').innerHTML = `<div class="empty-state">${message}</div>`;
      toast(`Could not load prompts: ${error.message}`, true);
    }
  }
  function filteredPrompts() {
    const search = $('#promptSearch').value.trim().toLowerCase();
    const type = $('#typeFilter').value, status = $('#statusFilter').value, category = $('#categoryFilter').value;
    return state.prompts.filter((prompt) => {
      if (type !== 'all' && prompt.type !== type) return false;
      if (status !== 'all' && prompt.status !== status) return false;
      if (category !== 'all' && prompt.category !== category) return false;
      if (!search) return true;
      return [prompt.id, prompt.title, prompt.category, prompt.type, prompt.prompt_en, prompt.content_text].join(' ').toLowerCase().includes(search);
    }).sort((a, b) => Number(a.id) - Number(b.id));
  }
  function renderPagination(totalPages) {
    const nav = $('#adminPagination');
    if (totalPages <= 1) { nav.innerHTML = ''; return; }
    let html = `<button type="button" data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''}>‹</button>`;
    for (let page = 1; page <= totalPages; page += 1) html += `<button type="button" data-page="${page}" class="${page === state.page ? 'active' : ''}" ${page === state.page ? 'aria-current="page"' : ''}>${page}</button>`;
    html += `<button type="button" data-page="${state.page + 1}" ${state.page === totalPages ? 'disabled' : ''}>›</button>`;
    nav.innerHTML = html;
  }
  function renderPromptList() {
    const host = $('#promptCards');
    if (!host) return;
    const filtered = filteredPrompts();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    state.page = Math.min(state.page, totalPages);
    const start = (state.page - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(start, start + PAGE_SIZE);
    host.innerHTML = pageItems.length ? pageItems.map((prompt) => `
      <article class="admin-prompt-card">
        <a class="admin-prompt-thumb" href="../prompt.html?id=${encodeURIComponent(prompt.id)}" target="_blank" rel="noopener" aria-label="Preview ${escapeHtml(prompt.title)}">
          ${prompt.image_url ? `<img src="${escapeHtml(prompt.image_url)}" alt="${escapeHtml(prompt.title)}" loading="lazy">` : '<span class="thumb-placeholder" aria-hidden="true">✦</span>'}
        </a>
        <div class="admin-prompt-card-body"><div class="admin-prompt-card-top"><span class="prompt-no">#${escapeHtml(prompt.id)}</span><span class="type-pill ${prompt.type === 'Video' ? 'video' : ''}">${escapeHtml(prompt.type)}</span></div>
          <h3>${escapeHtml(prompt.title)}</h3><p>${escapeHtml(prompt.category || 'General')} · ${escapeHtml(prompt.status)}</p>
          <div class="admin-prompt-actions"><button type="button" data-edit-prompt="${escapeHtml(prompt.id)}">Edit</button><button type="button" class="delete-btn" data-delete-prompt="${escapeHtml(prompt.id)}">Delete</button></div>
        </div>
      </article>`).join('') : '<div class="content-card empty-state">No prompts match these filters.</div>';
    const from = filtered.length ? start + 1 : 0, to = Math.min(start + PAGE_SIZE, filtered.length);
    $('#listSummary').textContent = `Showing ${from}–${to} of ${filtered.length} prompts · ordered by prompt number`;
    renderPagination(totalPages);
  }
  function populateCategoryFilters() {
    const categories = [...new Set(state.prompts.map((p) => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const current = $('#categoryFilter').value;
    $('#categoryFilter').innerHTML = '<option value="all">All categories</option>' + categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    if (categories.includes(current)) $('#categoryFilter').value = current;
    $('#categorySuggestions').innerHTML = categories.map((c) => `<option value="${escapeHtml(c)}"></option>`).join('');
  }
  function renderCategories() {
    const counts = new Map();
    state.prompts.forEach((p) => counts.set(p.category || 'General', (counts.get(p.category || 'General') || 0) + 1));
    const categories = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    $('#categoryGrid').innerHTML = categories.length ? categories.map(([name, count]) => `<button class="category-card" type="button" data-category="${escapeHtml(name)}"><span><strong>${escapeHtml(name)}</strong><small>${count} ${count === 1 ? 'prompt' : 'prompts'} · Open prompt list</small></span><span class="category-count">${count}</span></button>`).join('') : '<div class="content-card empty-state">No categories yet.</div>';
  }
  function renderMedia() {
    const images = state.prompts.filter((p) => p.image_url);
    $('#mediaCount').textContent = `${images.length} ${images.length === 1 ? 'image' : 'images'}`;
    $('#mediaGrid').innerHTML = images.length ? images.map((p) => `<article class="media-card"><img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.title)}" loading="lazy"><div class="media-info"><strong>${escapeHtml(p.title)}</strong><small>Prompt #${escapeHtml(p.id)} · ${escapeHtml(p.type)}</small><button class="media-open" type="button" data-edit-prompt="${escapeHtml(p.id)}">Edit image ↗</button></div></article>`).join('') : '<div class="content-card empty-state">No sample images have been uploaded yet.</div>';
  }
  $('#promptSearch').addEventListener('input', () => { state.page = 1; renderPromptList(); });
  ['#typeFilter', '#statusFilter', '#categoryFilter'].forEach((selector) => $(selector).addEventListener('change', () => { state.page = 1; renderPromptList(); }));
  $('#adminPagination').addEventListener('click', (event) => {
    const button = event.target.closest('[data-page]');
    if (!button || button.disabled) return;
    const page = Number(button.dataset.page);
    if (!Number.isInteger(page) || page < 1) return;
    state.page = page; renderPromptList();
  });
  $$('[data-metric-filter]').forEach((button) => button.addEventListener('click', () => {
    switchView('prompts');
    $('#promptSearch').value = ''; $('#typeFilter').value = 'all'; $('#categoryFilter').value = 'all';
    $('#statusFilter').value = button.dataset.metricFilter === 'published' || button.dataset.metricFilter === 'draft' ? button.dataset.metricFilter : 'all';
    state.page = 1;
    if (button.dataset.metricFilter === 'trending') {
      const results = filteredPrompts().filter((p) => p.is_trending);
      $('#promptCards').innerHTML = results.map(renderPromptCardCompact).join('') || '<div class="empty-state">No trending prompts.</div>';
      $('#listSummary').textContent = `${results.length} trending prompts`;
      $('#adminPagination').innerHTML = '';
    } else renderPromptList();
  }));
  function renderPromptCardCompact(prompt) {
    return `<article class="admin-prompt-card"><a class="admin-prompt-thumb" href="../prompt.html?id=${encodeURIComponent(prompt.id)}" target="_blank">${prompt.image_url ? `<img src="${escapeHtml(prompt.image_url)}" alt="${escapeHtml(prompt.title)}">` : '<span class="thumb-placeholder">✦</span>'}</a><div class="admin-prompt-card-body"><div class="admin-prompt-card-top"><span class="prompt-no">#${escapeHtml(prompt.id)}</span><span class="type-pill">${escapeHtml(prompt.type)}</span></div><h3>${escapeHtml(prompt.title)}</h3><p>${escapeHtml(prompt.category)}</p><div class="admin-prompt-actions"><button data-edit-prompt="${escapeHtml(prompt.id)}">Edit</button><button class="delete-btn" data-delete-prompt="${escapeHtml(prompt.id)}">Delete</button></div></div></article>`;
  }

  // Upload images to the public prompt-images bucket. Only admin users can write there (RLS).
  async function uploadPublicImage(file) {
    if (!file) return '';
    if (file.size > 5 * 1024 * 1024) throw new Error('Each image must be 5 MB or smaller.');
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (!allowed.includes(file.type)) throw new Error('Use a JPG, PNG, WebP or AVIF image.');
    const extension = (file.name.split('.').pop() || 'webp').toLowerCase().replace(/[^a-z0-9]/g, '') || 'webp';
    const token = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const path = `${Date.now()}-${token}.${extension}`;
    const { error } = await client.storage.from('prompt-images').upload(path, file, { upsert: false, contentType: file.type, cacheControl: '31536000' });
    if (error) throw error;
    return client.storage.from('prompt-images').getPublicUrl(path).data.publicUrl;
  }

  // -------- Prompt editor: ordered prompt and about content blocks. --------
  function resetEditorForm() {
    $('#promptForm').reset();
    $('#promptForm').dataset.dirty = 'false';
    $('#promptId').value = '';
    state.imageUrl = '';
    state.contentBlockCount = 0;
    state.editingPrompt = null;
    $('#contentBlockList').innerHTML = '';
    $('#sectionChooser').hidden = true;
    $('#imageFile').value = '';
    showCurrentImage('');
    setMessage($('#saveMessage'));
    refreshContentBlockNumbers();
  }
  function openEditor(prompt = null) {
    resetEditorForm();
    state.editingPrompt = prompt;
    $('#editorModal').hidden = false;
    document.body.style.overflow = 'hidden';
    $('#editorTitle').textContent = prompt ? 'Edit prompt' : 'Create a prompt';
    $('#editorSequence').textContent = prompt ? `· PROMPT #${prompt.id}` : '· NEW ITEM';
    if (prompt) {
      $('#promptId').value = prompt.id;
      $('#title').value = prompt.title || '';
      $('#type').value = prompt.type || 'Photo';
      $('#category').value = prompt.category || '';
      $('#aboutText').value = prompt.about_text || '';
      $('#promptEn').value = prompt.content_text || prompt.prompt_en || '';
      $('#howToUse').value = prompt.how_to_use || '';
      $('#aspectRatio').value = prompt.aspect_ratio || '';
      $('#duration').value = prompt.duration || '';
      $('#status').value = prompt.status || 'draft';
      $('#isTrending').checked = !!prompt.is_trending;
      state.imageUrl = prompt.image_url || '';
      showCurrentImage(state.imageUrl);
      (Array.isArray(prompt.content_blocks) ? prompt.content_blocks : []).forEach((block) => addContentBlock(block.type === 'about' ? 'about' : 'prompt', block));
    }
    $('#promptForm').dataset.dirty = 'false';
    setTimeout(() => $('#title').focus(), 40);
  }
  function closeEditor(saved = false) {
    if (!saved && $('#promptForm').dataset.dirty === 'true') {
      const discard = window.confirm('Discard the unsaved changes in this prompt?');
      if (!discard) return;
    }
    $('#editorModal').hidden = true;
    document.body.style.overflow = '';
    resetEditorForm();
  }
  function showCurrentImage(url) {
    const line = $('#currentImage');
    line.innerHTML = url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">Current sample image · Open preview ↗</a>` : 'No sample image selected.';
  }
  function refreshContentBlockNumbers() {
    $$('.content-block-editor', $('#contentBlockList')).forEach((wrap, index) => {
      const label = $('.content-block-number', wrap);
      if (label) label.textContent = `SECTION ${String(index + 1).padStart(2, '0')}`;
    });
  }
  function addContentBlock(type, data = {}) {
    state.contentBlockCount += 1;
    const wrap = document.createElement('article');
    wrap.className = `content-block-editor content-block-${type}`;
    wrap.dataset.blockType = type;
    const header = `<div class="content-block-head"><div><span class="content-block-number"></span><strong>${type === 'prompt' ? 'Prompt section' : 'About / information section'}</strong></div><button type="button" class="remove-content-block">Remove section</button></div>`;
    if (type === 'prompt') {
      wrap.innerHTML = `${header}
        <div class="form-grid">
          <label>Prompt title<input class="block-title" required maxlength="180" value="${escapeHtml(data.title || '')}" placeholder="e.g. Birthday Couple Portrait"></label>
          <label>Prompt type<select class="block-prompt-type"><option value="Photo" ${data.prompt_type === 'Video' ? '' : 'selected'}>Photo</option><option value="Video" ${data.prompt_type === 'Video' ? 'selected' : ''}>Video</option></select></label>
          <label class="full-span">Category<input class="block-category" maxlength="80" list="categorySuggestions" value="${escapeHtml(data.category || '')}" placeholder="e.g. Birthday, Portrait"></label>
          <label class="full-span">About this prompt<textarea class="block-about" rows="2" placeholder="Write a short description in any language…">${escapeHtml(data.about_text || '')}</textarea></label>
          <label class="full-span">Prompt<textarea class="block-prompt-text" rows="5" required placeholder="Write the complete prompt in any language…">${escapeHtml(data.prompt_text || '')}</textarea></label>
          <label class="full-span">How to use<textarea class="block-how-to-use" rows="2" placeholder="Instructions in any language…">${escapeHtml(data.how_to_use || '')}</textarea></label>
          <label>Aspect ratio<input class="block-aspect-ratio" value="${escapeHtml(data.aspect_ratio || '')}" placeholder="e.g. 4:5, 16:9, 1:1"></label>
          <label>Duration<input class="block-duration" value="${escapeHtml(data.duration || '')}" placeholder="e.g. 10 seconds"></label>
          <label class="full-span">Sample image <span class="field-hint">JPG, PNG, WebP or AVIF · Maximum 5 MB</span><input class="block-image-file" type="file" accept="image/jpeg,image/png,image/webp,image/avif"><span class="block-image-note image-preview-line">${data.image_url ? `Current image: ${escapeHtml(data.image_url)}` : 'No image selected.'}</span><input type="hidden" class="block-image-url" value="${escapeHtml(data.image_url || '')}"></label>
        </div>`;
    } else {
      wrap.innerHTML = `${header}
        <div class="form-grid">
          <label class="full-span">Heading<input class="about-heading" required maxlength="160" value="${escapeHtml(data.heading || '')}" placeholder="e.g. About this collection"></label>
          <label class="full-span">Information<textarea class="about-information" rows="4" placeholder="Write information in any language…">${escapeHtml(data.content || '')}</textarea></label>
          <label class="full-span">Link URL (optional)<input class="about-url" type="url" value="${escapeHtml(data.url || '')}" placeholder="https://example.com"></label>
          <label class="full-span">Image (optional) <span class="field-hint">JPG, PNG, WebP or AVIF · Maximum 5 MB</span><input class="about-image-file" type="file" accept="image/jpeg,image/png,image/webp,image/avif"><span class="about-image-note image-preview-line">${data.image_url ? `Current image: ${escapeHtml(data.image_url)}` : 'No image selected.'}</span><input type="hidden" class="about-image-url" value="${escapeHtml(data.image_url || '')}"></label>
        </div>`;
    }
    wrap.querySelector('.remove-content-block').addEventListener('click', () => {
      wrap.remove();
      refreshContentBlockNumbers();
      $('#promptForm').dataset.dirty = 'true';
    });
    const fileInput = wrap.querySelector(type === 'prompt' ? '.block-image-file' : '.about-image-file');
    const note = wrap.querySelector(type === 'prompt' ? '.block-image-note' : '.about-image-note');
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (file) note.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB · Will upload when you save`;
    });
    wrap.addEventListener('input', () => { $('#promptForm').dataset.dirty = 'true'; });
    wrap.addEventListener('change', () => { $('#promptForm').dataset.dirty = 'true'; });
    $('#contentBlockList').appendChild(wrap);
    refreshContentBlockNumbers();
    $('#sectionChooser').hidden = true;
    $('#promptForm').dataset.dirty = 'true';
    wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  async function collectContentBlocks() {
    const blocks = [];
    for (const wrap of $$('.content-block-editor', $('#contentBlockList'))) {
      if (wrap.dataset.blockType === 'prompt') {
        const title = $('.block-title', wrap).value.trim();
        const prompt_text = $('.block-prompt-text', wrap).value.trim();
        const file = $('.block-image-file', wrap).files[0];
        let image_url = $('.block-image-url', wrap).value.trim();
        if (file) image_url = await uploadPublicImage(file);
        if (!title || !prompt_text) throw new Error('Each added prompt section needs a title and prompt text.');
        blocks.push({
          type: 'prompt', title, prompt_type: $('.block-prompt-type', wrap).value,
          category: $('.block-category', wrap).value.trim() || 'General',
          about_text: $('.block-about', wrap).value.trim(), prompt_text,
          how_to_use: $('.block-how-to-use', wrap).value.trim(),
          aspect_ratio: $('.block-aspect-ratio', wrap).value.trim(),
          duration: $('.block-duration', wrap).value.trim(), image_url
        });
      } else {
        const heading = $('.about-heading', wrap).value.trim();
        const content = $('.about-information', wrap).value.trim();
        const url = $('.about-url', wrap).value.trim();
        const file = $('.about-image-file', wrap).files[0];
        let image_url = $('.about-image-url', wrap).value.trim();
        if (file) image_url = await uploadPublicImage(file);
        if (!heading) throw new Error('Each About section needs a heading.');
        if (url && !/^https?:\/\//i.test(url)) throw new Error('About section links must start with https:// or http://.');
        blocks.push({ type: 'about', heading, content, url, image_url });
      }
    }
    return blocks;
  }
  $('#addSectionBtn').addEventListener('click', () => {
    $('#sectionChooser').hidden = !$('#sectionChooser').hidden;
  });
  $('#addPromptBlockBtn').addEventListener('click', () => addContentBlock('prompt'));
  $('#addAboutBlockBtn').addEventListener('click', () => addContentBlock('about'));
  $('#closeEditorBtn').addEventListener('click', () => closeEditor(false));
  $('#cancelBtn').addEventListener('click', () => closeEditor(false));
  // The editor never closes by clicking outside or pressing Escape; explicit close asks before discarding.
  $('#editorModal').addEventListener('click', (event) => { if (event.target === $('#editorModal')) event.preventDefault(); });
  $('#promptForm').addEventListener('input', () => { $('#promptForm').dataset.dirty = 'true'; });
  $('#promptForm').addEventListener('change', () => { $('#promptForm').dataset.dirty = 'true'; });
  $('#promptForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('#saveBtn'); button.disabled = true; setMessage($('#saveMessage'), 'Saving prompt and ordered sections…');
    try {
      const file = $('#imageFile').files[0];
      if (file) state.imageUrl = await uploadPublicImage(file);
      const contentBlocks = await collectContentBlocks();
      const promptText = $('#promptEn').value.trim();
      const oldPrompt = state.editingPrompt || {};
      const payload = {
        title: $('#title').value.trim(), title_hi: '', type: $('#type').value, category: $('#category').value.trim() || 'General',
        prompt_en: promptText, prompt_hi: '', content_text: promptText, about_text: $('#aboutText').value.trim(), how_to_use: $('#howToUse').value.trim(),
        // Preserve legacy arrays for prompts created before the ordered section builder existed.
        prompt_variants: Array.isArray(oldPrompt.prompt_variants) ? oldPrompt.prompt_variants : [],
        related_prompts: Array.isArray(oldPrompt.related_prompts) ? oldPrompt.related_prompts : [],
        extra_sections: Array.isArray(oldPrompt.extra_sections) ? oldPrompt.extra_sections : [],
        content_blocks: contentBlocks,
        aspect_ratio: $('#aspectRatio').value.trim(), duration: $('#duration').value.trim(), image_url: state.imageUrl,
        is_trending: $('#isTrending').checked, status: $('#status').value, updated_at: new Date().toISOString()
      };
      const id = $('#promptId').value;
      const result = id ? await client.from('prompts').update(payload).eq('id', Number(id)) : await client.from('prompts').insert(payload);
      if (result.error) throw result.error;
      closeEditor(true); await loadPrompts(); toast(id ? 'Prompt updated successfully.' : 'Prompt collection added to the end of the sequence.');
    } catch (error) { setMessage($('#saveMessage'), `${error.message || 'Could not save this prompt.'} Make sure the ordered content_blocks database migration has been run.`, true); }
    finally { button.disabled = false; }
  });

  async function deletePrompt(id) {
    const prompt = state.prompts.find((p) => String(p.id) === String(id));
    if (!prompt || !window.confirm(`Delete prompt #${prompt.id} — “${prompt.title}”? This cannot be undone.`)) return;
    try {
      const { error } = await client.from('prompts').delete().eq('id', Number(id));
      if (error) throw error;
      await loadPrompts(); toast(`Prompt #${id} deleted.`);
    } catch (error) { toast(error.message || 'Could not delete prompt.', true); }
  }

  // Homepage section builder.
  function addHomeCard(data = {}) {
    state.homeCardCount += 1;
    const wrap = document.createElement('div'); wrap.className = 'home-card-editor';
    const options = state.prompts.map((p) => `<option value="${p.id}" ${Number(data.prompt_id) === Number(p.id) ? 'selected' : ''}>#${p.id} · ${escapeHtml(p.title)}</option>`).join('');
    wrap.innerHTML = `<div class="dynamic-row-head"><strong>Homepage card ${state.homeCardCount}</strong><button type="button" class="remove-dynamic">Remove</button></div>
      <div class="form-grid"><label>Card title<input class="home-card-title" required maxlength="150" value="${escapeHtml(data.title || '')}"></label><label>Linked prompt page<select class="home-card-prompt"><option value="">Choose a prompt</option>${options}</select></label>
      <label class="full-span">Short detail<input class="home-card-description" maxlength="240" value="${escapeHtml(data.description || '')}" placeholder="Short text shown under the title"></label>
      <label class="full-span">Card image (max 5 MB)<input class="home-card-file" type="file" accept="image/jpeg,image/png,image/webp,image/avif"><small class="home-card-current">${data.image_url ? `Current image: ${escapeHtml(data.image_url)}` : 'JPG, PNG, WebP or AVIF'}</small><input type="hidden" class="home-card-image-url" value="${escapeHtml(data.image_url || '')}"></label></div>`;
    wrap.querySelector('.remove-dynamic').addEventListener('click', () => wrap.remove());
    $('#homeCardList').appendChild(wrap);
  }
  function toggleHomeBuilderType() {
    const cards = $('#homeSectionType').value === 'cards';
    $('#homeCardFields').hidden = !cards; $('#homeInfoFields').hidden = cards;
  }
  $('#homeSectionType').addEventListener('change', toggleHomeBuilderType);
  $('#addHomeCardBtn').addEventListener('click', () => addHomeCard());
  function openHomeSectionEditor(section = null) {
    $('#homeSectionForm').reset(); $('#homeCardList').innerHTML = ''; state.homeCardCount = 0;
    $('#homeSectionId').value = section?.id || '';
    $('#homeModalTitle').textContent = section ? 'Edit homepage section' : 'Add homepage section';
    $('#homeSectionTitle').value = section?.title || '';
    $('#homeSectionType').value = section?.section_type || 'cards';
    $('#homeSectionPlacement').value = section?.placement || 'after_latest';
    $('#homeSectionDescription').value = section?.description || '';
    $('#homeSectionContent').value = section?.content || '';
    $('#homeSectionPublished').value = String(section?.is_published !== false);
    $('#homeSectionOrder').value = section?.sort_order ?? 0;
    (Array.isArray(section?.items) ? section.items : []).forEach(addHomeCard);
    toggleHomeBuilderType(); setMessage($('#homeSaveMessage'));
    $('#homeSectionModal').hidden = false; document.body.style.overflow = 'hidden';
  }
  function closeHomeSectionEditor() { $('#homeSectionModal').hidden = true; document.body.style.overflow = ''; $('#homeSectionForm').reset(); $('#homeCardList').innerHTML = ''; }
  $('#addHomeSectionBtn').addEventListener('click', () => openHomeSectionEditor());
  $('#closeHomeModalBtn').addEventListener('click', closeHomeSectionEditor);
  $('#cancelHomeBtn').addEventListener('click', closeHomeSectionEditor);
  $('#homeSectionModal').addEventListener('click', (event) => { if (event.target === $('#homeSectionModal')) event.preventDefault(); });
  async function collectHomeCards() {
    const items = [];
    for (const wrap of $$('.home-card-editor', $('#homeCardList'))) {
      const file = $('.home-card-file', wrap).files[0];
      let image_url = $('.home-card-image-url', wrap).value.trim();
      if (file) image_url = await uploadPublicImage(file);
      const title = $('.home-card-title', wrap).value.trim();
      const prompt_id = Number($('.home-card-prompt', wrap).value) || null;
      const description = $('.home-card-description', wrap).value.trim();
      if (!title || !prompt_id) throw new Error('Each homepage card needs a title and a linked prompt.');
      items.push({ title, description, image_url, prompt_id, button_label: 'Get Prompt' });
    }
    return items;
  }
  async function loadHomeSections() {
    const host = $('#homeSectionList');
    host.innerHTML = '<div class="content-card loading-row">Loading homepage sections…</div>';
    try {
      const { data, error } = await client.from('homepage_sections').select('*').order('placement', { ascending: true }).order('sort_order', { ascending: true }).order('id', { ascending: true });
      if (error) throw error;
      state.homeSections = data || [];
      host.innerHTML = state.homeSections.length ? state.homeSections.map((s) => `<article class="home-section-admin-card"><div><div class="home-section-meta"><span class="status-pill ${s.is_published ? 'published' : 'draft'}">${s.is_published ? 'Published' : 'Draft'}</span><span>${s.section_type === 'cards' ? `${(s.items || []).length} cards` : 'Information section'}</span><span>After: ${escapeHtml(s.placement.replace('after_', '').replaceAll('_', ' '))}</span></div><h3>${escapeHtml(s.title)}</h3><p>${escapeHtml(s.description || s.content || '')}</p></div><div class="admin-prompt-actions"><button type="button" data-edit-home-section="${s.id}">Edit</button><button type="button" class="delete-btn" data-delete-home-section="${s.id}">Delete</button></div></article>`).join('') : '<div class="content-card empty-state">No custom homepage sections yet. Add your first section.</div>';
    } catch (error) {
      host.innerHTML = `<div class="content-card empty-state">${escapeHtml(error.message)}<br><small>Run supabase/admin-upgrade-migration.sql in Supabase SQL Editor to enable Homepage Builder.</small></div>`;
    }
  }
  $('#homeSectionForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('#saveHomeSectionBtn'); button.disabled = true; setMessage($('#homeSaveMessage'), 'Saving homepage section…');
    try {
      const type = $('#homeSectionType').value;
      const items = type === 'cards' ? await collectHomeCards() : [];
      if (type === 'cards' && !items.length) throw new Error('Add at least one card to this section.');
      const payload = {
        title: $('#homeSectionTitle').value.trim(), description: $('#homeSectionDescription').value.trim(),
        placement: $('#homeSectionPlacement').value, section_type: type, content: $('#homeSectionContent').value.trim(),
        items, is_published: $('#homeSectionPublished').value === 'true', sort_order: Number($('#homeSectionOrder').value) || 0,
        updated_at: new Date().toISOString()
      };
      const id = $('#homeSectionId').value;
      const result = id ? await client.from('homepage_sections').update(payload).eq('id', Number(id)) : await client.from('homepage_sections').insert(payload);
      if (result.error) throw result.error;
      closeHomeSectionEditor(); await loadHomeSections(); toast('Homepage section saved.');
    } catch (error) { setMessage($('#homeSaveMessage'), error.message || 'Could not save this section.', true); }
    finally { button.disabled = false; }
  });
  async function deleteHomeSection(id) {
    if (!window.confirm('Delete this homepage section?')) return;
    const { error } = await client.from('homepage_sections').delete().eq('id', Number(id));
    if (error) toast(error.message, true); else { await loadHomeSections(); toast('Homepage section deleted.'); }
  }

  // Analytics uses database-backed page-view events, not invented/demo numbers.
  const number = (value) => Number(value || 0).toLocaleString();
  async function loadAnalytics() {
    $('#analyticsTotal').textContent = '…';
    try {
      const [summaryResult, yearlyResult, promptResult] = await Promise.all([
        client.rpc('get_analytics_overview'), client.rpc('get_analytics_yearly'), client.rpc('get_prompt_view_stats')
      ]);
      for (const result of [summaryResult, yearlyResult, promptResult]) if (result.error) throw result.error;
      const summary = Array.isArray(summaryResult.data) ? summaryResult.data[0] : summaryResult.data;
      state.analytics = { summary, yearly: yearlyResult.data || [], prompts: promptResult.data || [] };
      $('#analyticsTotal').textContent = number(summary.total_visitors);
      $('#analyticsToday').textContent = number(summary.today_visitors);
      $('#analyticsYesterday').textContent = number(summary.yesterday_visitors);
      $('#analyticsMonth').textContent = number(summary.month_visitors);
      $('#analyticsYear').textContent = number(summary.year_visitors);
      const years = [...new Set(state.analytics.yearly.map((r) => String(r.year)))].sort((a, b) => Number(b) - Number(a));
      $('#analyticsYearFilter').innerHTML = '<option value="all">All years</option>' + years.map((y) => `<option value="${y}">${y}</option>`).join('');
      renderYearlyAnalytics(); renderPromptAnalytics();
    } catch (error) {
      const msg = `Analytics setup is not complete yet: ${escapeHtml(error.message || 'Could not load analytics.')}. Run supabase/admin-upgrade-migration.sql in Supabase SQL Editor, then deploy the updated website.`;
      $('#yearlyAnalytics').innerHTML = `<div class="empty-state">${msg}</div>`;
      $('#promptAnalytics').innerHTML = `<div class="empty-state">${msg}</div>`;
      ['#analyticsTotal', '#analyticsToday', '#analyticsYesterday', '#analyticsMonth', '#analyticsYear'].forEach((s) => $(s).textContent = '—');
    }
  }
  function renderYearlyAnalytics() {
    const rows = state.analytics?.yearly || [];
    $('#yearlyAnalytics').innerHTML = rows.length ? `<table class="analytics-table"><thead><tr><th>Year</th><th>Visits</th><th>Unique visitors</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${escapeHtml(r.year)}</td><td>${number(r.visits)}</td><td>${number(r.visitors)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty-state">No visits have been recorded yet.</div>';
  }
  function renderPromptAnalytics() {
    const year = $('#analyticsYearFilter').value;
    let rows = state.analytics?.prompts || [];
    if (year !== 'all') rows = rows.filter((r) => String(r.year) === year);
    $('#promptAnalytics').innerHTML = rows.length ? `<table class="analytics-table"><thead><tr><th>Prompt</th><th>Year</th><th>Views</th><th>Visitors</th></tr></thead><tbody>${rows.map((r) => `<tr><td><a href="../prompt.html?id=${encodeURIComponent(r.prompt_id)}" target="_blank" rel="noopener">#${escapeHtml(r.prompt_id)} · ${escapeHtml(r.title)}</a></td><td>${escapeHtml(r.year)}</td><td>${number(r.views)}</td><td>${number(r.visitors)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty-state">No prompt page views have been recorded yet.</div>';
  }
  $('#refreshAnalyticsBtn').addEventListener('click', loadAnalytics);
  $('#analyticsYearFilter').addEventListener('change', renderPromptAnalytics);

  // Global admin event delegation.
  document.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]');
    if (action?.dataset.action === 'new-prompt') openEditor();
    if (action?.dataset.action === 'view-prompts') switchView('prompts');
    const edit = event.target.closest('[data-edit-prompt]');
    if (edit) { const prompt = state.prompts.find((p) => String(p.id) === edit.dataset.editPrompt); if (prompt) openEditor(prompt); }
    const remove = event.target.closest('[data-delete-prompt]'); if (remove) deletePrompt(remove.dataset.deletePrompt);
    const category = event.target.closest('[data-category]');
    if (category) { switchView('prompts'); $('#categoryFilter').value = category.dataset.category; state.page = 1; renderPromptList(); }
    const editHome = event.target.closest('[data-edit-home-section]');
    if (editHome) { const section = state.homeSections.find((s) => String(s.id) === editHome.dataset.editHomeSection); if (section) openHomeSectionEditor(section); }
    const deleteHome = event.target.closest('[data-delete-home-section]'); if (deleteHome) deleteHomeSection(deleteHome.dataset.deleteHomeSection);
  });

  // Startup.
  (async () => {
    if (!client) { showLogin('Supabase client did not load. Check the Supabase scripts and refresh.', true); return; }
    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (data.session?.user) { await verifyAdmin(data.session.user); showDashboard(); }
      else showLogin();
    } catch (error) { await client.auth.signOut(); showLogin(error.message || 'Unable to verify your session.', true); }
  })();
})();
