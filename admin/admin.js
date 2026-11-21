// FreePromptLibraryAI - Admin Studio Controller
// Complete Supabase Authentication, RLS Verification, and Prompt Management (CRUD)

(function () {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const client = window.supabaseClient;

  const state = {
    user: null,
    prompts: [],
    filterCategory: 'All',
    filterStatus: 'All',
    searchTerm: '',
    isUploading: false
  };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function toast(message, isError = false) {
    const element = $('#toast');
    if (!element) return;
    element.textContent = message;
    element.classList.toggle('error', isError);
    element.classList.add('show');
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => element.classList.remove('show'), 3000);
  }

  function setMessage(element, message = '', isError = false) {
    if (!element) return;
    element.textContent = message;
    element.style.color = isError ? '#f87171' : '#34d399';
  }

  // View switchers
  function showLogin(message = '', isError = true) {
    if ($('#loginView')) $('#loginView').hidden = false;
    if ($('#recoveryView')) $('#recoveryView').hidden = true;
    if ($('#dashboardView')) $('#dashboardView').hidden = true;
    if (message) setMessage($('#loginMessage'), message, isError);
  }

  function showRecovery() {
    if ($('#loginView')) $('#loginView').hidden = true;
    if ($('#recoveryView')) $('#recoveryView').hidden = false;
    if ($('#dashboardView')) $('#dashboardView').hidden = true;
  }

  function showDashboard() {
    if ($('#loginView')) $('#loginView').hidden = true;
    if ($('#recoveryView')) $('#recoveryView').hidden = true;
    if ($('#dashboardView')) $('#dashboardView').hidden = false;
    if (state.user && $('#adminEmailDisplay')) {
      $('#adminEmailDisplay').textContent = state.user.email;
    }
    loadPrompts();
  }

  // Admin Verification check against public.admin_users
  async function verifyAdmin(user) {
    if (!client || !user) throw new Error('Authentication required.');
    const { data, error } = await client
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      throw new Error('This account does not have admin permissions.');
    }
    state.user = user;
    return true;
  }

  // Load all prompts from Supabase
  async function loadPrompts() {
    if (!client) return;
    try {
      const { data, error } = await client
        .from('prompts')
        .select('*')
        .order('id', { ascending: false });

      if (error) throw error;
      state.prompts = data || [];
      updateMetrics();
      renderPromptList();
    } catch (err) {
      toast(err.message || 'Error loading prompts from database.', true);
    }
  }

  function updateMetrics() {
    const list = state.prompts;
    if ($('#metricTotal')) $('#metricTotal').textContent = list.length;
    if ($('#metricPhoto')) $('#metricPhoto').textContent = list.filter(p => p.type === 'Photo').length;
    if ($('#metricVideo')) $('#metricVideo').textContent = list.filter(p => p.type === 'Video').length;
    if ($('#metricTrending')) $('#metricTrending').textContent = list.filter(p => p.is_trending).length;
  }

  function getFilteredPrompts() {
    return state.prompts.filter(item => {
      if (state.filterCategory !== 'All' && item.category !== state.filterCategory) return false;
      if (state.filterStatus !== 'All' && item.status !== state.filterStatus) return false;
      if (state.searchTerm.trim() !== '') {
        const query = state.searchTerm.toLowerCase();
        const matchTitle = (item.title || '').toLowerCase().includes(query);
        const matchPrompt = (item.prompt_en || '').toLowerCase().includes(query);
        const matchCategory = (item.category || '').toLowerCase().includes(query);
        if (!matchTitle && !matchPrompt && !matchCategory) return false;
      }
      return true;
    });
  }

  function renderPromptList() {
    const tbody = $('#promptRows');
    if (!tbody) return;

    const filtered = getFilteredPrompts();

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 3rem; color: var(--text-muted);">
            No prompts found matching your filters.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(item => `
      <tr>
        <td style="font-weight: 700; color: var(--text-dim);">${item.id}</td>
        <td>
          <strong style="color: #fff;">${escapeHtml(item.title)}</strong>
        </td>
        <td>
          <span class="status-pill" style="background: rgba(255,255,255,0.06); color: #c4b5fd;">
            ${escapeHtml(item.type)}
          </span>
        </td>
        <td>${escapeHtml(item.category)}</td>
        <td style="color: var(--text-muted); font-size: 0.85rem;">${escapeHtml(item.aspect_ratio || 'N/A')}</td>
        <td>
          <span class="status-pill status-${item.status === 'published' ? 'published' : 'draft'}">
            ${escapeHtml(item.status)}
          </span>
        </td>
        <td>${item.is_trending ? '🔥 Yes' : '—'}</td>
        <td style="text-align: right;">
          <button class="btn btn-secondary btn-sm" data-edit-prompt="${item.id}" type="button">Edit</button>
          <button class="btn btn-danger btn-sm" data-delete-prompt="${item.id}" type="button" style="margin-left: 0.4rem;">Delete</button>
        </td>
      </tr>
    `).join('');
  }

  // Prompt Editor Modal
  function openEditor(prompt = null) {
    const modal = $('#editorModal');
    if (!modal) return;

    if (prompt) {
      $('#modalTitle').textContent = `Edit Prompt #${prompt.id}`;
      $('#promptId').value = prompt.id;
      $('#promptTitle').value = prompt.title || '';
      $('#promptType').value = prompt.type || 'Photo';
      $('#promptCategory').value = prompt.category || '';
      $('#promptAspect').value = prompt.aspect_ratio || '4:5';
      $('#promptDuration').value = prompt.duration || '';
      $('#promptImageUrl').value = prompt.image_url || '';
      $('#promptStatus').value = prompt.status || 'published';
      $('#promptTrending').checked = Boolean(prompt.is_trending);
      $('#promptEn').value = prompt.prompt_en || '';
      $('#promptHi').value = prompt.prompt_hi || prompt.how_to_use_hi || '';
    } else {
      $('#modalTitle').textContent = 'Create New Prompt';
      $('#promptForm').reset();
      $('#promptId').value = '';
      $('#promptAspect').value = '4:5';
      $('#promptStatus').value = 'published';
    }

    modal.hidden = false;
  }

  function closeEditor() {
    const modal = $('#editorModal');
    if (modal) modal.hidden = true;
  }

  // Upload image to Supabase Storage bucket 'prompt-images'
  async function uploadImageFile(file) {
    if (!file || !client) return '';
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const filePath = `prompts/${fileName}`;

    const { error: uploadError } = await client.storage
      .from('prompt-images')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = client.storage
      .from('prompt-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  // Save Prompt (Create / Update)
  async function handleSavePrompt(e) {
    e.preventDefault();
    if (!client) return;

    const btn = $('#btnSavePrompt');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      let imageUrl = $('#promptImageUrl').value.trim();
      const fileInput = $('#promptImageFile');

      if (fileInput && fileInput.files && fileInput.files[0]) {
        btn.textContent = 'Uploading image...';
        imageUrl = await uploadImageFile(fileInput.files[0]);
      }

      const id = $('#promptId').value;
      const payload = {
        title: $('#promptTitle').value.trim(),
        type: $('#promptType').value,
        category: $('#promptCategory').value.trim(),
        aspect_ratio: $('#promptAspect').value.trim(),
        duration: $('#promptDuration').value.trim(),
        image_url: imageUrl,
        status: $('#promptStatus').value,
        is_trending: $('#promptTrending').checked,
        prompt_en: $('#promptEn').value.trim(),
        prompt_hi: $('#promptHi').value.trim(),
        updated_at: new Date().toISOString()
      };

      if (id) {
        // Update
        const { error } = await client
          .from('prompts')
          .update(payload)
          .eq('id', Number(id));
        if (error) throw error;
        toast(`Prompt #${id} updated successfully!`);
      } else {
        // Insert
        const { error } = await client
          .from('prompts')
          .insert([payload]);
        if (error) throw error;
        toast('New prompt published successfully!');
      }

      closeEditor();
      await loadPrompts();
    } catch (err) {
      toast(err.message || 'Failed to save prompt.', true);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save & Publish';
    }
  }

  // Delete Prompt
  async function deletePrompt(id) {
    if (!confirm(`Are you sure you want to delete prompt #${id}? This action cannot be undone.`)) {
      return;
    }
    if (!client) return;

    try {
      const { error } = await client
        .from('prompts')
        .delete()
        .eq('id', Number(id));

      if (error) throw error;
      toast(`Prompt #${id} deleted.`);
      await loadPrompts();
    } catch (err) {
      toast(err.message || 'Could not delete prompt.', true);
    }
  }

  // Event Listeners setup
  function setupEvents() {
    // Login Form
    const loginForm = $('#loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        setMessage($('#loginMessage'), 'Signing in...');
        const email = $('#loginEmail').value.trim();
        const password = $('#loginPassword').value;

        try {
          const { data, error } = await client.auth.signInWithPassword({ email, password });
          if (error) throw error;
          await verifyAdmin(data.user);
          showDashboard();
        } catch (err) {
          setMessage($('#loginMessage'), err.message || 'Invalid login credentials.', true);
        }
      });
    }

    // Forgot password
    if ($('#forgotPasswordBtn')) {
      $('#forgotPasswordBtn').addEventListener('click', showRecovery);
    }
    if ($('#backToLoginBtn')) {
      $('#backToLoginBtn').addEventListener('click', () => showLogin('', false));
    }

    // Password Recovery Form
    const recoveryForm = $('#recoveryForm');
    if (recoveryForm) {
      recoveryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        setMessage($('#recoveryMessage'), 'Sending reset link...');
        const email = $('#recoveryEmail').value.trim();
        try {
          const { error } = await client.auth.resetPasswordForEmail(email);
          if (error) throw error;
          setMessage($('#recoveryMessage'), 'Reset email sent! Please check your inbox.', false);
        } catch (err) {
          setMessage($('#recoveryMessage'), err.message || 'Could not send reset email.', true);
        }
      });
    }

    // Logout
    if ($('#btnLogout')) {
      $('#btnLogout').addEventListener('click', async () => {
        if (client) await client.auth.signOut();
        state.user = null;
        showLogin('You have been signed out.', false);
      });
    }

    // New Prompt buttons
    $$('[data-action="new-prompt"]').forEach(btn => {
      btn.addEventListener('click', () => openEditor());
    });

    // Close Modal buttons
    if ($('#btnCloseModal')) $('#btnCloseModal').addEventListener('click', closeEditor);
    if ($('#btnCancelPrompt')) $('#btnCancelPrompt').addEventListener('click', closeEditor);

    // Save Prompt
    const promptForm = $('#promptForm');
    if (promptForm) {
      promptForm.addEventListener('submit', handleSavePrompt);
    }

    // Search and Category filters
    const searchInput = $('#searchPromptInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchTerm = e.target.value;
        renderPromptList();
      });
    }

    const catFilter = $('#categoryFilter');
    if (catFilter) {
      catFilter.addEventListener('change', (e) => {
        state.filterCategory = e.target.value;
        renderPromptList();
      });
    }

    const statusFilter = $('#statusFilter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        state.filterStatus = e.target.value;
        renderPromptList();
      });
    }

    // Table Actions (Edit / Delete) via event delegation
    const tbody = $('#promptRows');
    if (tbody) {
      tbody.addEventListener('click', (e) => {
        const editBtn = e.target.closest('[data-edit-prompt]');
        if (editBtn) {
          const id = editBtn.getAttribute('data-edit-prompt');
          const prompt = state.prompts.find(p => String(p.id) === String(id));
          if (prompt) openEditor(prompt);
          return;
        }

        const deleteBtn = e.target.closest('[data-delete-prompt]');
        if (deleteBtn) {
          const id = deleteBtn.getAttribute('data-delete-prompt');
          deletePrompt(id);
        }
      });
    }
  }

  // Startup verification
  async function init() {
    setupEvents();

    if (!client) {
      showLogin('Supabase client did not initialize. Please verify network connection.', true);
      return;
    }

    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;

      if (data.session && data.session.user) {
        await verifyAdmin(data.session.user);
        showDashboard();
      } else {
        showLogin('', false);
      }
    } catch (err) {
      await client.auth.signOut();
      showLogin(err.message || 'Session expired. Please sign in.', true);
    }
  }

  document.addEventListener('DOMContentLoaded', init);

})();
