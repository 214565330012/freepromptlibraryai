(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const client = window.supabaseClient || null;
  const params = new URLSearchParams(location.search);
  const slug = (params.get('slug') || 'about').toLowerCase().replace(/[^a-z0-9-]/g, '');
  const pageTitles = {about:'About Us',contact:'Contact Us',privacy:'Privacy Policy',terms:'Terms & Conditions',disclaimer:'Disclaimer',dmca:'DMCA'};
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function linkifyPolicyTerms(value){
    let text=esc(value);
    const links=[['Terms & Conditions','terms'],['Privacy Policy','privacy'],['Disclaimer','disclaimer']];
    for(const [label,target] of links){
      const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const re=new RegExp('(^|[^A-Za-z0-9_/-])('+escaped+')(?![A-Za-z0-9_])','gi');
      text=text.replace(re,(match,prefix,word)=>`${prefix}<a href="page.html?slug=${target}">${word}</a>`);
    }
    return text;
  }
  function setStatus(message, error=false){const p=$('#complaintStatus');p.textContent=message;p.classList.toggle('error',error);}
  function setupTheme(){
    const saved=localStorage.getItem('fpl-theme')||'light';document.documentElement.dataset.theme=saved;
    const button=$('#themeToggle');if(button){button.textContent=saved==='dark'?'☀':'◐';button.addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;localStorage.setItem('fpl-theme',next);button.textContent=next==='dark'?'☀':'◐';});}
    document.querySelectorAll('[data-language]').forEach(b=>{const active=b.dataset.language===(localStorage.getItem('fpl-language')||'en');b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));b.addEventListener('click',()=>{localStorage.setItem('fpl-language',b.dataset.language);document.querySelectorAll('[data-language]').forEach(x=>{const on=x===b;x.classList.toggle('active',on);x.setAttribute('aria-pressed',String(on));});});});
  }
  async function loadPage(){
    document.title=`${pageTitles[slug]||'Information'} | FreePromptLibraryAI`;
    $('#pageYear').textContent=new Date().getFullYear();
    if(!client){throw new Error('Supabase client did not load. Refresh the page and check the network connection.');}
    const pageResult=await client.from('content_pages').select('*').eq('slug',slug).maybeSingle();
    if(pageResult.error) throw new Error(`Could not read this page from Supabase: ${pageResult.error.message}`);
    const page=pageResult.data;
    const settingsResult=await client.from('site_settings').select('settings').eq('id',1).maybeSingle();
    if(settingsResult.error) console.warn('Optional site settings could not be loaded:',settingsResult.error.message);
    if(!page){$('#contentPageTitle').textContent=pageTitles[slug]||'Information';$('#contentPageIntro').textContent='';$('#contentPageSections').innerHTML='<p>This page has not been added in the admin panel yet. Please publish it from Homepage Builder.</p>';return;}
    if(page.is_published===false){$('#contentPageTitle').textContent=page.title||pageTitles[slug]||'Information';$('#contentPageIntro').textContent=page.intro||'';$('#contentPageSections').innerHTML='<p>This page is currently saved as a draft. Publish it from the admin panel to make it visible.</p>';return;}
    $('#contentPageTitle').textContent=page.title||pageTitles[slug]||'Information';
    $('#contentPageIntro').textContent=page.intro||'';
    $('#contentPageSections').innerHTML=(Array.isArray(page.sections)?page.sections:[]).map(section=>`<section class="content-page-section"><h2>${esc(section.heading||'')}</h2><p>${linkifyPolicyTerms(section.content||'')}</p></section>`).join('')||'<p>Information will be updated soon.</p>';
    if(slug==='contact'){
      const email=settingsResult.data?.settings?.contactEmail||'';
      $('#contactDetails').hidden=false;
      $('#contactDetails').innerHTML=email?`Contact email: <a href="mailto:${esc(email)}">${esc(email)}</a>`:'Use the complaint and suggestion form below to contact us.';
      $('#complaintForm').hidden=false;
      const hash=location.hash;if(hash==='#complaint')setTimeout(()=>$('#complaintForm').scrollIntoView({behavior:'smooth',block:'start'}),150);
    }
  }
  $('#complaintForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const button=$('.complaint-submit');button.disabled=true;setStatus('Sending your message…');
    try{
      if(!client)throw new Error('Connection unavailable. Please try again later.');
      if($('#complaintWebsite').value.trim()) { setStatus('Thank you. Your message has been received.'); $('#complaintForm').reset(); return; }
      const payload={name:$('#complaintName').value.trim(),email:$('#complaintEmail').value.trim(),subject:$('#complaintSubject').value.trim(),message:$('#complaintMessage').value.trim(),status:'new'};
      const {error}=await client.from('complaints').insert(payload);if(error)throw error;
      $('#complaintForm').reset();setStatus('Thank you. Your message has been sent successfully.');
    }catch(error){setStatus(error.message||'Could not send your message. Please try again.',true);}finally{button.disabled=false;}
  });
  setupTheme();loadPage().catch(error=>{console.error('Information page load failed:',error);$('#contentPageTitle').textContent=pageTitles[slug]||'Information';$('#contentPageSections').innerHTML=`<p class="page-load-error">${esc(error.message||'Could not load this page. Please try again later.')}</p>`;});
})();
