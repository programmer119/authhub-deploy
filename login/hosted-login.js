const params = new URLSearchParams(location.search);
const project = String(params.get('project') || '').trim();
const environment = String(params.get('environment') || 'production').trim();
const redirectUri = String(params.get('redirect_uri') || '').trim();
const state = String(params.get('state') || '');
const requestedMode = params.get('mode') === 'signup' ? 'signup' : 'login';
const requestedLang = String(params.get('lang') || '').trim();
const apiBase = String(globalThis.AUTHHUB_CONFIG?.apiBase || '').replace(/\/$/, '');

const supported = new Set(['ko','en','ja','zh-TW','zh-CN','vi','id','es']);
const browserLang = navigator.language || 'ko';
const normalizedBrowserLang = browserLang.startsWith('zh-TW') || browserLang.startsWith('zh-HK') ? 'zh-TW'
  : browserLang.startsWith('zh') ? 'zh-CN'
  : browserLang.startsWith('ja') ? 'ja'
  : browserLang.startsWith('vi') ? 'vi'
  : browserLang.startsWith('id') ? 'id'
  : browserLang.startsWith('es') ? 'es'
  : browserLang.startsWith('en') ? 'en' : 'ko';
const lang = supported.has(requestedLang) ? requestedLang : normalizedBrowserLang;

document.documentElement.lang = lang;

