(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const client = window.supabaseClient;
  const PAGE_SIZE = 18;

  const state = {
    user: null,
    prompts: [],
    page: 1,
    pageSize: PAGE_SIZE,
    view: 'overview',
    imageUrl: '',
    sectionCount: 0,
    recoveryEmail: '',
    resendTimer: null,
    otpVerificationInProgress: false,
    recoveryLinkInProgress: false
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
    toastTimer = setTimeout(() => element.classList.remove('show'), 3200);
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
    if (state.resendTimer) {
      clearInterval(state.resendTimer);
      state.resendTimer = null;
    }
    $('#recoveryRequestForm').reset();
    $('#recoveryOtpForm').reset();
    $('#recoveryPasswordForm').reset();
    $('#recoveryIntro').textContent = 'Enter your admin email. We will send a verification code or secure reset link.';
    setMessage($('#recoveryRequestMessage'));
    setMessage($('#recoveryOtpMessage'));
    setMessage($('#recoveryPasswordMessage'));
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
      } else {
        button.textContent = `Resend code in ${remaining}s`;
      }
    }, 1000);
  }

  async function verifyAdmin(user) {
    const { data, error } = await client.from('admin_users')
      .select('user_id').eq('user_id', user.id).maybeSingle();
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

  // -------- Login and account recovery --------
  $('#loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.submitter || $('#loginForm button[type="submit"]');
    button.disabled = true;
    setMessage($('#loginMessage'), 'Signing in…');
    try {
      if (!client) throw new Error('Supabase could not be loaded. Refresh the page and try again.');
      const { data, error } = await client.auth.signInWithPassword({
        email: $('#loginEmail').value.trim(),
        password: $('#loginPassword').value
      });
      if (error) throw error;
      await verifyAdmin(data.user);
      setMessage($('#loginMessage'));
      showDashboard();
    } catch (error) {
      if (client) await client.auth.signOut();
      setMessage($('#loginMessage'), error.message || 'Unable to sign in.', true);
    } finally {
      button.disabled = false;
    }
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
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/admin/`
      });
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
      if (button.id === 'resendOtpBtn') {
        if (!state.resendTimer) startResendCooldown(60);
      } else {
        button.disabled = false;
      }
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
    if (!/^\d{6,8}$/.test(token)) {
      setMessage($('#recoveryOtpMessage'), 'Enter the 6–8 digit code from your email.', true);
      return;
    }
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
    } finally {
      state.otpVerificationInProgress = false;
      button.disabled = false;
    }
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
    if (password.length < 8) {
      setMessage($('#recoveryPasswordMessage'), 'Use a password with at least 8 characters.', true);
      return;
    }
    if (password !== confirmPassword) {
      setMessage($('#recoveryPasswordMessage'), 'The passwords do not match.', true);
      return;
    }
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
      showLogin();
      setMessage($('#loginMessage'), 'Password changed successfully. Sign in with your new password.');
    } catch (error) {
      setMessage($('#recoveryPasswordMessage'), error.message || 'Could not update the password.', true);
    } finally {
      button.disabled = false;
    }
  });

  if (client) {
    client.auth.onAuthStateChange((event, session) => {
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
          await client.auth.signOut();
          resetRecovery();
          showLogin(error.message || 'This account is not authorised to reset the admin password.');
        } finally {
          state.recoveryLinkInProgress = false;
        }
      }, 0);
    });
  }

  // -------- Navigation and shared data --------
  function switchView(view) {
    state.view = view;
    $$('.view-panel').forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === view));
    $$('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
    const titles = { overview: 'Overview', prompts: 'All prompts', categories: 'Categories', media: 'Media library' };
    $('#breadcrumbTitle').textContent = titles[view] || 'Overview';
    $('#sidebar').classList.remove('open');
    if (view === 'prompts') renderPromptList();
    if (view === 'categories') renderCategories();
    if (view === 'media') renderMedia();
  }

  $$('.nav-item, [data-view]').forEach((button) => {
    button.addEventListener('click', () => switchView(button.dataset.view));
  });
  $('#mobileMenuButton').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  $('#signOutBtn').addEventListener('click', async () => {
    await client.auth.signOut();
    state.user = null;
    showLogin('You have signed out.', false);
  });

  function updateMetrics() {
    const prompts = state.prompts;
    const published = prompts.filter((prompt) => prompt.status === 'published').length;
    const drafts = prompts.filter((prompt) => prompt.status === 'draft').length;
    const trending = prompts.filter((prompt) => prompt.is_trending).length;
    $('#totalCount').textContent = prompts.length;
    $('#publishedCount').textContent = published;
    $('#draftCount').textContent = drafts;
    $('#trendingCount').textContent = trending;
    $('#navPromptCount').textContent = prompts.length;

    const photo = prompts.filter((prompt) => prompt.type === 'Photo').length;
    const video = prompts.filter((prompt) => prompt.type === 'Video').length;
    const max = Math.max(prompts.length, 1);
    $('#typeBreakdown').innerHTML = `
      <div class="breakdown-line"><span>Photo</span><div class="bar-track"><div class="bar-fill" style="width:${(photo / max) * 100}%"></div></div><b>${photo}</b></div>
      <div class="breakdown-line"><span>Video</span><div class="bar-track"><div class="bar-fill video" style="width:${(video / max) * 100}%"></div></div><b>${video}</b></div>`;
  }

  function renderSequencePreview() {
    // The public library begins with prompt IDs 1, 2, 3. Keep this same ascending sequence in Admin.
    const preview = [...state.prompts].sort((a, b) => Number(a.id) - Number(b.id)).slice(0, 6);
    $('#sequencePreview').innerHTML = preview.length ? preview.map((prompt) => `
      <div class="sequence-item">
        <span class="sequence-number">${escapeHtml(prompt.id)}</span>
        <span class="sequence-title"><strong>${escapeHtml(prompt.title)}</strong><small>${escapeHtml(prompt.category || 'General')}</small></span>
        <span class="type-pill ${prompt.type === 'Video' ? 'video' : ''}">${escapeHtml(prompt.type)}</span>
        <button class="sequence-edit" type="button" data-edit-prompt="${escapeHtml(prompt.id)}">Edit</button>
      </div>`).join('') : '<div class="empty-state">No prompts available yet.</div>';
  }

  async function loadPrompts() {
    $('#sequencePreview').innerHTML = '<div class="loading-row">Loading your prompt sequence…</div>';
    $('#promptRows').innerHTML = '<tr><td colspan="7" class="loading-row">Loading prompts…</td></tr>';
    try {
      const { data, error } = await client.from('prompts').select('*').order('id', { ascending: true });
      if (error) throw error;
      state.prompts = (data || []).sort((a, b) => Number(a.id) - Number(b.id));
      updateMetrics();
      renderSequencePreview();
      populateCategoryFilters();
      renderPromptList();
      renderCategories();
      renderMedia();
    } catch (error) {
      const message = escapeHtml(error.message || 'Unable to load prompts.');
      $('#sequencePreview').innerHTML = `<div class="empty-state">${message}</div>`;
      $('#promptRows').innerHTML = `<tr><td colspan="7" class="empty-state">${message}</td></tr>`;
      toast(`Could not load prompts: ${error.message}`, true);
    }
  }

  function filteredPrompts() {
    const search = $('#promptSearch').value.trim().toLowerCase();
    const type = $('#typeFilter').value;
    const status = $('#statusFilter').value;
    const category = $('#categoryFilter').value;
    return state.prompts.filter((prompt) => {
      if (type !== 'all' && prompt.type !== type) return false;
      if (status !== 'all' && prompt.status !== status) return false;
      if (category !== 'all' && prompt.category !== category) return false;
      if (!search) return true;
      const haystack = [prompt.id, prompt.title, prompt.title_hi, prompt.category, prompt.type, prompt.prompt_en, prompt.prompt_hi].join(' ').toLowerCase();
      return haystack.includes(search);
    }).sort((a, b) => Number(a.id) - Number(b.id));
  }

  function renderPagination(totalPages) {
    const nav = $('#adminPagination');
    if (totalPages <= 1) { nav.innerHTML = ''; return; }
    let html = `<button type="button" data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''}>‹</button>`;
    for (let page = 1; page <= totalPages; page += 1) {
      html += `<button type="button" data-page="${page}" class="${page === state.page ? 'active' : ''}" ${page === state.page ? 'aria-current="page"' : ''}>${page}</button>`;
    }
    html += `<button type="button" data-page="${state.page + 1}" ${state.page === totalPages ? 'disabled' : ''}>›</button>`;
    nav.innerHTML = html;
  }

  function renderPromptList() {
    if (!$('#promptRows')) return;
    const filtered = filteredPrompts();
    const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
    state.page = Math.min(state.page, totalPages);
    const start = (state.page - 1) * state.pageSize;
    const pageItems = filtered.slice(start, start + state.pageSize);
    $('#promptRows').innerHTML = pageItems.length ? pageItems.map((prompt) => `
      <tr>
        <td><span class="prompt-no">${escapeHtml(prompt.id)}</span></td>
        <td><div class="prompt-name"><strong>${escapeHtml(prompt.title)}</strong><small>${escapeHtml(prompt.title_hi || prompt.prompt_en?.slice(0, 70) || '')}</small></div></td>
        <td><span class="type-pill ${prompt.type === 'Video' ? 'video' : ''}">${escapeHtml(prompt.type)}</span></td>
        <td>${escapeHtml(prompt.category || 'General')}</td>
        <td><span class="status-pill ${escapeHtml(prompt.status)}">${escapeHtml(prompt.status)}</span></td>
        <td>${prompt.is_trending ? '<span class="status-pill published">Featured</span>' : '<span class="muted-dash">—</span>'}</td>
        <td><div class="row-actions"><button type="button" data-edit-prompt="${escapeHtml(prompt.id)}">Edit</button><button type="button" class="delete-btn" data-delete-prompt="${escapeHtml(prompt.id)}">Delete</button></div></td>
      </tr>`).join('') : '<tr><td colspan="7" class="empty-state">No prompts match these filters.</td></tr>';
    const shownStart = filtered.length ? start + 1 : 0;
    const shownEnd = Math.min(start + state.pageSize, filtered.length);
    $('#listSummary').textContent = `Showing ${shownStart}–${shownEnd} of ${filtered.length} prompts · ordered by prompt number`;
    renderPagination(totalPages);
  }

  function populateCategoryFilters() {
    const categories = [...new Set(state.prompts.map((prompt) => prompt.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const current = $('#categoryFilter').value;
    $('#categoryFilter').innerHTML = '<option value="all">All categories</option>' + categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
    if (categories.includes(current)) $('#categoryFilter').value = current;
    $('#categorySuggestions').innerHTML = categories.map((category) => `<option value="${escapeHtml(category)}"></option>`).join('');
  }

  function renderCategories() {
    const counts = new Map();
    state.prompts.forEach((prompt) => {
      const category = prompt.category || 'General';
      counts.set(category, (counts.get(category) || 0) + 1);
    });
    const categories = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    $('#categoryGrid').innerHTML = categories.length ? categories.map(([name, count]) => `
      <button class="category-card" type="button" data-category="${escapeHtml(name)}">
        <span><strong>${escapeHtml(name)}</strong><small>${count} ${count === 1 ? 'prompt' : 'prompts'} · Open prompt list</small></span>
        <span class="category-count">${count}</span>
      </button>`).join('') : '<div class="content-card empty-state">No categories yet.</div>';
  }

  function renderMedia() {
    const images = state.prompts.filter((prompt) => prompt.image_url);
    $('#mediaCount').textContent = `${images.length} ${images.length === 1 ? 'image' : 'images'}`;
    $('#mediaGrid').innerHTML = images.length ? images.map((prompt) => `
      <article class="media-card">
        <div class="media-thumb"><img src="${escapeHtml(prompt.image_url)}" alt="${escapeHtml(prompt.title)}" loading="lazy"></div>
        <div class="media-info"><strong>${escapeHtml(prompt.title)}</strong><small>Prompt #${escapeHtml(prompt.id)} · ${escapeHtml(prompt.type)}</small><button class="media-open" type="button" data-edit-prompt="${escapeHtml(prompt.id)}">Edit image ↗</button></div>
      </article>`).join('') : '<div class="content-card empty-state">No sample images have been uploaded yet. Add an image while editing a prompt.</div>';
  }

  $('#promptSearch').addEventListener('input', () => { state.page = 1; renderPromptList(); });
  ['#typeFilter', '#statusFilter', '#categoryFilter'].forEach((selector) => $(selector).addEventListener('change', () => { state.page = 1; renderPromptList(); }));
  $('#adminPagination').addEventListener('click', (event) => {
    const button = event.target.closest('[data-page]');
    if (!button || button.disabled) return;
    const page = Number(button.dataset.page);
    if (!Number.isInteger(page) || page < 1) return;
    state.page = page;
    renderPromptList();
  });

  // -------- Prompt editor and content management --------
  function openEditor(prompt = null) {
    resetEditorForm();
    $('#editorModal').hidden = false;
    document.body.style.overflow = 'hidden';
    $('#editorTitle').textContent = prompt ? 'Edit prompt' : 'Create a prompt';
    $('#editorSequence').textContent = prompt ? `· PROMPT #${prompt.id}` : '· NEW ITEM';
    if (prompt) {
      $('#promptId').value = prompt.id;
      $('#title').value = prompt.title || '';
      $('#titleHi').value = prompt.title_hi || '';
      $('#type').value = prompt.type || 'Photo';
      $('#category').value = prompt.category || '';
      $('#promptEn').value = prompt.prompt_en || '';
      $('#promptHi').value = prompt.prompt_hi || '';
      $('#aspectRatio').value = prompt.aspect_ratio || '';
      $('#duration').value = prompt.duration || '';
      $('#status').value = prompt.status || 'draft';
      $('#isTrending').checked = !!prompt.is_trending;
      state.imageUrl = prompt.image_url || '';
      showCurrentImage(state.imageUrl);
      (Array.isArray(prompt.extra_sections) ? prompt.extra_sections : []).forEach(addExtraSection);
    }
    setTimeout(() => $('#title').focus(), 40);
  }

  function resetEditorForm() {
    $('#promptForm').reset();
    $('#promptId').value = '';
    state.imageUrl = '';
    state.sectionCount = 0;
    $('#extraSectionList').innerHTML = '';
    $('#editorSequence').textContent = '';
    $('#imageFile').value = '';
    showCurrentImage('');
    setMessage($('#saveMessage'));
  }

  function closeEditor() {
    $('#editorModal').hidden = true;
    document.body.style.overflow = '';
    resetEditorForm();
  }

  function showCurrentImage(url) {
    const line = $('#currentImage');
    if (!url) {
      line.textContent = 'No sample image selected.';
      return;
    }
    line.innerHTML = `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">Current sample image · Open preview ↗</a>`;
  }

  function addExtraSection(data = {}) {
    state.sectionCount += 1;
    const wrap = document.createElement('div');
    wrap.className = 'extra-editor';
    wrap.innerHTML = `
      <div class="extra-editor-top"><strong>Detail section ${state.sectionCount}</strong><button type="button" data-move="up" title="Move section up">↑</button><button type="button" data-move="down" title="Move section down">↓</button><button type="button" class="remove-section">Remove</button></div>
      <label>Heading (English)<input class="heading-en" maxlength="150" value="${escapeHtml(data.heading_en || '')}" placeholder="Section heading"></label>
      <label>Heading (Hindi)<input class="heading-hi" maxlength="150" value="${escapeHtml(data.heading_hi || '')}" placeholder="हिंदी शीर्षक"></label>
      <label class="full-span">Content (English)<textarea class="content-en" rows="3">${escapeHtml(data.content_en || data.paragraph_en || '')}</textarea></label>
      <label class="full-span">Content (Hindi)<textarea class="content-hi" rows="3">${escapeHtml(data.content_hi || data.paragraph_hi || '')}</textarea></label>
      <label class="full-span">Optional image URL<input class="section-image" type="url" placeholder="https://…" value="${escapeHtml(data.image_url || '')}"></label>`;
    wrap.querySelector('.remove-section').addEventListener('click', () => wrap.remove());
    wrap.querySelectorAll('[data-move]').forEach((button) => button.addEventListener('click', () => {
      const list = $('#extraSectionList');
      if (button.dataset.move === 'up' && wrap.previousElementSibling) list.insertBefore(wrap, wrap.previousElementSibling);
      if (button.dataset.move === 'down' && wrap.nextElementSibling) list.insertBefore(wrap.nextElementSibling, wrap);
    }));
    $('#extraSectionList').appendChild(wrap);
  }

  function getExtraSections() {
    return $$('.extra-editor', $('#extraSectionList')).map((wrap) => ({
      heading_en: $('.heading-en', wrap).value.trim(),
      heading_hi: $('.heading-hi', wrap).value.trim(),
      content_en: $('.content-en', wrap).value.trim(),
      content_hi: $('.content-hi', wrap).value.trim(),
      image_url: $('.section-image', wrap).value.trim()
    })).filter((section) => Object.values(section).some(Boolean));
  }

  async function uploadImage(file) {
    if (!file) return state.imageUrl;
    if (file.size > 5 * 1024 * 1024) throw new Error('Image must be 5 MB or smaller.');
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (!allowed.includes(file.type)) throw new Error('Use a JPG, PNG, WebP or AVIF image.');
    const extension = (file.name.split('.').pop() || 'webp').toLowerCase().replace(/[^a-z0-9]/g, '') || 'webp';
    const unique = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const path = `${Date.now()}-${unique}.${extension}`;
    const { error } = await client.storage.from('prompt-images').upload(path, file, {
      upsert: false, contentType: file.type, cacheControl: '31536000'
    });
    if (error) throw error;
    return client.storage.from('prompt-images').getPublicUrl(path).data.publicUrl;
  }

  $('#promptForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('#saveBtn');
    button.disabled = true;
    setMessage($('#saveMessage'), 'Saving prompt…');
    try {
      const imageUrl = await uploadImage($('#imageFile').files[0]);
      const payload = {
        title: $('#title').value.trim(),
        title_hi: $('#titleHi').value.trim(),
        type: $('#type').value,
        category: $('#category').value.trim() || 'General',
        prompt_en: $('#promptEn').value.trim(),
        prompt_hi: $('#promptHi').value.trim(),
        aspect_ratio: $('#aspectRatio').value.trim(),
        duration: $('#duration').value.trim(),
        image_url: imageUrl,
        is_trending: $('#isTrending').checked,
        status: $('#status').value,
        extra_sections: getExtraSections(),
        updated_at: new Date().toISOString()
      };
      const id = $('#promptId').value;
      const result = id
        ? await client.from('prompts').update(payload).eq('id', Number(id))
        : await client.from('prompts').insert(payload);
      if (result.error) throw result.error;
      closeEditor();
      await loadPrompts();
      toast(id ? 'Prompt updated successfully.' : 'New prompt added to the end of the sequence.');
    } catch (error) {
      setMessage($('#saveMessage'), error.message || 'Could not save this prompt.', true);
    } finally {
      button.disabled = false;
    }
  });

  $('#addSectionBtn').addEventListener('click', () => addExtraSection());
  $('#closeEditorBtn').addEventListener('click', closeEditor);
  $('#cancelBtn').addEventListener('click', closeEditor);
  $('#editorModal').addEventListener('click', (event) => { if (event.target === $('#editorModal')) closeEditor(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !$('#editorModal').hidden) closeEditor(); });

  async function deletePrompt(id) {
    const prompt = state.prompts.find((item) => String(item.id) === String(id));
    if (!prompt) return;
    const approved = window.confirm(`Delete prompt #${prompt.id} — “${prompt.title}”? This cannot be undone.`);
    if (!approved) return;
    try {
      const { error } = await client.from('prompts').delete().eq('id', Number(id));
      if (error) throw error;
      await loadPrompts();
      toast(`Prompt #${id} deleted.`);
    } catch (error) {
      toast(error.message || 'Could not delete prompt.', true);
    }
  }

  document.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]');
    if (action?.dataset.action === 'new-prompt') openEditor();
    if (action?.dataset.action === 'view-prompts') switchView('prompts');

    const edit = event.target.closest('[data-edit-prompt]');
    if (edit) {
      const prompt = state.prompts.find((item) => String(item.id) === edit.dataset.editPrompt);
      if (prompt) openEditor(prompt);
    }
    const remove = event.target.closest('[data-delete-prompt]');
    if (remove) deletePrompt(remove.dataset.deletePrompt);
    const category = event.target.closest('[data-category]');
    if (category) {
      switchView('prompts');
      $('#categoryFilter').value = category.dataset.category;
      state.page = 1;
      renderPromptList();
    }
  });

  // -------- Start-up --------
  (async () => {
    if (!client) {
      showLogin('Supabase client did not load. Check the Supabase scripts and refresh.', true);
      return;
    }
    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (data.session?.user) {
        await verifyAdmin(data.session.user);
        showDashboard();
      } else {
        showLogin();
      }
    } catch (error) {
      await client.auth.signOut();
      showLogin(error.message || 'Unable to verify your session.', true);
    }
  })();
})();
