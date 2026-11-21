(() => {
  const $ = (s) => document.querySelector(s);
  const client = window.supabaseClient;
  const loginView = $('#loginView'), dashboardView = $('#dashboardView');
  let currentUser = null, allPrompts = [], currentImageUrl = '', sectionCounter = 0;
  const showMessage = (el, text, error=false) => { el.textContent=text; el.classList.toggle('error',error); };
  const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function showLogin(message='') { loginView.hidden=false; dashboardView.hidden=true; if(message) showMessage($('#loginMessage'),message,true); }
  function showDashboard() { loginView.hidden=true; dashboardView.hidden=false; $('#signedInAs').textContent=currentUser?.email || ''; loadPrompts(); }
  async function verifyAdmin(user) {
    const {data,error}=await client.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();
    if(error) throw new Error('Admin permission check failed. Run supabase/setup.sql and confirm your admin_users row exists. '+error.message);
    if(!data) throw new Error('This account is not registered as an admin. Ask the project owner to add it to admin_users.');
    currentUser=user;
  }
  $('#loginForm').addEventListener('submit',async(event)=>{
    event.preventDefault(); const btn=event.submitter; btn.disabled=true; showMessage($('#loginMessage'),'Signing in…');
    try { const {data,error}=await client.auth.signInWithPassword({email:$('#loginEmail').value.trim(),password:$('#loginPassword').value}); if(error) throw error; await verifyAdmin(data.user); showDashboard(); }
    catch(error){ await client.auth.signOut(); showMessage($('#loginMessage'),error.message || 'Unable to sign in.',true); }
    finally{btn.disabled=false;}
  });
  $('#signOutBtn').addEventListener('click',async()=>{await client.auth.signOut();currentUser=null;showLogin('You have signed out.');});
  async function loadPrompts(){
    $('#promptRows').innerHTML='<tr><td colspan="5">Loading prompts…</td></tr>';
    const {data,error}=await client.from('prompts').select('*').order('id',{ascending:false});
    if(error){$('#promptRows').innerHTML=`<tr><td colspan="5">${escapeHtml(error.message)} — check that supabase/setup.sql has been run.</td></tr>`;return;}
    allPrompts=data||[];
    $('#totalCount').textContent=allPrompts.length;
    $('#publishedCount').textContent=allPrompts.filter(p=>p.status==='published').length;
    $('#draftCount').textContent=allPrompts.filter(p=>p.status==='draft').length;
    $('#promptRows').innerHTML=allPrompts.length?allPrompts.map(p=>`<tr><td><strong>${escapeHtml(p.title)}</strong><small>${escapeHtml(p.category)} · #${p.id}</small></td><td>${escapeHtml(p.type)}</td><td><span class="tag ${p.status}">${escapeHtml(p.status)}</span></td><td>${p.is_trending?'Yes':'—'}</td><td><div class="row-actions"><button type="button" data-edit="${p.id}">Edit</button><button type="button" class="delete" data-delete="${p.id}">Delete</button></div></td></tr>`).join(''):'<tr><td colspan="5">No prompts yet. Add your first prompt.</td></tr>';
  }
  $('#promptRows').addEventListener('click',async(event)=>{
    const edit=event.target.closest('[data-edit]'), del=event.target.closest('[data-delete]');
    if(edit){const item=allPrompts.find(p=>String(p.id)===edit.dataset.edit);if(item) openEditor(item);}
    if(del){const item=allPrompts.find(p=>String(p.id)===del.dataset.delete);if(!item)return;if(!confirm(`Delete “${item.title}”? This cannot be undone.`))return;const {error}=await client.from('prompts').delete().eq('id',item.id);if(error)alert(error.message);else loadPrompts();}
  });
  function resetForm(){ $('#promptForm').reset();$('#promptId').value='';currentImageUrl='';$('#currentImage').textContent='';$('#extraSectionList').innerHTML='';$('#saveMessage').textContent='';sectionCounter=0; }
  function addSection(data={}){
    sectionCounter++;const id=sectionCounter;const wrap=document.createElement('div');wrap.className='extra-editor';wrap.dataset.sectionId=id;
    wrap.innerHTML=`<div class="section-top"><strong>Detail section ${id}</strong><button type="button" class="row-actions remove-section">Remove</button></div>
      <label>Heading (English)<input class="heading-en" maxlength="150" value="${escapeHtml(data.heading_en||'')}"></label>
      <label>Heading (Hindi)<input class="heading-hi" maxlength="150" value="${escapeHtml(data.heading_hi||'')}"></label>
      <label class="wide">Content (English)<textarea class="content-en" rows="3">${escapeHtml(data.content_en||data.paragraph_en||'')}</textarea></label>
      <label class="wide">Content (Hindi)<textarea class="content-hi" rows="3">${escapeHtml(data.content_hi||data.paragraph_hi||'')}</textarea></label>
      <label class="wide">Optional image URL<input class="section-image" type="url" placeholder="https://…" value="${escapeHtml(data.image_url||'')}"></label>`;
    wrap.querySelector('.remove-section').addEventListener('click',()=>wrap.remove());$('#extraSectionList').appendChild(wrap);
  }
  function getSections(){return [...document.querySelectorAll('.extra-editor')].map(w=>({heading_en:w.querySelector('.heading-en').value.trim(),heading_hi:w.querySelector('.heading-hi').value.trim(),content_en:w.querySelector('.content-en').value.trim(),content_hi:w.querySelector('.content-hi').value.trim(),image_url:w.querySelector('.section-image').value.trim()})).filter(s=>s.heading_en||s.heading_hi||s.content_en||s.content_hi||s.image_url);}
  function openEditor(item=null){resetForm();$('#editorCard').hidden=false;$('#editorTitle').textContent=item?'Edit prompt':'Add new prompt';if(item){$('#promptId').value=item.id;$('#title').value=item.title||'';$('#titleHi').value=item.title_hi||'';$('#type').value=item.type||'Photo';$('#category').value=item.category||'';$('#promptEn').value=item.prompt_en||'';$('#promptHi').value=item.prompt_hi||'';$('#aspectRatio').value=item.aspect_ratio||'';$('#duration').value=item.duration||'';$('#status').value=item.status||'draft';$('#isTrending').checked=!!item.is_trending;currentImageUrl=item.image_url||'';$('#currentImage').textContent=currentImageUrl?'Current image is saved. Upload a new one to replace it.':'';(item.extra_sections||[]).forEach(addSection);}$('#editorCard').scrollIntoView({behavior:'smooth',block:'start'});}
  $('#newPromptBtn').addEventListener('click',()=>openEditor());$('#addSectionBtn').addEventListener('click',()=>addSection());
  function closeEditor(){ $('#editorCard').hidden=true; resetForm(); }
  $('#closeEditorBtn').addEventListener('click',closeEditor);$('#cancelBtn').addEventListener('click',closeEditor);
  async function uploadImage(file){if(!file)return currentImageUrl;if(file.size>5*1024*1024)throw new Error('Image must be 5 MB or smaller.');if(!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type))throw new Error('Use JPG, PNG, WebP or AVIF image.');const ext=file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g,'')||'webp';const path=`${Date.now()}-${crypto.randomUUID()}.${ext}`;const {error}=await client.storage.from('prompt-images').upload(path,file,{upsert:false,contentType:file.type,cacheControl:'31536000'});if(error)throw error;return client.storage.from('prompt-images').getPublicUrl(path).data.publicUrl;}
  $('#promptForm').addEventListener('submit',async(event)=>{
    event.preventDefault();const btn=$('#saveBtn');btn.disabled=true;showMessage($('#saveMessage'),'Saving…');
    try{
      const imageUrl=await uploadImage($('#imageFile').files[0]);
      const payload={title:$('#title').value.trim(),title_hi:$('#titleHi').value.trim(),type:$('#type').value,category:$('#category').value.trim(),prompt_en:$('#promptEn').value.trim(),prompt_hi:$('#promptHi').value.trim(),aspect_ratio:$('#aspectRatio').value.trim(),duration:$('#duration').value.trim(),image_url:imageUrl,is_trending:$('#isTrending').checked,status:$('#status').value,extra_sections:getSections(),updated_at:new Date().toISOString()};
      const id=$('#promptId').value;const result=id?await client.from('prompts').update(payload).eq('id',id):await client.from('prompts').insert(payload);
      if(result.error)throw result.error;showMessage($('#saveMessage'),'Saved successfully.');await loadPrompts();setTimeout(closeEditor,500);
    }catch(error){showMessage($('#saveMessage'),error.message||'Could not save prompt.',true);}finally{btn.disabled=false;}
  });
  (async()=>{const {data}=await client.auth.getSession();if(data.session?.user){try{await verifyAdmin(data.session.user);showDashboard();}catch(error){await client.auth.signOut();showLogin(error.message);}}})();
})();