const copy = {
  ko:{login:'로그인',signup:'회원가입',subtitle:'하나의 AuthHub 화면에서 안전하게 로그인합니다.',loading:'로그인 수단을 불러오는 중…',display:'표시 이름',email:'이메일',password:'비밀번호',pwHint:'10자 이상 입력하세요.',submitLogin:'로그인',submitSignup:'회원가입',processing:'처리 중…',or:'또는 이메일로',google:'Google로 계속하기',kakao:'카카오 로그인',naver:'네이버로 계속하기',microsoft:'Microsoft로 계속하기',apple:'Apple로 계속하기',close:'닫기',security:'인증은 AuthHub에서 처리되며 비밀번호와 토큰을 서비스 화면에 노출하지 않습니다.',invalid:'잘못된 로그인 요청입니다.',unavailable:'로그인 서비스를 연결할 수 없습니다. 잠시 후 다시 시도하세요.',noMethods:'사용 가능한 로그인 수단이 없습니다.',pending:'회원 승인을 기다리고 있습니다.',accountExists:'이미 등록된 이메일입니다. 로그인으로 전환하세요.',badCredentials:'이메일 또는 비밀번호가 맞지 않습니다.',signupDisabled:'현재 회원가입이 비활성화되어 있습니다.'},
  en:{login:'Sign in',signup:'Create account',subtitle:'Sign in safely from one shared AuthHub screen.',loading:'Loading sign-in options…',display:'Display name',email:'Email',password:'Password',pwHint:'Use at least 10 characters.',submitLogin:'Sign in',submitSignup:'Create account',processing:'Processing…',or:'or continue with email',google:'Continue with Google',kakao:'Login with Kakao',naver:'Continue with NAVER',microsoft:'Continue with Microsoft',apple:'Continue with Apple',close:'Close',security:'AuthHub handles authentication without exposing passwords or tokens to the service UI.',invalid:'This sign-in request is invalid.',unavailable:'The sign-in service is unavailable. Try again shortly.',noMethods:'No sign-in methods are available.',pending:'Your account is waiting for approval.',accountExists:'This email already exists. Switch to sign in.',badCredentials:'Email or password is incorrect.',signupDisabled:'Account creation is currently disabled.'},
  ja:{login:'ログイン',signup:'アカウント作成',subtitle:'共通のAuthHub画面から安全にログインします。',loading:'ログイン方法を読み込み中…',display:'表示名',email:'メール',password:'パスワード',pwHint:'10文字以上で入力してください。',submitLogin:'ログイン',submitSignup:'アカウント作成',processing:'処理中…',or:'またはメールで',google:'Googleで続ける',kakao:'Kakaoでログイン',naver:'NAVERで続ける',microsoft:'Microsoftで続ける',apple:'Appleで続ける',close:'閉じる',security:'認証はAuthHubで処理され、パスワードやトークンはサービス画面に公開されません。',invalid:'ログイン要求が正しくありません。',unavailable:'ログインサービスに接続できません。しばらくしてから再試行してください。',noMethods:'利用できるログイン方法がありません。',pending:'アカウント承認待ちです。',accountExists:'このメールは登録済みです。ログインに切り替えてください。',badCredentials:'メールまたはパスワードが正しくありません。',signupDisabled:'現在アカウント作成は無効です。'},
  'zh-TW':{login:'登入',signup:'建立帳戶',subtitle:'透過共用 AuthHub 畫面安全登入。',loading:'正在載入登入方式…',display:'顯示名稱',email:'電子郵件',password:'密碼',pwHint:'請輸入至少 10 個字元。',submitLogin:'登入',submitSignup:'建立帳戶',processing:'處理中…',or:'或使用電子郵件',google:'使用 Google 繼續',kakao:'使用 Kakao 登入',naver:'使用 NAVER 繼續',microsoft:'使用 Microsoft 繼續',apple:'使用 Apple 繼續',close:'關閉',security:'驗證由 AuthHub 處理，不會在服務畫面暴露密碼或權杖。',invalid:'登入要求無效。',unavailable:'目前無法連線登入服務，請稍後再試。',noMethods:'目前沒有可用的登入方式。',pending:'帳戶正在等待核准。',accountExists:'此電子郵件已存在，請切換到登入。',badCredentials:'電子郵件或密碼不正確。',signupDisabled:'目前已停用建立帳戶。'},
  'zh-CN':{login:'登录',signup:'创建账户',subtitle:'通过统一的 AuthHub 页面安全登录。',loading:'正在加载登录方式…',display:'显示名称',email:'电子邮箱',password:'密码',pwHint:'请输入至少 10 个字符。',submitLogin:'登录',submitSignup:'创建账户',processing:'处理中…',or:'或使用电子邮箱',google:'使用 Google 继续',kakao:'使用 Kakao 登录',naver:'使用 NAVER 继续',microsoft:'使用 Microsoft 继续',apple:'使用 Apple 继续',close:'关闭',security:'认证由 AuthHub 处理，不会在服务页面暴露密码或令牌。',invalid:'登录请求无效。',unavailable:'当前无法连接登录服务，请稍后再试。',noMethods:'当前没有可用的登录方式。',pending:'账户正在等待审核。',accountExists:'此邮箱已存在，请切换到登录。',badCredentials:'邮箱或密码不正确。',signupDisabled:'当前已停用创建账户。'},
  vi:{login:'Đăng nhập',signup:'Tạo tài khoản',subtitle:'Đăng nhập an toàn từ một màn hình AuthHub dùng chung.',loading:'Đang tải phương thức đăng nhập…',display:'Tên hiển thị',email:'Email',password:'Mật khẩu',pwHint:'Nhập ít nhất 10 ký tự.',submitLogin:'Đăng nhập',submitSignup:'Tạo tài khoản',processing:'Đang xử lý…',or:'hoặc tiếp tục bằng email',google:'Tiếp tục với Google',kakao:'Đăng nhập bằng Kakao',naver:'Tiếp tục với NAVER',microsoft:'Tiếp tục với Microsoft',apple:'Tiếp tục với Apple',close:'Đóng',security:'AuthHub xử lý xác thực mà không hiển thị mật khẩu hoặc token trên giao diện dịch vụ.',invalid:'Yêu cầu đăng nhập không hợp lệ.',unavailable:'Không thể kết nối dịch vụ đăng nhập. Hãy thử lại sau.',noMethods:'Không có phương thức đăng nhập khả dụng.',pending:'Tài khoản đang chờ duyệt.',accountExists:'Email này đã tồn tại. Hãy chuyển sang đăng nhập.',badCredentials:'Email hoặc mật khẩu không đúng.',signupDisabled:'Hiện không thể tạo tài khoản.'},
  id:{login:'Masuk',signup:'Buat akun',subtitle:'Masuk dengan aman melalui satu layar AuthHub bersama.',loading:'Memuat opsi masuk…',display:'Nama tampilan',email:'Email',password:'Kata sandi',pwHint:'Gunakan minimal 10 karakter.',submitLogin:'Masuk',submitSignup:'Buat akun',processing:'Memproses…',or:'atau lanjutkan dengan email',google:'Lanjutkan dengan Google',kakao:'Masuk dengan Kakao',naver:'Lanjutkan dengan NAVER',microsoft:'Lanjutkan dengan Microsoft',apple:'Lanjutkan dengan Apple',close:'Tutup',security:'AuthHub menangani autentikasi tanpa mengekspos kata sandi atau token di UI layanan.',invalid:'Permintaan masuk tidak valid.',unavailable:'Layanan masuk tidak tersedia. Coba lagi sebentar lagi.',noMethods:'Tidak ada metode masuk yang tersedia.',pending:'Akun sedang menunggu persetujuan.',accountExists:'Email ini sudah terdaftar. Beralih ke masuk.',badCredentials:'Email atau kata sandi salah.',signupDisabled:'Pembuatan akun sedang dinonaktifkan.'},
  es:{login:'Iniciar sesión',signup:'Crear cuenta',subtitle:'Accede de forma segura desde una única pantalla compartida de AuthHub.',loading:'Cargando opciones de acceso…',display:'Nombre visible',email:'Correo electrónico',password:'Contraseña',pwHint:'Usa al menos 10 caracteres.',submitLogin:'Iniciar sesión',submitSignup:'Crear cuenta',processing:'Procesando…',or:'o continúa con correo',google:'Continuar con Google',kakao:'Iniciar sesión con Kakao',naver:'Continuar con NAVER',microsoft:'Continuar con Microsoft',apple:'Continuar con Apple',close:'Cerrar',security:'AuthHub gestiona la autenticación sin exponer contraseñas ni tokens en la interfaz del servicio.',invalid:'La solicitud de acceso no es válida.',unavailable:'El servicio de acceso no está disponible. Inténtalo de nuevo en un momento.',noMethods:'No hay métodos de acceso disponibles.',pending:'La cuenta está pendiente de aprobación.',accountExists:'Este correo ya existe. Cambia a iniciar sesión.',badCredentials:'El correo o la contraseña no son correctos.',signupDisabled:'La creación de cuentas está desactivada.'}
};
const c = copy[lang] || copy.ko;

