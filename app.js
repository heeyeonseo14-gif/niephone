// app.js (module)
const STORAGE = {
  chat: 'phone_sim_chat_v_split',
  feed: 'phone_sim_feed_v_split',
  settings: 'phone_sim_settings_v_split',
  persona: 'phone_sim_persona_v_split'
};

let state = {
  chat: JSON.parse(localStorage.getItem(STORAGE.chat) || '[]'),
  feed: JSON.parse(localStorage.getItem(STORAGE.feed) || '[]'),
  settings: JSON.parse(localStorage.getItem(STORAGE.settings) || '{}'),
  persona: localStorage.getItem(STORAGE.persona) || 'assistant:gentle'
};

// persist helper
function persist(){
  localStorage.setItem(STORAGE.chat, JSON.stringify(state.chat));
  localStorage.setItem(STORAGE.feed, JSON.stringify(state.feed));
  localStorage.setItem(STORAGE.settings, JSON.stringify(state.settings));
  localStorage.setItem(STORAGE.persona, state.persona);
}

// --- simple router: load fragment into #content
async function loadFragment(path){
  const content = document.getElementById('content');
  content.innerHTML = '<div class="loading">正在加载…</div>';
  try{
    const r = await fetch(path);
    if (!r.ok) throw new Error('加载失败: ' + r.status);
    const html = await r.text();
    content.innerHTML = html;
    // after injection, run initializer to bind events for that fragment
    if (path.endsWith('chat.html')) initChatFragment();
    if (path.endsWith('settings.html')) initSettingsFragment();
  }catch(err){
    content.innerHTML = `<div class="loading">加载失败：${err.message}</div>`;
  }
}

// nav buttons
document.querySelectorAll('.nav-btn').forEach(btn=>{
  btn.addEventListener('click', (e)=>{
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const p = btn.dataset.load;
    loadFragment(p);
  });
});

// load default
loadFragment('chat.html');

