(() => {
  'use strict';
  const cfg = window.AUTHHUB_CONFIG || {};
  const apiBase = String(cfg.apiBase || '').replace(/\/$/, '');
  const state = {
    route: location.hash.slice(1) || '/overview',
    loading: false,
    projects: [],
    project: null,
    envName: 'production',
    overview: null,
    users: [],
    audit: [],
    projectQuery: '',
    adminStatus: null
  };
  const app = document.getElementById('app');
  const providers = {
    google: { label:'Google', logo:'G', note:'Google OAuth 2.0 / OIDC', scopes:'openid email profile' },
    kakao: { label:'Kakao', logo:'K', note:'Kakao Login', scopes:'profile_nickname,account_email' },
    naver: { label:'Naver', logo:'N', note:'Naver Login', scopes:'' },
    microsoft: { label:'Microsoft', logo:'M', note:'Microsoft Entra ID', scopes:'openid email profile' },
    oidc: { label:'Custom OIDC', logo:'O', note:'고객사 SSO / 표준 OIDC', scopes:'openid email profile' }
  };
  const esc = (v='') => String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmt = n => new Intl.NumberFormat('ko-KR').format(Number(n || 0));
  const date = v => v ? new Intl.DateTimeFormat('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(v)) : '—';
  const initials = name => String(name || 'A').trim().slice(0,2).toUpperCase();
  const projectPid = p => String(p?.monitor_project_id || p?.slug || '').trim();
  const projectDisplay = p => `${String(p?.name||'').trim()}${projectPid(p)?` (${projectPid(p)})`:''}`;
  const projectSearchText = p => [p?.name,projectPid(p),p?.monitor_label,p?.monitor_public_url,p?.monitor_category].filter(Boolean).join(' ').toLowerCase();

  function toast(message, type='ok') {
    const root = document.getElementById('toast-root');
    const el = document.createElement('div'); el.className = `toast ${type==='error'?'error':''}`;
    el.innerHTML = `<i class="bi ${type==='error'?'bi-exclamation-circle':'bi-check-circle'}"></i><span>${esc(message)}</span>`;
    root.appendChild(el); setTimeout(()=>el.remove(), 3200);
  }
  function loading(on) {
    state.loading = on; const old=document.getElementById('global-loading');
    if(on&&!old){const el=document.createElement('div');el.id='global-loading';el.className='loading-bar';document.body.appendChild(el)}
    if(!on&&old)old.remove();
  }
  async function request(path, options={}) {
    if (!apiBase || apiBase.includes('__AUTHHUB')) throw new Error('API 주소가 아직 설정되지 않았습니다.');
    const headers = { 'content-type':'application/json', ...(options.headers||{}) };
    const res = await fetch(`${apiBase}${path}`, { credentials:'include', ...options, headers });
    const text = await res.text(); let data={}; try{data=text?JSON.parse(text):{}}catch{data={error:text||'request_failed'}}
    if(res.status===401 && !['/admin/login','/admin/setup','/admin/status','/admin/logout'].includes(path)){ state.adminStatus={...(state.adminStatus||{}),authenticated:false}; throw new Error('관리자 세션이 만료되었습니다.'); }
    if(!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`);
    return data;
  }
  function navigate(path) { location.hash = path; }
  async function logout(show=true){
    try{await request('/admin/logout',{method:'POST',body:'{}'});}catch(_){}
    state.project=null; state.adminStatus={...(state.adminStatus||{}),authenticated:false}; if(show)toast('로그아웃했습니다.'); await render();
  }

  function sidebar(active) {
    const nav=(key,label,icon,path,count='')=>`<button class="nav-item ${active===key?'active':''}" data-nav="${path}"><i class="bi ${icon}"></i><span>${label}</span>${count!==''?`<b class="nav-count">${count}</b>`:''}</button>`;
    return `<aside class="sidebar">
      <div class="brand"><div class="brand-mark">A</div><div><strong>AuthHub</strong><small>IDENTITY</small></div></div>
      <div class="nav-group"><div class="nav-label">Workspace</div>
        ${nav('overview','Overview','bi-grid-1x2','/overview')}
        ${nav('projects','Projects','bi-boxes','/projects',state.projects.length||'')}
        ${nav('users','Users','bi-people','/users')}
        ${nav('audit','Audit log','bi-activity','/audit')}
      </div>
      <div class="nav-group"><div class="nav-label">System</div>
        ${nav('docs','Integration','bi-braces','/integration')}
        <button class="nav-item" data-logout><i class="bi bi-box-arrow-left"></i><span>Sign out</span></button>
      </div>
      <div class="sidebar-foot"><div class="status-line"><i class="status-dot"></i><span>Auth service operational</span></div><div class="version">${esc(cfg.version||'dev')}</div></div>
    </aside>`;
  }
  function shell(active,title,content,crumb='Workspace') {
    return `<div class="shell">${sidebar(active)}<main class="main"><header class="topbar"><div class="crumbs"><span>${esc(crumb)}</span><i class="bi bi-chevron-right"></i><strong>${esc(title)}</strong></div><div class="top-actions"><div class="env-chip"><i class="bi bi-circle-fill"></i>Production ready</div></div></header><div class="content">${content}</div></main></div>`;
  }
  function pageHead(eyebrow,title,description,actions='') { return `<div class="page-head"><div class="page-head-copy"><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${actions?`<div class="head-actions">${actions}</div>`:''}</div>`; }
  function empty(icon,title,desc,button=''){return `<div class="empty"><i class="bi ${icon}"></i><strong>${esc(title)}</strong><p>${esc(desc)}</p>${button}</div>`}

  function setupView(status={}) {
    app.innerHTML = `<div class="login-page"><section class="login-brand-panel"><div class="login-brand"><div class="brand-mark">A</div><strong>AuthHub</strong></div><div class="login-hero"><div class="kicker">FIRST ADMIN SETUP</div><h1>처음 한 번만,<br><em>관리자 계정을 설정합니다.</em></h1><p>배포 파일에 관리자 비밀번호를 고정하지 않고 첫 접속에서 직접 관리자 계정을 생성합니다.</p></div><div class="login-points"><span><i class="bi bi-shield-check"></i>PayHub-style first setup</span><span><i class="bi bi-database-lock"></i>DB stored credentials</span><span><i class="bi bi-key"></i>One-time setup</span></div></section><section class="login-form-panel"><form class="login-box" id="setup-form"><div class="eyebrow">SUAVEFORGE · AUTH OPERATIONS</div><h2>최초 관리자 설정</h2><p>이 설정은 관리자 계정이 없는 경우에만 한 번 허용됩니다.</p><div id="login-error"></div><label class="field"><span>관리자 아이디</span><input class="input" name="username" type="text" autocomplete="username" minlength="3" required placeholder="admin"></label><label class="field"><span>비밀번호</span><input class="input" name="password" type="password" autocomplete="new-password" minlength="10" required placeholder="10자 이상"></label><label class="field"><span>비밀번호 확인</span><input class="input" name="confirm" type="password" autocomplete="new-password" minlength="10" required placeholder="비밀번호 다시 입력"></label>${status.setup_token_required?`<label class="field"><span>Setup Token</span><input class="input" name="setupToken" type="password" autocomplete="off" required placeholder="AUTHHUB-ADMIN-ACCESS.txt 확인"></label>`:''}<button class="btn primary login-submit" type="submit"><i class="bi bi-check2-circle"></i>관리자 계정 생성</button><div class="login-note"><i class="bi bi-shield-lock"></i><span>설정 완료 후 같은 화면은 다시 열리지 않습니다.</span></div></form></section></div>`;
    document.getElementById('setup-form').addEventListener('submit', async e => {
      e.preventDefault(); const fd=new FormData(e.currentTarget); const error=document.getElementById('login-error'); error.innerHTML='';
      if(String(fd.get('password'))!==String(fd.get('confirm'))){error.innerHTML='<div class="error-box">비밀번호 확인이 일치하지 않습니다.</div>';return;}
      loading(true);
      try{await request('/admin/setup',{method:'POST',body:JSON.stringify({username:fd.get('username'),password:fd.get('password'),setupToken:fd.get('setupToken')||''})});state.adminStatus={setup_required:false,authenticated:true};await bootstrap();navigate('/overview');await render();}
      catch(err){const msg=({invalid_admin_setup_token:'Setup Token이 올바르지 않습니다.',admin_already_configured:'이미 관리자 계정이 설정되어 있습니다.',invalid_admin_username:'관리자 아이디는 3자 이상이어야 합니다.',admin_password_too_short:'비밀번호는 10자 이상이어야 합니다.'})[err.message]||err.message;error.innerHTML=`<div class="error-box">${esc(msg)}</div>`}finally{loading(false)}
    });
  }

  function loginView() {
    app.innerHTML = `<div class="login-page"><section class="login-brand-panel"><div class="login-brand"><div class="brand-mark">A</div><strong>AuthHub</strong></div><div class="login-hero"><div class="kicker">CENTRAL IDENTITY LAYER</div><h1>인증은 하나로,<br><em>브랜드 경험은 그대로.</em></h1><p>프로젝트마다 로그인 화면과 제공 수단은 다르게 유지하면서 회원·세션·권한·OAuth 운영은 한 곳에서 관리합니다.</p></div><div class="login-points"><span><i class="bi bi-shield-check"></i>Encrypted secrets</span><span><i class="bi bi-diagram-3"></i>Multi-project</span><span><i class="bi bi-key"></i>OAuth & SSO</span></div></section><section class="login-form-panel"><form class="login-box" id="login-form"><div class="eyebrow">SUAVEFORGE · AUTH OPERATIONS</div><h2>관리자 로그인</h2><p>프로젝트별 인증 정책과 외부 로그인 연결을 관리합니다.</p><div id="login-error"></div><label class="field"><span>아이디</span><input class="input" name="username" type="text" autocomplete="username" required placeholder="admin"></label><label class="field"><span>비밀번호</span><input class="input" name="password" type="password" autocomplete="current-password" required placeholder="••••••••••••"></label><button class="btn primary login-submit" type="submit"><i class="bi bi-arrow-right"></i>로그인</button><div class="login-note"><i class="bi bi-shield-lock"></i><span>관리자 인증 정보와 프로젝트 Secret은 공개 배포 저장소에 저장하지 않습니다.</span></div></form></section></div>`;
    document.getElementById('login-form').addEventListener('submit', async e => {
      e.preventDefault(); const fd=new FormData(e.currentTarget); const error=document.getElementById('login-error'); error.innerHTML=''; loading(true);
      try{await request('/admin/login',{method:'POST',body:JSON.stringify({username:fd.get('username'),password:fd.get('password')})});state.adminStatus={setup_required:false,authenticated:true};await bootstrap();navigate('/overview');await render();}
      catch(err){const msg=err.message==='admin_setup_required'?'최초 관리자 설정이 필요합니다. 새로고침 후 계정을 설정하세요.':err.message;error.innerHTML=`<div class="error-box">${esc(msg)}</div>`}finally{loading(false)}
    });
  }

  async function bootstrap() {
    if(!state.adminStatus?.authenticated)return;
    try{const data=await request('/admin/projects');state.projects=data.items||[];}catch(err){console.warn(err)}
  }

  async function overviewView() {
    loading(true);
    try {
      state.overview=await request('/admin/overview');
      const p=await request('/admin/projects'); state.projects=p.items||[];
    } catch(err) { toast(err.message,'error'); }
    finally { loading(false); }
    const o=state.overview||{};
    const rows=state.projects.slice(0,6).map(p=>`<tr data-click data-project="${p.id}"><td><div class="project-cell"><div class="project-icon">${esc(initials(p.name))}</div><div><strong>${esc(p.name)} ${projectPid(p)?`<span class="project-id">${esc(projectPid(p))}</span>`:''}</strong><small>${esc(p.monitor_public_url||p.monitor_category||'MONITOR 연결')}</small></div></div></td><td><span class="badge ${p.status==='active'?'green':'gray'}">${esc(p.status)}</span></td><td class="mono">${p.environments||0} env</td><td>${date(p.updated_at)}</td><td><i class="bi bi-chevron-right" style="color:#adb3bb"></i></td></tr>`).join('');
    const content=pageHead('IDENTITY OPERATIONS','Overview','MONITOR 프로젝트 ID를 기준으로 인증 구성을 연결하고 관리합니다.',`<button class="btn primary" data-create-project><i class="bi bi-plus-lg"></i>프로젝트 연결</button>`)+`<div class="metric-grid"><article class="metric"><div class="metric-top"><span>Projects</span><i class="bi bi-boxes"></i></div><strong>${fmt(o.projects)}</strong><small>등록된 서비스</small></article><article class="metric"><div class="metric-top"><span>Users</span><i class="bi bi-people"></i></div><strong>${fmt(o.users)}</strong><small>통합 사용자</small></article><article class="metric"><div class="metric-top"><span>Active sessions</span><i class="bi bi-key"></i></div><strong>${fmt(o.activeSessions)}</strong><small>유효한 Refresh 세션</small></article><article class="metric"><div class="metric-top"><span>Events · 24h</span><i class="bi bi-activity"></i></div><strong>${fmt(o.events24h)}</strong><small>인증·설정 변경 로그</small></article></div><div class="grid-2"><section class="card"><div class="card-head"><div><h2>최근 프로젝트</h2><p>MONITOR의 영구 pNN ID를 그대로 사용합니다.</p></div><div class="spacer"><button class="btn" data-nav="/projects">전체 보기</button></div></div>${rows?`<table class="table"><thead><tr><th>Project</th><th>Status</th><th>Environment</th><th>Updated</th><th></th></tr></thead><tbody>${rows}</tbody></table>`:empty('bi-box','연결된 프로젝트가 없습니다','MONITOR 프로젝트를 선택해 AuthHub 인증을 연결할 수 있습니다.',`<button class="btn primary" data-create-project>프로젝트 연결</button>`)}</section><aside class="card"><div class="card-head"><div><h2>운영 원칙</h2><p>프로젝트 ID 원장은 MONITOR입니다.</p></div></div><div class="card-body quick-list"><div class="quick-row"><i class="bi bi-fingerprint"></i><div><strong>pNN은 영구 불변</strong><small>이름·URL 변경과 무관하게 동일 프로젝트 유지</small></div></div><div class="quick-row"><i class="bi bi-diagram-3"></i><div><strong>인증은 AuthHub</strong><small>회원·세션·OAuth 중앙 관리</small></div></div><div class="quick-row"><i class="bi bi-lock"></i><div><strong>HUB_TOKEN은 서버 전용</strong><small>브라우저와 공개 저장소에 노출하지 않음</small></div></div><div class="quick-row"><i class="bi bi-arrow-repeat"></i><div><strong>MONITOR 목록 동기화</strong><small>프로젝트명·URL 변경은 pNN 기준으로 반영</small></div></div></div></aside></div>`;
    app.innerHTML=shell('overview','Overview',content); bindCommon();
  }

  async function projectsView(query=state.projectQuery||'') {
    loading(true);
    try { const d=await request('/admin/projects'); state.projects=d.items||[]; }
    catch(err) { toast(err.message,'error'); }
    finally { loading(false); }
    state.projectQuery=String(query||'').trim();
    const q=state.projectQuery.toLowerCase();
    const visible=q?state.projects.filter(p=>projectSearchText(p).includes(q)):state.projects;
    const rows=visible.map(p=>`<tr data-click data-project="${p.id}"><td><div class="project-cell"><div class="project-icon">${esc(initials(p.name))}</div><div><strong>${esc(p.name)} ${projectPid(p)?`<span class="project-id">${esc(projectPid(p))}</span>`:''}</strong><small>${esc(p.monitor_public_url||p.monitor_category||'MONITOR 연결')}</small></div></div></td><td><span class="badge ${p.status==='active'?'green':'gray'}">${esc(p.status)}</span></td><td>${p.environments||0}</td><td>${date(p.created_at)}</td><td>${date(p.updated_at)}</td><td><i class="bi bi-chevron-right" style="color:#adb3bb"></i></td></tr>`).join('');
    const content=pageHead('PROJECT REGISTRY','Projects','MONITOR에서 발급한 pNN을 영구 프로젝트 ID로 사용합니다.',`<button class="btn primary" data-create-project><i class="bi bi-plus-lg"></i>프로젝트 연결</button>`)+`<div class="filter-row"><label class="search"><i class="bi bi-search"></i><input id="project-search" value="${esc(state.projectQuery)}" placeholder="프로젝트명 또는 pNN 검색"></label></div><section class="card"><div class="card-head"><h2>등록 프로젝트</h2><div class="spacer"><span class="badge gray">${visible.length} / ${state.projects.length}</span></div></div>${rows?`<table class="table"><thead><tr><th>Project</th><th>Status</th><th>Envs</th><th>Created</th><th>Updated</th><th></th></tr></thead><tbody>${rows}</tbody></table>`:empty('bi-boxes',state.projectQuery?'검색 결과가 없습니다.':'아직 연결된 프로젝트가 없습니다.',state.projectQuery?'프로젝트명이나 pNN을 다시 확인하세요.':'MONITOR 목록에서 프로젝트를 연결하면 production과 staging 환경이 자동 생성됩니다.',state.projectQuery?'':`<button class="btn primary" data-create-project>프로젝트 연결</button>`)}</section>`;
    app.innerHTML=shell('projects','Projects',content);bindCommon();
    const search=document.getElementById('project-search');
    if(search) search.onkeydown=e=>{if(e.key==='Enter')projectsView(search.value)};
  }

  function providerCard(p){const meta=providers[p.provider]||{label:p.provider,logo:'?',note:''};return `<article class="provider"><div class="provider-head"><div class="provider-logo">${esc(meta.logo)}</div><div class="provider-title"><strong>${esc(meta.label)}</strong><small>${esc(meta.note)}</small></div><span class="provider-status badge ${p.enabled?'green':'gray'}">${p.enabled?'ON':'OFF'}</span></div><div class="provider-foot"><small>${p.client_id?`Client · ${esc(p.client_id.slice(0,16))}${p.client_id.length>16?'…':''}`:'연결 정보 없음'}</small><button data-provider="${esc(p.provider)}">설정</button></div></article>`}
  async function projectView(id){
    loading(true);try{state.project=await request(`/admin/projects/${encodeURIComponent(id)}`)}catch(err){toast(err.message,'error');navigate('/projects');return}finally{loading(false)}
    const p=state.project; let envObj=p.environments.find(e=>e.name===state.envName)||p.environments[0]; state.envName=envObj.name;
    const engineDesc={native:'AuthHub가 이메일·소셜 인증과 세션을 직접 관리합니다.',supabase:'Supabase 토큰을 검증한 뒤 AuthHub 공통 세션으로 교환합니다.',firebase:'Firebase ID Token을 검증한 뒤 AuthHub 공통 세션으로 교환합니다.'};
    const providerHtml=(envObj.providers||[]).map(providerCard).join(''); const uriHtml=(envObj.redirectUris||[]).map(r=>`<div class="uri-row"><i class="bi bi-arrow-return-right"></i><code>${esc(r.uri)}</code><button data-delete-uri="${r.id}" aria-label="삭제"><i class="bi bi-x-lg"></i></button></div>`).join('');
    const tabs=p.environments.map(e=>`<button class="tab ${e.name===state.envName?'active':''}" data-env="${e.name}">${e.name==='production'?'Production':'Staging'}</button>`).join('');
    const content=pageHead('PROJECT IDENTITY',p.name,`${projectPid(p)} · MONITOR 영구 ID · ${p.monitor_public_url||'URL 미등록'}${p.monitor_category?` · ${p.monitor_category}`:''}`,`<button class="btn" data-copy="${esc(envObj.client_id)}"><i class="bi bi-copy"></i>Client ID</button><button class="btn" data-nav="/projects"><i class="bi bi-arrow-left"></i>목록</button>`)+`<div class="tabs">${tabs}</div><section class="section"><div class="section-title"><div><h2>Hub Bridge</h2><p>MONITOR 공개 URL에서 표준 endpoint를 자동 계산합니다. 수동 URL 입력은 없습니다.</p></div><div class="section-actions"><button class="btn" data-bridge><i class="bi bi-key"></i>Bridge Secret</button></div></div><div class="settings-card"><div class="setting-row"><div class="setting-label"><strong>Event endpoint</strong><small>public_url origin + /api/hub/events</small></div><div class="setting-value inline"><code>${esc(p.hub_bridge_url||'MONITOR 공개 URL 미등록')}</code></div></div><div class="setting-row"><div class="setting-label"><strong>Event contract</strong><small>공통 Hub Bridge envelope</small></div><div class="setting-value inline"><code>schema_version: 1</code><code>hub: auth</code></div></div></div></section><section class="section"><div class="section-title"><div><h2>Authentication engine</h2><p>클라이언트 요구가 없으면 Native를 기본으로 사용합니다.</p></div><div class="section-actions"><button class="btn" data-engine-config><i class="bi bi-sliders"></i>엔진 설정</button></div></div><div class="settings-card"><div class="setting-row"><div class="setting-label"><strong>현재 엔진</strong><small>프로젝트 환경별로 독립적으로 선택합니다.</small></div><div class="setting-value inline"><span class="badge green">${esc(envObj.auth_engine)}</span><span>${esc(engineDesc[envObj.auth_engine]||'')}</span></div></div><div class="setting-row"><div class="setting-label"><strong>Client ID</strong><small>각 프로젝트가 AuthHub API를 호출할 때 사용하는 공개 식별자입니다.</small></div><div class="setting-value inline"><code>${esc(envObj.client_id)}</code><button class="btn icon" data-copy="${esc(envObj.client_id)}"><i class="bi bi-copy"></i></button></div></div></div></section><section class="section"><div class="section-title"><div><h2>Sign-in methods</h2><p>프로젝트 로그인 화면에 노출할 수단만 활성화합니다.</p></div></div><div class="provider-grid">${providerHtml}</div></section><section class="section"><div class="section-title"><div><h2>Login policy</h2><p>가입과 승인 흐름을 프로젝트 특성에 맞게 분리합니다.</p></div><div class="section-actions"><button class="btn" data-policy><i class="bi bi-sliders"></i>정책 수정</button></div></div><div class="settings-card"><div class="setting-row"><div class="setting-label"><strong>이메일 + 비밀번호</strong><small>Native 엔진에서 AuthHub가 직접 인증합니다.</small></div><div class="setting-value inline"><span class="badge ${envObj.email_password_enabled?'green':'gray'}">${envObj.email_password_enabled?'Enabled':'Disabled'}</span></div></div><div class="setting-row"><div class="setting-label"><strong>신규 회원가입</strong><small>외부 프로젝트의 신규 가입 허용 여부입니다.</small></div><div class="setting-value inline"><span class="badge ${envObj.signup_enabled?'green':'gray'}">${envObj.signup_enabled?'Allowed':'Blocked'}</span></div></div><div class="setting-row"><div class="setting-label"><strong>관리자 승인</strong><small>승인 전에는 로그인 완료 후 서비스 세션이 발급되지 않습니다.</small></div><div class="setting-value inline"><span class="badge ${envObj.approval_required?'amber':'green'}">${envObj.approval_required?'Required':'Not required'}</span></div></div><div class="setting-row"><div class="setting-label"><strong>기본 Role</strong><small>신규 가입자가 최초로 받는 프로젝트 권한입니다.</small></div><div class="setting-value inline"><code>${esc(envObj.default_role||'user')}</code></div></div><div class="setting-row"><div class="setting-label"><strong>Session lifetime</strong><small>Access Token / Refresh Token 유효기간입니다.</small></div><div class="setting-value inline"><code>${envObj.session_ttl_minutes} min</code><code>${envObj.refresh_ttl_days} days refresh</code></div></div></div></section><section class="section"><div class="section-title"><div><h2>Redirect URIs</h2><p>등록된 주소로만 OAuth 인증 결과를 돌려보냅니다.</p></div><div class="section-actions"><button class="btn" data-add-uri><i class="bi bi-plus-lg"></i>URI 추가</button></div></div><div class="settings-card">${uriHtml||empty('bi-link-45deg','등록된 Redirect URI가 없습니다','OAuth 로그인 전 프로젝트의 callback 주소를 등록해야 합니다.')}</div></section>`;
    app.innerHTML=shell('projects',p.name,content,'Projects'); bindCommon();
    app.querySelectorAll('[data-env]').forEach(b=>b.onclick=()=>{state.envName=b.dataset.env;projectView(id)});
    app.querySelectorAll('[data-provider]').forEach(b=>b.onclick=()=>openProviderModal(id,envObj,b.dataset.provider));
    app.querySelector('[data-bridge]').onclick=()=>openBridgeModal(id);
    app.querySelector('[data-engine-config]').onclick=()=>openEngineModal(id,envObj);
    app.querySelector('[data-policy]').onclick=()=>openPolicyModal(id,envObj);
    app.querySelector('[data-add-uri]').onclick=()=>openUriModal(id,envObj);
    app.querySelectorAll('[data-delete-uri]').forEach(b=>b.onclick=async()=>{if(!confirm('이 Redirect URI를 삭제할까요?'))return;loading(true);try{await request(`/admin/redirect-uris/${b.dataset.deleteUri}`,{method:'DELETE'});toast('Redirect URI를 삭제했습니다.');await projectView(id)}catch(e){toast(e.message,'error')}finally{loading(false)}});
  }

  function modal(title,body,saveLabel='저장'){
    const wrap=document.createElement('div');wrap.className='modal-backdrop';wrap.innerHTML=`<section class="modal"><header class="modal-head"><h3>${esc(title)}</h3><button class="close" type="button" data-close><i class="bi bi-x-lg"></i></button></header><div class="modal-body">${body}</div><footer class="modal-foot"><button class="btn" data-close>취소</button><button class="btn primary" data-save>${esc(saveLabel)}</button></footer></section>`;document.body.appendChild(wrap);wrap.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>wrap.remove());wrap.addEventListener('click',e=>{if(e.target===wrap)wrap.remove()});return wrap;
  }
  function projectCreateMessage(message){return ({invalid_project:'프로젝트 이름과 프로젝트 키 형식을 확인하십시오.',project_key_exists:'이미 사용 중인 프로젝트 키입니다.',project_create_failed:'프로젝트 생성 중 서버 오류가 발생했습니다.'})[message]||message}
  function projectCreateMessage(code){
    return ({
      monitor_catalog_unavailable:'MONITOR 프로젝트 목록을 가져오지 못했습니다.',
      invalid_monitor_project_id:'MONITOR 프로젝트를 선택하세요.',
      monitor_project_not_found:'MONITOR에서 해당 프로젝트를 찾지 못했습니다.',
      monitor_project_disabled:'비활성화된 MONITOR 프로젝트입니다.',
      monitor_project_already_linked:'이미 AuthHub에 연결된 프로젝트입니다.',
      project_create_failed:'프로젝트 연결에 실패했습니다.'
    })[code]||code;
  }
  async function openCreateProject(){
    const m=modal('MONITOR 프로젝트 연결',`<div class="monitor-picker-loading"><i class="bi bi-arrow-repeat"></i> MONITOR 프로젝트 목록을 불러오는 중입니다.</div>`,'AuthHub 연결');
    const body=m.querySelector('.modal-body'); const save=m.querySelector('[data-save]'); save.disabled=true;
    let items=[];
    try {
      const data=await request('/admin/monitor/projects'); items=data.items||[];
    } catch(e) {
      body.innerHTML=`<div class="error-box">${esc(projectCreateMessage(e.message))}</div><div class="login-note"><i class="bi bi-shield-lock"></i><span>HUB_TOKEN은 AuthHub 백엔드에서만 MONITOR에 전달됩니다.</span></div>`;
      return;
    }
    const normalize=v=>String(v||'').normalize('NFKC').toLocaleLowerCase();
    const searchText=x=>[x.name,x.project_id,x.label,x.public_url,x.category].filter(Boolean).map(normalize).join(' ');
    let selected=null;
    let filtered=[];
    let activeIndex=-1;
    body.innerHTML=`<label class="field"><span>MONITOR 프로젝트</span><div class="monitor-combobox" id="m-monitor-combobox"><div class="monitor-combobox-input"><input class="input" id="m-monitor-project" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="m-monitor-options" placeholder="프로젝트명, pNN, URL 검색" autocomplete="off"><button type="button" class="monitor-combobox-toggle" tabindex="-1" aria-label="프로젝트 목록 열기"><i class="bi bi-chevron-down"></i></button></div><div class="monitor-combobox-menu" id="m-monitor-options" role="listbox"></div></div><small>이름·pNN·URL을 입력하면 같은 목록에서 바로 필터링됩니다. pNN은 MONITOR가 발급한 값을 그대로 사용합니다.</small></label><div id="m-monitor-selection" class="monitor-selection-line"></div><label class="field"><span>AuthHub 메모</span><textarea class="textarea" id="m-desc" placeholder="선택 사항"></textarea></label>`;
    const combo=body.querySelector('#m-monitor-combobox');
    const input=body.querySelector('#m-monitor-project');
    const menu=body.querySelector('#m-monitor-options');
    const toggle=body.querySelector('.monitor-combobox-toggle');
    const selection=body.querySelector('#m-monitor-selection');
    const openMenu=()=>{combo.classList.add('open');input.setAttribute('aria-expanded','true')};
    const closeMenu=()=>{combo.classList.remove('open');input.setAttribute('aria-expanded','false');activeIndex=-1};
    const selectable=x=>!!x.enabled&&!x.linked;
    const setSelection=item=>{
      selected=item;
      input.value=item.label||`${item.name} (${item.project_id})`;
      selection.innerHTML=`<strong>${esc(item.label||`${item.name} (${item.project_id})`)}</strong><span>${esc(item.public_url||'공개 URL 없음')}${item.category?` · ${esc(item.category)}`:''}</span>`;
      save.disabled=!selectable(item);
      closeMenu();
    };
    const clearSelection=()=>{selected=null;selection.innerHTML='';save.disabled=true};
    const renderResults=()=>{
      const tokens=normalize(input.value).trim().split(/\s+/).filter(Boolean);
      filtered=items.filter(x=>tokens.every(token=>searchText(x).includes(token)));
      if(!filtered.length){
        menu.innerHTML='<div class="monitor-combobox-empty">검색 결과가 없습니다.</div>';
        activeIndex=-1;
        return;
      }
      menu.innerHTML=filtered.map((x,i)=>{
        const disabled=!selectable(x);
        const status=x.linked?'연결됨':!x.enabled?'비활성':'';
        return `<button type="button" class="monitor-combobox-option${disabled?' disabled':''}" role="option" data-index="${i}" aria-disabled="${disabled?'true':'false'}"><span><strong>${esc(x.label||`${x.name} (${x.project_id})`)}</strong><small>${esc(x.public_url||'공개 URL 없음')}${x.category?` · ${esc(x.category)}`:''}</small></span>${status?`<em>${esc(status)}</em>`:''}</button>`;
      }).join('');
      menu.querySelectorAll('.monitor-combobox-option').forEach(btn=>btn.onclick=()=>{
        const item=filtered[Number(btn.dataset.index)];
        if(item&&selectable(item))setSelection(item);
      });
      if(activeIndex>=filtered.length)activeIndex=-1;
    };
    const moveActive=direction=>{
      if(!filtered.length)return;
      let i=activeIndex;
      for(let count=0;count<filtered.length;count++){
        i=(i+direction+filtered.length)%filtered.length;
        if(selectable(filtered[i])){activeIndex=i;break;}
      }
      menu.querySelectorAll('.monitor-combobox-option').forEach((el,idx)=>el.classList.toggle('active',idx===activeIndex));
      menu.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({block:'nearest'});
    };
    input.onfocus=()=>{renderResults();openMenu()};
    input.onclick=()=>{renderResults();openMenu()};
    input.oninput=()=>{clearSelection();activeIndex=-1;renderResults();openMenu()};
    input.onkeydown=e=>{
      if(e.key==='ArrowDown'){e.preventDefault();if(!combo.classList.contains('open')){renderResults();openMenu()}moveActive(1);return;}
      if(e.key==='ArrowUp'){e.preventDefault();if(!combo.classList.contains('open')){renderResults();openMenu()}moveActive(-1);return;}
      if(e.key==='Enter'&&combo.classList.contains('open')){e.preventDefault();if(activeIndex>=0&&selectable(filtered[activeIndex]))setSelection(filtered[activeIndex]);return;}
      if(e.key==='Escape'){e.preventDefault();closeMenu();}
    };
    toggle.onclick=()=>{
      if(combo.classList.contains('open'))closeMenu();
      else {input.focus();renderResults();openMenu();}
    };
    m.addEventListener('click',e=>{if(!combo.contains(e.target))closeMenu()});
    renderResults();
    save.onclick=async()=>{
      if(save.disabled||!selected)return;
      save.disabled=true;loading(true);
      try{
        const r=await request('/admin/projects',{method:'POST',body:JSON.stringify({monitorProjectId:selected.project_id,description:body.querySelector('#m-desc').value})});
        m.remove();toast(r.existing?'이미 연결된 프로젝트를 열었습니다.':'MONITOR 프로젝트를 AuthHub에 연결했습니다.');await bootstrap();navigate(`/project/${r.id}`)
      }catch(e){toast(projectCreateMessage(e.message),'error');save.disabled=false}finally{loading(false)}
    };
  }

  async function openBridgeModal(projectId){
    loading(true);let b;try{b=await request(`/admin/projects/${encodeURIComponent(projectId)}/bridge`)}catch(e){toast(e.message,'error');return}finally{loading(false)}
    const m=modal('Hub Bridge 설정',`<label class="field"><span>Endpoint</span><input class="input" id="bridge-url" value="${esc(b.url||'MONITOR 공개 URL 미등록')}" readonly><small>MONITOR public_url origin + /api/hub/events로 자동 관리됩니다.</small></label><label class="field"><span>Bridge Secret</span><div class="secret-wrap"><input class="input" id="bridge-secret" type="password" value="${esc(b.secret||'')}" readonly><button class="btn icon" type="button" data-bridge-show><i class="bi bi-eye"></i></button><button class="btn icon" type="button" data-copy="${esc(b.secret||'')}"><i class="bi bi-copy"></i></button></div><small>프로젝트의 /api/hub/events에서 X-AuthHub-Signature HMAC-SHA256 검증에 사용합니다.</small></label><div class="login-note"><i class="bi bi-diagram-3"></i><span>schema_version: 1 · hub: auth · X-SuaveForge-Hub: auth</span></div>`,'Secret 재발급');
    const secret=m.querySelector('#bridge-secret');m.querySelector('[data-bridge-show]').onclick=()=>{secret.type=secret.type==='password'?'text':'password'};
    m.querySelector('[data-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(b.secret||'');toast('Bridge Secret을 복사했습니다.')}catch{toast('복사하지 못했습니다.','error')}};
    m.querySelector('[data-save]').onclick=async()=>{if(!confirm('기존 Bridge Secret은 즉시 무효화됩니다. 재발급할까요?'))return;loading(true);try{b=await request(`/admin/projects/${encodeURIComponent(projectId)}/bridge`,{method:'POST',body:'{}'});secret.value=b.secret||'';secret.type='text';m.querySelector('[data-copy]').dataset.copy=b.secret||'';toast('Bridge Secret을 재발급했습니다.')}catch(e){toast(e.message,'error')}finally{loading(false)}};
  }

  function openProviderModal(projectId,envObj,providerName){const p=envObj.providers.find(x=>x.provider===providerName)||{};const meta=providers[providerName]||{};const m=modal(`${meta.label||providerName} 연결`, `<div class="check-row"><div><strong>로그인 수단 활성화</strong><small>프로젝트 공개 설정에 즉시 반영됩니다.</small></div><button class="switch ${p.enabled?'on':''}" id="m-enabled" type="button"></button></div><label class="field"><span>Client ID</span><input class="input" id="m-client" value="${esc(p.client_id||'')}" autocomplete="off"></label><label class="field"><span>Client Secret</span><div class="secret-wrap"><input class="input" id="m-secret" type="password" placeholder="${p.has_secret?'저장된 Secret 유지 · 변경 시에만 입력':'Secret 입력'}" autocomplete="new-password"></div><small>저장된 Secret은 평문으로 다시 표시하지 않습니다.</small></label><label class="field"><span>Scopes</span><input class="input" id="m-scopes" value="${esc(p.scopes||meta.scopes||'')}" autocomplete="off"></label>${providerName==='oidc'?`<label class="field"><span>Discovery URL</span><input class="input" id="m-discovery" placeholder="https://idp.example.com/.well-known/openid-configuration"></label>`:''}`);const sw=m.querySelector('#m-enabled');sw.onclick=()=>sw.classList.toggle('on');m.querySelector('[data-save]').onclick=async()=>{const body={enabled:sw.classList.contains('on'),clientId:m.querySelector('#m-client').value.trim(),scopes:m.querySelector('#m-scopes').value.trim()};const secret=m.querySelector('#m-secret').value;if(secret)body.clientSecret=secret;if(providerName==='oidc'){const discovery=m.querySelector('#m-discovery').value.trim();if(discovery)body.extra={discoveryUrl:discovery}}loading(true);try{await request(`/admin/environments/${envObj.id}/providers/${providerName}`,{method:'PUT',body:JSON.stringify(body)});m.remove();toast(`${meta.label||providerName} 설정을 저장했습니다.`);await projectView(projectId)}catch(e){toast(e.message,'error')}finally{loading(false)}}}
  function openEngineModal(projectId,envObj){const m=modal('Authentication engine',`<label class="field"><span>인증 엔진</span><select class="select" id="m-engine"><option value="native" ${envObj.auth_engine==='native'?'selected':''}>Native · AuthHub</option><option value="supabase" ${envObj.auth_engine==='supabase'?'selected':''}>Supabase bridge</option><option value="firebase" ${envObj.auth_engine==='firebase'?'selected':''}>Firebase bridge</option></select><small>외부 엔진은 해당 서비스에서 발급한 토큰을 검증한 후 AuthHub 공통 세션으로 교환합니다.</small></label><div id="engine-fields"></div>`);const sel=m.querySelector('#m-engine'),fields=m.querySelector('#engine-fields');const draw=()=>{fields.innerHTML=sel.value==='supabase'?`<label class="field"><span>Supabase URL</span><input class="input" id="e-url" placeholder="https://xxxx.supabase.co"></label><label class="field"><span>Anon key</span><input class="input" id="e-anon" type="password" placeholder="새 설정값 입력"></label>`:sel.value==='firebase'?`<label class="field"><span>Firebase Project ID</span><input class="input" id="e-project" placeholder="project-id"></label>`:`<div class="login-note"><i class="bi bi-check-circle"></i><span>추가 외부 키 없이 AuthHub DB와 JWT를 사용합니다.</span></div>`};sel.onchange=draw;draw();m.querySelector('[data-save]').onclick=async()=>{let config={};if(sel.value==='supabase')config={url:m.querySelector('#e-url').value.trim(),anonKey:m.querySelector('#e-anon').value.trim()};if(sel.value==='firebase')config={projectId:m.querySelector('#e-project').value.trim()};loading(true);try{await request(`/admin/environments/${envObj.id}/engine`,{method:'PUT',body:JSON.stringify({engine:sel.value,config})});m.remove();toast('인증 엔진을 변경했습니다.');await projectView(projectId)}catch(e){toast(e.message,'error')}finally{loading(false)}}}
  function openPolicyModal(projectId,envObj){const m=modal('Login policy',`<div class="check-row"><div><strong>이메일 + 비밀번호</strong><small>Native 엔진 직접 로그인</small></div><button class="switch ${envObj.email_password_enabled?'on':''}" id="p-email"></button></div><div class="check-row"><div><strong>신규 회원가입</strong><small>신규 Membership 생성 허용</small></div><button class="switch ${envObj.signup_enabled?'on':''}" id="p-signup"></button></div><div class="check-row"><div><strong>관리자 승인제</strong><small>승인 전 서비스 세션 발급 차단</small></div><button class="switch ${envObj.approval_required?'on':''}" id="p-approval"></button></div><label class="field" style="margin-top:14px"><span>신규 가입 기본 Role</span><input class="input" id="p-role" value="${esc(envObj.default_role||'user')}" maxlength="64"><small>브라우저가 Role을 지정할 수 없으며, 가입 후 관리자가 사용자별로 변경할 수 있습니다.</small></label><div class="form-row" style="margin-top:14px"><label class="field"><span>Access Token · 분</span><input class="input" id="p-access" type="number" min="5" max="1440" value="${envObj.session_ttl_minutes}"></label><label class="field"><span>Refresh Token · 일</span><input class="input" id="p-refresh" type="number" min="1" max="365" value="${envObj.refresh_ttl_days}"></label></div>`);m.querySelectorAll('.switch').forEach(sw=>sw.onclick=()=>sw.classList.toggle('on'));m.querySelector('[data-save]').onclick=async()=>{loading(true);try{await request(`/admin/environments/${envObj.id}`,{method:'PATCH',body:JSON.stringify({emailPasswordEnabled:m.querySelector('#p-email').classList.contains('on'),signupEnabled:m.querySelector('#p-signup').classList.contains('on'),approvalRequired:m.querySelector('#p-approval').classList.contains('on'),defaultRole:m.querySelector('#p-role').value.trim(),sessionTtlMinutes:Number(m.querySelector('#p-access').value),refreshTtlDays:Number(m.querySelector('#p-refresh').value)})});m.remove();toast('로그인 정책을 저장했습니다.');await projectView(projectId)}catch(e){toast(e.message,'error')}finally{loading(false)}}}
  function openUriModal(projectId,envObj){const m=modal('Redirect URI 추가',`<label class="field"><span>Callback URL</span><input class="input" id="m-uri" type="url" placeholder="https://service.example.com/auth/callback"><small>OAuth 완료 후 돌아갈 정확한 URL을 등록하세요. 등록되지 않은 주소는 거부됩니다.</small></label>`,'추가');m.querySelector('[data-save]').onclick=async()=>{loading(true);try{await request(`/admin/environments/${envObj.id}/redirect-uris`,{method:'POST',body:JSON.stringify({uri:m.querySelector('#m-uri').value.trim()})});m.remove();toast('Redirect URI를 추가했습니다.');await projectView(projectId)}catch(e){toast(e.message,'error')}finally{loading(false)}}}

  async function openUserModal(userId){
    loading(true);let u;try{u=await request(`/admin/users/${userId}`)}catch(e){toast(e.message,'error');return}finally{loading(false)}
    const memberships=(u.memberships||[]).map((m,i)=>`<div class="membership-block" data-membership data-env="${esc(m.environment_id)}"><div class="membership-head"><div><strong>${esc(m.project_name)}</strong><small>${esc(m.project_slug)} · ${esc(m.environment_name)}</small></div><span class="badge ${m.status==='active'?'green':m.status==='pending'?'amber':'red'}">${esc(m.status)}</span></div><div class="form-row"><label class="field"><span>Role</span><input class="input" data-role value="${esc(m.role)}" maxlength="64"></label><label class="field"><span>Status</span><select class="select" data-status><option value="active" ${m.status==='active'?'selected':''}>active</option><option value="pending" ${m.status==='pending'?'selected':''}>pending</option><option value="suspended" ${m.status==='suspended'?'selected':''}>suspended</option></select></label></div><button class="btn membership-save" data-membership-save type="button"><i class="bi bi-check2"></i>이 프로젝트 권한 저장</button></div>`).join('');
    const ids=(u.identities||[]).map(x=>`<span class="badge gray">${esc(x.provider)}</span>`).join(' ')||'<span class="muted">이메일 계정</span>';
    const m=modal('사용자 권한 관리',`<div class="user-summary"><div class="project-icon">${esc(initials(u.display_name||u.email))}</div><div><strong>${esc(u.display_name||'이름 없음')}</strong><small>${esc(u.email)}</small><div class="identity-badges">${ids}</div></div></div><div class="check-row"><div><strong>통합 계정 상태</strong><small>Blocked 시 모든 프로젝트 Refresh 세션을 즉시 폐기합니다.</small></div><select class="select compact" id="u-status"><option value="active" ${u.status==='active'?'selected':''}>active</option><option value="blocked" ${u.status==='blocked'?'selected':''}>blocked</option></select></div><div class="modal-section-title">Project memberships</div>${memberships||'<div class="empty-mini">가입된 프로젝트가 없습니다.</div>'}`,'계정 상태 저장');
    m.querySelector('[data-save]').onclick=async()=>{loading(true);try{await request(`/admin/users/${u.id}`,{method:'PATCH',body:JSON.stringify({status:m.querySelector('#u-status').value})});toast('계정 상태를 저장했습니다.');m.remove();await usersView()}catch(e){toast(e.message,'error')}finally{loading(false)}};
    m.querySelectorAll('[data-membership-save]').forEach(btn=>btn.onclick=async()=>{const block=btn.closest('[data-membership]');loading(true);try{await request(`/admin/memberships/${encodeURIComponent(block.dataset.env)}/${encodeURIComponent(u.id)}`,{method:'PATCH',body:JSON.stringify({role:block.querySelector('[data-role]').value.trim(),status:block.querySelector('[data-status]').value})});toast('프로젝트 권한을 저장했습니다.');m.remove();await openUserModal(u.id)}catch(e){toast(e.message,'error')}finally{loading(false)}});
  }
  async function usersView(query=''){
    loading(true);try{state.users=(await request(`/admin/users${query?`?q=${encodeURIComponent(query)}`:''}`)).items||[]}catch(e){toast(e.message,'error')}finally{loading(false)}
    const rows=state.users.map(u=>`<tr data-user="${esc(u.id)}" data-click><td><div class="project-cell"><div class="project-icon">${esc(initials(u.display_name||u.email))}</div><div><strong>${esc(u.display_name||'이름 없음')}</strong><small>${esc(u.email)}</small></div></div></td><td><span class="badge ${u.email_verified?'green':'amber'}">${u.email_verified?'Verified':'Unverified'}</span></td><td><span class="badge ${u.status==='active'?'green':'red'}">${esc(u.status)}</span></td><td>${u.memberships||0}</td><td>${date(u.created_at)}</td><td><i class="bi bi-chevron-right"></i></td></tr>`).join('');
    const content=pageHead('GLOBAL IDENTITY','Users','동일 사용자는 하나의 Identity로 관리하고 프로젝트 가입 상태와 권한만 분리합니다.')+`<div class="filter-row"><label class="search"><i class="bi bi-search"></i><input id="user-search" value="${esc(query)}" placeholder="이메일 또는 이름 검색"></label></div><section class="card">${rows?`<table class="table"><thead><tr><th>User</th><th>Email</th><th>Status</th><th>Projects</th><th>Created</th><th></th></tr></thead><tbody>${rows}</tbody></table>`:empty('bi-people','등록된 사용자가 없습니다','프로젝트에서 첫 회원가입 또는 소셜 로그인이 완료되면 여기에 표시됩니다.')}</section>`;
    app.innerHTML=shell('users','Users',content);bindCommon();app.querySelectorAll('[data-user]').forEach(r=>r.onclick=()=>openUserModal(r.dataset.user));
    const search=document.getElementById('user-search');search.onkeydown=e=>{if(e.key==='Enter')usersView(search.value.trim())};
  }
  async function auditView(){loading(true);try{state.audit=(await request('/admin/audit')).items||[]}catch(e){toast(e.message,'error')}finally{loading(false)}const rows=state.audit.map(a=>`<tr><td class="mono">${date(a.created_at)}</td><td><strong style="font-size:11px">${esc(a.action)}</strong></td><td>${esc(a.actor_type)}${a.actor_id?` · <span class="mono">${esc(String(a.actor_id).slice(0,18))}</span>`:''}</td><td>${a.project_id?`<span class="mono">${esc(String(a.project_id).slice(0,8))}</span>`:'—'}</td><td>${esc(a.ip||'—')}</td></tr>`).join('');const content=pageHead('SECURITY TRAIL','Audit log','로그인 성공·실패, 프로젝트 설정과 인증 정책 변경을 추적합니다.')+`<section class="card">${rows?`<table class="table"><thead><tr><th>Time</th><th>Action</th><th>Actor</th><th>Project</th><th>IP</th></tr></thead><tbody>${rows}</tbody></table>`:empty('bi-activity','아직 이벤트가 없습니다','인증 또는 설정 변경이 발생하면 감사 로그가 기록됩니다.')}</section>`;app.innerHTML=shell('audit','Audit log',content);bindCommon()}
  function integrationView(){const content=pageHead('INTEGRATION','Integration','프로젝트 UI는 그대로 두고 AuthHub 공개 설정과 API만 연결합니다.')+`<div class="grid-2"><section class="card"><div class="card-head"><div><h2>권장 연결 흐름</h2><p>Native 엔진 기준</p></div></div><div class="card-body quick-list"><div class="quick-row"><i class="bi bi-1-circle"></i><div><strong>프로젝트 설정 조회</strong><small>GET /v1/config/:project</small></div></div><div class="quick-row"><i class="bi bi-2-circle"></i><div><strong>자체 로그인 UI 렌더링</strong><small>providers 목록만 프로젝트 디자인에 반영</small></div></div><div class="quick-row"><i class="bi bi-3-circle"></i><div><strong>OAuth 시작</strong><small>/v1/oauth/:project/:provider/start</small></div></div><div class="quick-row"><i class="bi bi-4-circle"></i><div><strong>일회용 코드 교환</strong><small>POST /v1/auth/:project/exchange</small></div></div><div class="quick-row"><i class="bi bi-5-circle"></i><div><strong>JWT 검증</strong><small>/.well-known/jwks.json</small></div></div></div></section><section class="card"><div class="card-head"><div><h2>엔진 선택 기준</h2><p>로그인 수단과 인증 엔진은 별개입니다.</p></div></div><div class="card-body quick-list"><div class="quick-row"><i class="bi bi-shield-check"></i><div><strong>Native</strong><small>신규 구축 기본 · 최소 의존성</small></div></div><div class="quick-row"><i class="bi bi-database"></i><div><strong>Supabase bridge</strong><small>고객이 Supabase Auth를 요구할 때</small></div></div><div class="quick-row"><i class="bi bi-fire"></i><div><strong>Firebase bridge</strong><small>기존 Firebase 회원체계를 유지할 때</small></div></div></div></section></div>`;app.innerHTML=shell('docs','Integration',content);bindCommon()}

  function bindCommon(){app.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>navigate(b.dataset.nav));app.querySelectorAll('[data-project]').forEach(r=>r.onclick=()=>navigate(`/project/${r.dataset.project}`));app.querySelectorAll('[data-create-project]').forEach(b=>b.onclick=openCreateProject);app.querySelectorAll('[data-logout]').forEach(b=>b.onclick=()=>logout());app.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.copy);toast('복사했습니다.')}catch{toast('복사하지 못했습니다.','error')}})}
  async function render(){
    try{state.adminStatus=await request('/admin/status')}catch(e){app.innerHTML=`<div class="error-box" style="margin:40px">${esc(e.message)}</div>`;return}
    if(state.adminStatus.setup_required)return setupView(state.adminStatus);
    if(!state.adminStatus.authenticated)return loginView();
    await bootstrap();const route=location.hash.slice(1)||'/overview';state.route=route;if(route==='/overview')return overviewView();if(route==='/projects')return projectsView();if(route.startsWith('/project/'))return projectView(route.split('/')[2]);if(route==='/users')return usersView();if(route==='/audit')return auditView();if(route==='/integration')return integrationView();navigate('/overview')}
  addEventListener('hashchange',()=>{render()});render();
})();