const $ = (id) => document.getElementById(id);
const els = {
  projectName:$('project-name'), title:$('auth-title'), subtitle:$('auth-subtitle'), loginTab:$('login-tab'), signupTab:$('signup-tab'), status:$('status'), social:$('social-section'), providers:$('providers'), divider:$('divider'), form:$('email-form'), displayRow:$('display-name-row'), display:$('display-name'), displayLabel:$('display-name-label'), email:$('email'), emailLabel:$('email-label'), password:$('password'), passwordLabel:$('password-label'), pwHint:$('password-hint'), submit:$('submit-button'), error:$('error'), notice:$('notice'), back:$('back-button'), security:$('security-note')
};
let mode = requestedMode;
let config = null;
let busy = false;

function setText(){
  els.subtitle.textContent=c.subtitle;els.loginTab.textContent=c.login;els.signupTab.textContent=c.signup;els.displayLabel.textContent=c.display;els.emailLabel.textContent=c.email;els.passwordLabel.textContent=c.password;els.pwHint.textContent=c.pwHint;els.back.textContent=c.close;els.security.textContent=c.security;els.divider.querySelector('span').textContent=c.or;
}
function clearMessages(){els.error.hidden=true;els.error.textContent='';els.notice.hidden=true;els.notice.textContent='';}
function showError(message){els.error.textContent=message;els.error.hidden=false;}
function showNotice(message){els.notice.textContent=message;els.notice.hidden=false;}
function providerLabel(name){return ({google:c.google,kakao:c.kakao,naver:c.naver,microsoft:c.microsoft,apple:c.apple})[name] || name;}
function icon(name){
  if(name==='google')return '<span class="provider-icon"><svg viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844c-.209 1.125-.843 2.079-1.797 2.716v2.258h2.909c1.702-1.567 2.684-3.875 2.684-6.615Z"/><path fill="#34A853" d="M9 18c2.43 0 4.468-.806 5.956-2.18l-2.909-2.258c-.806.54-1.835.859-3.047.859-2.344 0-4.328-1.585-5.036-3.714H.957v2.332A9 9 0 0 0 9 18Z"/><path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A9 9 0 0 0 0 9c0 1.452.347 2.825.957 4.039l3.007-2.332Z"/><path fill="#EA4335" d="M9 3.579c1.321 0 2.507.454 3.44 1.345l2.581-2.581C13.464.891 11.426 0 9 0A9 9 0 0 0 .957 4.961l3.007 2.332C4.672 5.164 6.656 3.579 9 3.579Z"/></svg></span>';
  if(name==='kakao')return '<span class="provider-icon"><svg viewBox="0 0 28 28"><path fill="#111" d="M14 3.5C7.65 3.5 2.5 7.63 2.5 12.72c0 3.25 2.11 6.12 5.3 7.76l-1.08 3.95c-.1.36.31.64.62.43l4.73-3.12c.63.1 1.28.16 1.93.16 6.35 0 11.5-4.13 11.5-9.18S20.35 3.5 14 3.5Z"/></svg></span>';
  if(name==='naver')return '<span class="provider-icon"><svg viewBox="0 0 24 24"><path fill="#fff" d="M4 3.5h5.36l5.28 7.56V3.5H20v17h-5.36l-5.28-7.56v7.56H4v-17Z"/></svg></span>';
  if(name==='microsoft')return '<span class="provider-icon"><svg viewBox="0 0 24 24"><path fill="#F25022" d="M2 2h9v9H2z"/><path fill="#7FBA00" d="M13 2h9v9h-9z"/><path fill="#00A4EF" d="M2 13h9v9H2z"/><path fill="#FFB900" d="M13 13h9v9h-9z"/></svg></span>';
  if(name==='apple')return '<span class="provider-icon"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M17.05 12.54c.02 2.42 2.13 3.23 2.15 3.24-.02.06-.34 1.17-1.11 2.31-.66.98-1.35 1.95-2.43 1.97-1.06.02-1.4-.63-2.62-.63-1.21 0-1.59.61-2.59.65-1.04.04-1.83-1.05-2.5-2.03-1.36-1.98-2.4-5.58-1-8.02a3.88 3.88 0 0 1 3.3-2.02c1.03-.02 2 .7 2.62.7.62 0 1.79-.87 3.02-.74.52.02 1.98.2 2.92 1.59-.08.05-1.74 1.02-1.76 2.98Zm-1.97-5.86c.55-.66.92-1.58.82-2.49-.79.03-1.75.53-2.31 1.19-.51.58-.96 1.52-.84 2.41.88.07 1.78-.45 2.33-1.11Z"/></svg></span>';
  return `<span class="provider-icon"><span class="generic-icon">${String(name||'?').slice(0,1).toUpperCase()}</span></span>`;
}
function endpoint(path){const u=new URL(apiBase+path);u.searchParams.set('environment',environment);return u.toString();}
async function request(path,options={}){
  const res=await fetch(endpoint(path),{...options,headers:{'content-type':'application/json',...(options.headers||{})}});
  const raw=await res.text();let body={};try{body=raw?JSON.parse(raw):{};}catch{body={error:raw||'request_failed'};}
  if(!res.ok)throw Object.assign(new Error(body.error||`request_failed_${res.status}`),{status:res.status,body});return body;
}
function validBootRequest(){
  if(!apiBase||!project||!redirectUri)return false;
  try{const u=new URL(redirectUri);return ['https:','http:'].includes(u.protocol)&&!!u.host;}catch{return false;}
}
function renderMode(){
  const signup=mode==='signup';
  els.title.textContent=signup?c.signup:c.login;
  els.loginTab.classList.toggle('active',!signup);els.loginTab.setAttribute('aria-selected',String(!signup));
  els.signupTab.classList.toggle('active',signup);els.signupTab.setAttribute('aria-selected',String(signup));
  els.displayRow.hidden=!signup;els.display.required=signup;els.pwHint.hidden=!signup;
  els.password.autocomplete=signup?'new-password':'current-password';
  els.submit.textContent=signup?c.submitSignup:c.submitLogin;
  if(config)els.signupTab.hidden=config.signupEnabled===false;
  clearMessages();
}
function setBusy(next){busy=next;els.submit.disabled=next;for(const b of els.providers.querySelectorAll('button'))b.disabled=next;els.loginTab.disabled=next;els.signupTab.disabled=next;}
function friendly(code){const value=String(code||'');if(value==='account_exists')return c.accountExists;if(value==='invalid_credentials')return c.badCredentials;if(value==='signup_not_available')return c.signupDisabled;if(value==='pending_approval')return c.pending;return value?value.replaceAll('_',' '):c.unavailable;}
function startSocial(provider){
  if(busy)return;clearMessages();
  const u=new URL(endpoint(`/v1/oauth/${encodeURIComponent(project)}/${encodeURIComponent(provider)}/start`));
  u.searchParams.set('redirect_uri',redirectUri);if(state)u.searchParams.set('state',state);location.assign(u.toString());
}
async function handoff(accessToken){
  const result=await request(`/v1/auth/${encodeURIComponent(project)}/authorize`,{method:'POST',headers:{authorization:`Bearer ${accessToken}`},body:JSON.stringify({redirectUri,state})});
  if(!result.redirectTo)throw new Error('handoff_failed');location.assign(result.redirectTo);
}
async function submitEmail(event){
  event.preventDefault();if(busy)return;clearMessages();setBusy(true);els.submit.textContent=c.processing;
  try{
    const signup=mode==='signup';
    const path=`/v1/auth/${encodeURIComponent(project)}/${signup?'signup':'login'}`;
    const body=signup?{email:els.email.value.trim(),password:els.password.value,displayName:els.display.value.trim()}:{email:els.email.value.trim(),password:els.password.value};
    const session=await request(path,{method:'POST',body:JSON.stringify(body)});
    if(session?.pendingApproval){showNotice(c.pending);return;}
    if(!session?.accessToken)throw new Error('session_missing');
    await handoff(session.accessToken);
  }catch(error){const code=error?.body?.error||error?.message||'request_failed';showError(friendly(code));if(code==='account_exists'){mode='login';renderMode();showError(c.accountExists);}}
  finally{setBusy(false);els.submit.textContent=mode==='signup'?c.submitSignup:c.submitLogin;}
}
async function boot(){
  setText();renderMode();els.status.textContent=c.loading;
  if(!validBootRequest()){els.status.textContent='';showError(c.invalid);els.form.hidden=true;els.social.hidden=true;return;}
  try{
    config=await request(`/v1/config/${encodeURIComponent(project)}`);
    els.projectName.textContent=config?.project?.name||project;
    document.title=`${mode==='signup'?c.signup:c.login} · ${config?.project?.name||'AuthHub'}`;
    const providers=Array.isArray(config?.providers)?config.providers:[];
    els.providers.innerHTML='';
    for(const provider of providers){const b=document.createElement('button');b.type='button';b.className=`provider-button provider-${provider}`;b.innerHTML=`${icon(provider)}<span class="provider-label"></span><span aria-hidden="true"></span>`;b.querySelector('.provider-label').textContent=providerLabel(provider);b.addEventListener('click',()=>startSocial(provider));els.providers.appendChild(b);}
    els.social.hidden=providers.length===0;
    const emailEnabled=config?.emailPasswordEnabled!==false;els.form.hidden=!emailEnabled;els.divider.hidden=!(emailEnabled&&providers.length);
    els.signupTab.hidden=config?.signupEnabled===false;
    if(mode==='signup'&&config?.signupEnabled===false){mode='login';renderMode();showNotice(c.signupDisabled);}
    els.status.textContent='';if(!emailEnabled&&!providers.length)showError(c.noMethods);
  }catch{els.status.textContent='';showError(c.unavailable);}
}

els.loginTab.addEventListener('click',()=>{if(!busy){mode='login';renderMode();}});
els.signupTab.addEventListener('click',()=>{if(!busy&&config?.signupEnabled!==false){mode='signup';renderMode();}});
els.form.addEventListener('submit',submitEmail);
els.back.addEventListener('click',()=>history.length>1?history.back():location.replace('https://authhub.suaveforge.com/'));
boot();