// =================== Chat fragment initializer ===================
function initChatFragment(){
  // clock
  const clock = document.getElementById('clock');
  if (clock) { setInterval(()=>clock.textContent = new Date().toLocaleTimeString(),1000); clock.textContent = new Date().toLocaleTimeString(); }

  // map DOM
  const chatList = document.getElementById('chatList');
  const feedList = document.getElementById('feedList');
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const roleSelect = document.getElementById('roleSelect');
  const customPersona = document.getElementById('customPersona');
  const postInput = document.getElementById('nickInput');
  const fileInput = document.getElementById('fileInput');
  const postBtn = document.getElementById('postBtn');
  const previewRow = document.getElementById('previewRow');
  const cropSquare = document.getElementById('cropSquare');
  const contextLenEl = document.getElementById('contextLen');
  const useMemoryEl = document.getElementById('useMemory');
  const longMemoryEl = document.getElementById('longMemory') || {value: state.settings.memory || ''};
  const displayName = document.getElementById('displayName');
  const displayPersona = document.getElementById('displayPersona');
  const userAvatarHeader = document.getElementById('userAvatarHeader');
  const userAvatarCompose = document.getElementById('userAvatarCompose');
  const settingNick = document.getElementById('settingNick');

  // set UI from state
  displayName.textContent = state.settings.nick || '你';
  displayPersona.textContent = state.persona || 'assistant:gentle';
  const avatar = state.settings.avatar || defaultAvatar();
  if (userAvatarHeader) userAvatarHeader.src = avatar;
  if (userAvatarCompose) userAvatarCompose.src = avatar;

  // role select logic
  if (roleSelect){
    roleSelect.value = (['assistant:gentle','assistant:strict','assistant:friend','assistant:custom'].includes(state.persona) ? state.persona : 'assistant:custom');
    if (roleSelect.value === 'assistant:custom'){
      customPersona.style.display = 'block';
      customPersona.value = state.persona;
    }
    roleSelect.addEventListener('change', ()=>{
      if (roleSelect.value === 'assistant:custom') { customPersona.style.display = 'block'; }
      else { customPersona.style.display = 'none'; state.persona = roleSelect.value; persist(); displayPersona.textContent = state.persona; }
    });
    customPersona.addEventListener('input', ()=>{ state.persona = customPersona.value || 'assistant:custom'; persist(); displayPersona.textContent = state.persona; });
  }

  // render helpers
  function renderChat(){
    if (!chatList) return;
    chatList.innerHTML = '';
    state.chat.forEach(item=>{
      const d = document.createElement('div'); d.className = 'msg ' + (item.from === 'user' ? 'user' : 'ai');
      d.innerHTML = `<div>${escapeHtml(item.text)}</div><div class="meta">${new Date(item.time).toLocaleString()}</div>`;
      chatList.appendChild(d);
    });
    chatList.scrollTop = chatList.scrollHeight;
  }
  function renderFeed(){
    if (!feedList) return;
    feedList.innerHTML = '';
    const items = [...state.feed].sort((a,b)=>b.time - a.time);
    items.forEach(post=>{
      const p = document.createElement('div'); p.className = 'post';
      const when = new Date(post.time).toLocaleString();
      p.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
        <div style="display:flex;align-items:center;gap:8px"><img src="${post.user.avatar}" class="avatar-small"><div><div style="font-weight:700">${escapeHtml(post.user.nick)}</div><div class="small" style="color:var(--muted)">${when}</div></div></div>
        <div></div>
      </div>`;
      if (post.text){ const t = document.createElement('div'); t.style.marginTop='8px'; t.textContent = post.text; p.appendChild(t); }
      if (post.images && post.images.length){
        const imagesRow = document.createElement('div'); imagesRow.className = 'images'; post.images.forEach(src=>{ const img = document.createElement('img'); img.className='img'; img.src = src; imagesRow.appendChild(img); }); p.appendChild(imagesRow);
      }
      const actionRow = document.createElement('div'); actionRow.style.marginTop='8px'; actionRow.style.display='flex'; actionRow.style.gap='8px';
      const likeBtn = document.createElement('button'); likeBtn.className='secondary'; likeBtn.textContent = `赞 (${post.likes||0})`; likeBtn.addEventListener('click', ()=>{ post.likes = (post.likes||0)+1; persist(); renderFeed(); });
      const commentBtn = document.createElement('button'); commentBtn.className='secondary'; commentBtn.textContent='评论'; commentBtn.addEventListener('click', ()=>{ const c=prompt('评论：'); if(c){ post.comments=post.comments||[]; post.comments.push({text:c,time:Date.now(),nick: state.settings.nick||'你'}); persist(); renderFeed(); }});
      const delBtn = document.createElement('button'); delBtn.className='secondary'; delBtn.textContent='删除'; delBtn.addEventListener('click', ()=>{ if(confirm('删除？')){ state.feed = state.feed.filter(x=>x.id!==post.id); persist(); renderFeed(); }});
      actionRow.appendChild(likeBtn); actionRow.appendChild(commentBtn); actionRow.appendChild(delBtn); p.appendChild(actionRow);
      if (post.comments && post.comments.length){ const comWrap = document.createElement('div'); comWrap.style.marginTop='8px'; post.comments.forEach(c=>{ const el = document.createElement('div'); el.className='small'; el.style.padding='6px'; el.style.borderTop='1px solid rgba(0,0,0,0.04)'; el.textContent = `${c.nick||'匿名'}：${c.text} · ${new Date(c.time).toLocaleString()}`; comWrap.appendChild(el); }); p.appendChild(comWrap); }
      feedList.appendChild(p);
    });
  }

  renderChat(); renderFeed();

  // send message
  if (sendBtn){
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', e=>{ if (e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendMessage(); }});
  }
  async function sendMessage(){
    const text = messageInput.value.trim(); if (!text) return;
    const msg = { id: uid(), from:'user', text, time: Date.now() };
    state.chat.push(msg); persist(); renderChat(); messageInput.value='';
    appendAiTyping();
    const persona = getPersonaForPrompt();
    const n = parseInt(contextLenEl?.value || 6);
    const context = state.chat.slice(-n);
    const memory = useMemoryEl?.checked ? (state.settings.memory || '') : '';
    // use apiCallChoose (defined later in this file)
    const reply = await apiCallChoose({ persona, memory, context, userMeta:{ nick: state.settings.nick || '你', avatar: state.settings.avatar || defaultAvatar() }});
    removeAiTyping();
    state.chat.push({ id: uid(), from:'ai', text: reply, time: Date.now() });
    persist(); renderChat();
  }

  // Ai typing indicator
  function appendAiTyping(){ const el = document.createElement('div'); el.className='msg ai'; el.id='typingElem'; el.innerHTML=`<div>AI 正在输入…</div>`; chatList.appendChild(el); chatList.scrollTop = chatList.scrollHeight; }
  function removeAiTyping(){ const t = document.getElementById('typingElem'); if (t) t.remove(); }

  // file upload for posts (simple)
  let imagePreviews = [];
  if (fileInput){
    fileInput.addEventListener('change', async (e)=>{
      const files = Array.from(e.target.files || []);
      previewRow.innerHTML = ''; imagePreviews = [];
      for (const f of files.slice(0,6)){
        try{ const data = await processImageFile(f, {maxWidth:1024,quality:0.8,square: cropSquare.checked}); imagePreviews.push(data); const im = document.createElement('img'); im.className='thumb'; im.src = data; previewRow.appendChild(im); }catch(err){ console.error(err); }
      }
    });
  }

  if (postBtn){
    postBtn.addEventListener('click', ()=>{
      const text = postInput.value.trim();
      if (!text && imagePreviews.length===0){ alert('请输入文字或选择图片'); return; }
      const post = { id: uid(), text, images: imagePreviews, time: Date.now(), user: { nick: state.settings.nick || '你', avatar: state.settings.avatar || defaultAvatar() }, likes:0, comments:[] };
      state.feed.push(post); persist(); renderFeed();
      postInput.value=''; fileInput.value=''; previewRow.innerHTML=''; imagePreviews=[];
      alert('已发布（本地）');
    });
  }

  // clear actions
  document.getElementById('clearChat')?.addEventListener('click', ()=>{ if(confirm('清空聊天？')){ state.chat=[]; persist(); renderChat(); }});
  document.getElementById('clearFeed')?.addEventListener('click', ()=>{ if(confirm('清空动态？')){ state.feed=[]; persist(); renderFeed(); }});

  // helper: get persona
  function getPersonaForPrompt(){
    const rs = roleSelect?.value || state.persona;
    if (rs === 'assistant:custom'){ return customPersona.value || 'assistant:custom'; }
    return rs;
  }

} // end initChatFragment

// =================== Settings fragment initializer ===================
function initSettingsFragment(){
  // map DOM
  const settingNick = document.getElementById('settingNick');
  const avatarFile = document.getElementById('avatarFile');
  const longMemory = document.getElementById('longMemory');
  const themeMode = document.getElementById('themeMode');
  const themeColor = document.getElementById('themeColor');
  const saveSettings = document.getElementById('saveSettings');
  const resetAll = document.getElementById('resetAll');

  // API-related
  const useProxyCheckbox = document.getElementById('useProxyCheckbox');
  const apiUrlInput = document.getElementById('apiUrlInput');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const apiModelSelect = document.getElementById('apiModelSelect');
  const saveApiSettings = document.getElementById('saveApiSettings');
  const testApiBtn = document.getElementById('testApiBtn');
  const apiTestResult = document.getElementById('apiTestResult');

  // load into UI
  settingNick.value = state.settings.nick || '';
  longMemory.value = state.settings.memory || '';
  themeMode && (themeMode.value = state.settings.theme || 'light');
  themeColor && (themeColor.value = state.settings.color || '#2d85ff');
  useProxyCheckbox && (useProxyCheckbox.checked = !!state.settings.useProxy);
  apiUrlInput && (apiUrlInput.value = state.settings.apiUrl || '');
  apiKeyInput && (apiKeyInput.value = state.settings.apiKey || '');
  apiModelSelect && (apiModelSelect.value = state.settings.apiModel || 'model-default');

  // avatar upload
  avatarFile && avatarFile.addEventListener('change', async (e)=>{
    const f = e.target.files[0]; if (!f) return;
    try{ const data = await processImageFile(f, {maxWidth:512,quality:0.9,square:true}); state.settings.avatar = data; persist(); alert('头像已保存'); }catch(err){ alert('头像处理失败'); console.error(err); }
  });

  saveSettings && saveSettings.addEventListener('click', ()=>{
    state.settings.nick = settingNick.value.trim() || '你';
    state.settings.memory = longMemory.value || '';
    state.settings.theme = themeMode?.value || 'light';
    state.settings.color = themeColor?.value || '#2d85ff';
    persist();
    alert('设置已保存');
  });

  resetAll && resetAll.addEventListener('click', ()=>{ if (confirm('重置会清除本地所有数据，确定？')){ localStorage.clear(); location.reload(); }});

  // API settings save/test
  saveApiSettings && saveApiSettings.addEventListener('click', ()=>{
    state.settings.useProxy = !!useProxyCheckbox.checked;
    state.settings.apiUrl = apiUrlInput.value.trim();
    state.settings.apiKey = apiKeyInput.value.trim();
    state.settings.apiModel = apiModelSelect.value;
    persist();
    apiTestResult && (apiTestResult.textContent = '已保存');
    setTimeout(()=>apiTestResult && (apiTestResult.textContent=''),2000);
  });

  testApiBtn && testApiBtn.addEventListener('click', async ()=>{
    apiTestResult && (apiTestResult.textContent = '测试中…');
    const payload = { persona: state.persona || 'assistant:gentle', memory: state.settings.memory || '', context: [{from:'user', text:'这是一次测试，请返回简短确认。'}], userMeta: { nick: state.settings.nick || '你' } };
    const reply = await apiCallChoose(payload);
    apiTestResult && (apiTestResult.textContent = '返回：' + (typeof reply==='string'? reply.slice(0,200) : JSON.stringify(reply)));
    setTimeout(()=>apiTestResult && (apiTestResult.textContent=''),8000);
  });

} // end initSettingsFragment

// =================== API call utilities (shared) ===================

// choose proxy or direct based on state.settings.useProxy
async function apiCallChoose(payload){
  const s = state.settings || {};
  if (s.useProxy) return callApiViaProxy(payload);
  return callApiDirectly({ apiUrl: s.apiUrl || '', apiKey: s.apiKey || '', model: s.apiModel || 'model-default', payload});
}

// direct call (front-end) - generic wrapper; adjust body per target API docs
async function callApiDirectly({ apiUrl, apiKey, model, payload }){
  if (!apiUrl) return '未配置 API URL';
  try{
    const body = { model: model && model!=='model-default' ? model : undefined, persona: payload.persona, memory: payload.memory, context: payload.context, userMeta: payload.userMeta };
    Object.keys(body).forEach(k => body[k]===undefined && delete body[k]);
    const res = await fetch(apiUrl, { method:'POST', headers: { 'Content-Type':'application/json', ...(apiKey ? {'Authorization': 'Bearer ' + apiKey} : {}) }, body: JSON.stringify(body) });
    if (!res.ok){ const t = await res.text(); return `API 错误：${res.status} ${t}`; }
    const data = await res.json();
    if (data.reply) return data.reply;
    if (data.result && data.result.text) return data.result.text;
    // try common LLM style: choices[0].message.content
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) return data.choices[0].message.content;
    return JSON.stringify(data);
  }catch(err){ console.error(err); return '调用失败：' + err.message; }
}

// proxy call (to /api/chat)
async function callApiViaProxy(payload){
  try{
    const res = await fetch('/api/chat', { method:'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if (!res.ok){ const t = await res.text(); return `代理错误：${res.status} ${t}`; }
    const data = await res.json();
    if (data.reply) return data.reply;
    if (data.result && data.result.text) return data.result.text;
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) return data.choices[0].message.content;
    return JSON.stringify(data);
  }catch(err){ console.error(err); return '代理调用失败：' + err.message; }
}

// =================== Utilities (image processing, helpers) ===================
function uid(){ return 'id_' + Math.random().toString(36).slice(2,9); }
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]) ); }
function shorten(s,n=60){ return s && s.length>n ? s.slice(0,n-1)+'…' : (s||''); }

function defaultAvatar(){
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'><rect rx='16' width='100%' height='100%' fill='#e6eef9'/><g fill='#2d85ff'><circle cx='64' cy='44' r='24'/><rect x='28' y='78' width='72' height='30' rx='6'/></g></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function processImageFile(file, opts={maxWidth:1024,quality:0.8,square:false}){
  return new Promise((resolve,reject)=>{
    const fr = new FileReader();
    fr.onload = ()=> {
      const img = new Image();
      img.onload = ()=>{
        try{
          let {width, height} = img;
          const maxW = opts.maxWidth || 1024;
          if (width > maxW){ const ratio = maxW / width; width = Math.round(width * ratio); height = Math.round(height * ratio); }
          if (opts.square){
            const temp = document.createElement('canvas'); temp.width = width; temp.height = height; const tctx = temp.getContext('2d'); tctx.drawImage(img,0,0,width,height);
            const side = Math.min(width, height); const sx = Math.floor((width-side)/2); const sy = Math.floor((height-side)/2);
            const fc = document.createElement('canvas'); fc.width = side; fc.height = side; const fctx = fc.getContext('2d'); fctx.drawImage(temp, sx,sy,side,side, 0,0,side,side);
            resolve(fc.toDataURL('image/jpeg', opts.quality||0.8)); return;
          } else {
            const c = document.createElement('canvas'); c.width = width; c.height = height; const ctx = c.getContext('2d'); ctx.drawImage(img,0,0,width,height);
            resolve(c.toDataURL('image/jpeg', opts.quality||0.8)); return;
          }
        }catch(err){ reject(err); }
      };
      img.onerror = ()=> reject(new Error('图片加载失败'));
      img.src = fr.result;
    };
    fr.onerror = ()=> reject(new Error('文件读取失败'));
    fr.readAsDataURL(file);
  });
}

// =================== init: try to load settings and set a default avatar if none ===================
(function boot(){
  state.settings = state.settings || {};
  if (!state.settings.avatar) state.settings.avatar = defaultAvatar();
  // nothing else right now
})();
