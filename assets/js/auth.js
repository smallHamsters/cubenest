/* ============================================================================
 * CubeNest auth — Supabase OAuth 공용 인증 모듈 (마스터 §6)
 *   window.CubeNest.auth
 *
 *   · OAuth 전용(비밀번호 없음). 카카오(1순위) · 구글 · 애플(코드만, 버튼 숨김)
 *   · isLoggedIn() 이 전 페이지 단일 진실 소스 — quiz 첨삭 · quiz 결과 저장 ·
 *     playground calc 30분 타임게이트가 모두 이것 하나를 본다.
 *   · 정적 사이트(멀티 페이지). supabase-js 가 세션을 localStorage 에 지속하므로
 *     같은 오리진 내 페이지 이동에도 세션 유지 — 단 각 페이지가 이 파일을 로드해야 한다.
 *
 *   로드 순서:  supabase-js  →  auth.js  →  페이지 스크립트
 *
 *   ⚠ anon key 만 여기 둔다(공개 OK). service_role key 는 절대 금지(서버 전용).
 * ==========================================================================*/
(function (global) {
  'use strict';

  var VERSION = '0.1.0';

  /* ── 설정 ────────────────────────────────────────────────────────────────
     SUPABASE_ANON_KEY: Supabase 대시보드 › Settings › API › anon / publishable key
     공개되어도 되는 키다(RLS 가 실제 방어선). service_role 을 여기 넣지 말 것. */
  var SUPABASE_URL      = 'https://jtniutmexokswdpxkjof.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0bml1dG1leG9rc3dkcHhram9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2OTcwNTIsImV4cCI6MjEwMjI3MzA1Mn0.2-n-4SD7fZ5aWzdORSZoUxzUBDgma0GrzrKc11LWTfY';
  /* ──────────────────────────────────────────────────────────────────────── */

  var MOCK_KEY = 'cubenest_mock_login';   // 구버전 모의 로그인 잔재 — 아래에서 제거만 한다

  /* GA4(F1) — track() 은 공용 모듈이 아니라 페이지마다 복제돼 있고, 일부 페이지엔
     아예 없다. consent.js 와 같은 방식으로 덕타이핑 호출하고 gtag 로 폴백한다. */
  function trk(name, params) {
    try {
      if (typeof track === 'function') track(name, params || {});
      else if (global.gtag) global.gtag('event', name, params || {});
    } catch (e) {}
  }

  /* ── 상태 ─────────────────────────────────────────────── */
  var client   = null;
  var session  = null;
  var listeners = [];
  var settled  = false;          // 최초 세션 복원 완료 여부
  var readyRes = null;
  var ready    = new Promise(function (res) { readyRes = res; });

  function notify() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](!!session, session); } catch (e) {}
    }
  }
  /* OAuth 복귀 URL — location.href 가 이미 /cubenest/ 하위경로를 품고 있으므로
     base-path 계산이 필요 없다. 인증 파라미터만 털어낸다. */
  function returnUrl() {
    try {
      var u = new URL(global.location.href);
      ['code', 'state', 'error', 'error_code', 'error_description'].forEach(function (k) {
        u.searchParams.delete(k);
      });
      u.hash = '';
      return u.toString();
    } catch (e) { return global.location.href; }
  }

  var AUTH_PARAMS = ['code', 'state', 'error', 'error_code', 'error_description'];

  /* PKCE 교환·오류 복귀 뒤 주소창 정리 — ?seed=(quiz/run) · ?m=(playground) 는 보존.
     오류는 쿼리와 해시 양쪽에 실려 오므로(#error=...) 해시도 함께 턴다. */
  function cleanUrl() {
    try {
      var u = new URL(global.location.href), dirty = false;
      AUTH_PARAMS.forEach(function (k) {
        if (u.searchParams.has(k)) { u.searchParams.delete(k); dirty = true; }
      });
      if (u.hash && /(^|[#&])(access_token|error|error_code|error_description)=/.test(u.hash)) {
        u.hash = ''; dirty = true;
      }
      if (dirty) global.history.replaceState(null, '', u.toString());
    } catch (e) {}
  }

  /* 로그인 실패로 되돌아온 경우 조용히 삼키지 않고 알린다(설정 오류 진단용). */
  function reportUrlError() {
    try {
      var q = new URLSearchParams(global.location.search);
      var h = new URLSearchParams((global.location.hash || '').replace(/^#/, ''));
      var code = q.get('error_code') || h.get('error_code');
      var desc = q.get('error_description') || h.get('error_description');
      if (!code && !q.get('error') && !h.get('error')) return;
      console.error('[CubeNest.auth] 로그인 실패:', code || 'error', desc || '');
      trk('login_error', { code: code || 'error' });
    } catch (e) {}
  }

  /* ── 초기화 ───────────────────────────────────────────── */
  function init() {
    try { localStorage.removeItem(MOCK_KEY); } catch (e) {}   // 모의 로그인 잔재 제거
    reportUrlError();                                          // 복귀 URL에 오류가 실려 왔으면 먼저 알린다

    var sb = global.supabase;
    if (!sb || !sb.createClient) {
      console.warn('[CubeNest.auth] supabase-js 가 먼저 로드되어야 합니다.');
      settled = true; readyRes(null); notify(); return;
    }
    if (!SUPABASE_ANON_KEY) {
      console.warn('[CubeNest.auth] SUPABASE_ANON_KEY 가 비어 있습니다 — 로그인 비활성.');
      settled = true; readyRes(null); notify(); return;
    }

    client = sb.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,   // OAuth 복귀 시 ?code= 자동 교환
        flowType: 'pkce'
      }
    });

    client.auth.onAuthStateChange(function (evt, s) {
      var was = !!session;
      session = s || null;
      if (evt === 'SIGNED_IN' && !was) {
        trk('login_success', { provider: providerOf(s) });
        cleanUrl();
      }
      if (settled) notify();
      renderModal();
      mountHeader();
    });

    client.auth.getSession().then(function (r) {
      session = (r && r.data && r.data.session) || null;
      settled = true;
      cleanUrl();
      readyRes(session);
      notify();
      mountHeader();
    }).catch(function () {
      settled = true; readyRes(null); notify(); mountHeader();
    });
  }

  function providerOf(s) {
    try { return (s && s.user && s.user.app_metadata && s.user.app_metadata.provider) || 'unknown'; }
    catch (e) { return 'unknown'; }
  }

  /* ── 로그인 / 로그아웃 ────────────────────────────────── */
  function signIn(provider, ctx) {
    if (!client) { alert('로그인 설정이 아직 완료되지 않았어요. 잠시 후 다시 시도해 주세요.'); return; }
    trk('login_start', { provider: provider, ctx: ctx || '' });
    return client.auth.signInWithOAuth({
      provider: provider,
      options: { redirectTo: returnUrl() }
    }).then(function (r) {
      if (r && r.error) { console.error('[CubeNest.auth]', r.error); alert('로그인을 시작하지 못했어요: ' + r.error.message); }
      return r;
    });
  }

  function signOut() {
    if (!client) return Promise.resolve();
    trk('logout', { provider: providerOf(session) });
    return client.auth.signOut().then(function () {
      session = null; notify(); renderModal(); mountHeader();
    });
  }

  /* ── 로그인 모달 ──────────────────────────────────────── */
  var modalEl = null;

  /* ⚠ 부착 지점: playground 는 세로 모바일에서 #app 을 90° 회전시킨다.
     transform 된 조상은 position:fixed 자손의 containing block 이 되므로
     #app 안에 넣어야 모달이 앱과 같은 방향으로 뜬다. */
  function modalHost() {
    return document.getElementById('app') || document.body;
  }

  function buildModal() {
    if (modalEl) return modalEl;
    var d = document.createElement('div');
    d.className = 'cn-auth';
    d.id = 'cnAuth';
    d.hidden = true;
    d.innerHTML =
      '<div class="cn-auth-scrim" data-close="1"></div>' +
      '<div class="cn-auth-card" role="dialog" aria-modal="true" aria-labelledby="cnAuthTitle">' +
        '<button class="cn-auth-x" type="button" data-close="1" aria-label="닫기">' +
          '<svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>' +
        '</button>' +
        '<div class="cn-auth-body" id="cnAuthBody"></div>' +
      '</div>';
    d.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) closeModal();
      var b = e.target.closest('[data-provider]');
      if (b) signIn(b.getAttribute('data-provider'), d.getAttribute('data-ctx') || 'modal');
      if (e.target.closest('[data-signout]')) signOut();
    });
    modalHost().appendChild(d);
    modalEl = d;
    return d;
  }

  /* 제공자 버튼 — 카카오 · 구글. 애플은 유료 개발자 계정이 필요해 지금은 숨김. */
  function providerButtonsHtml() {
    return '' +
      '<button class="cn-auth-btn kakao" type="button" data-provider="kakao">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3C6.99 3 3 6.24 3 10.24c0 2.55 1.7 4.79 4.26 6.07-.14.5-.9 3.2-.93 3.42 0 0-.02.16.08.22.1.06.23.01.23.01.3-.04 3.5-2.3 4.05-2.69.43.06.87.09 1.31.09 5.01 0 9-3.24 9-7.12S17.01 3 12 3z"/></svg>' +
        '카카오로 시작하기</button>' +
      '<button class="cn-auth-btn google" type="button" data-provider="google">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
          '<path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.89-1.74 2.98-4.3 2.98-7.35z"/>' +
          '<path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.24-2.5c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.59A10 10 0 0 0 12 22z"/>' +
          '<path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.83V7.5H3.06a10 10 0 0 0 0 9l3.35-2.58z"/>' +
          '<path fill="#EA4335" d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.95 2.99 14.7 2 12 2A10 10 0 0 0 3.06 7.5l3.35 2.59C7.2 7.73 9.4 5.98 12 5.98z"/>' +
        '</svg>' +
        '구글로 시작하기</button>';
  }

  function userLabel() {
    try {
      var u = session && session.user;
      if (!u) return '';
      return (u.user_metadata && (u.user_metadata.name || u.user_metadata.full_name)) || u.email || '로그인됨';
    } catch (e) { return '로그인됨'; }
  }

  function providerLabel() {
    var p = providerOf(session);
    return p === 'kakao' ? '카카오' : p === 'google' ? '구글' : p === 'apple' ? '애플' : p;
  }

  function renderModal() {
    if (!modalEl) return;
    var body = modalEl.querySelector('#cnAuthBody');
    if (!body) return;
    if (session) {
      body.innerHTML =
        '<h2 class="cn-auth-t" id="cnAuthTitle">로그인되어 있어요</h2>' +
        '<p class="cn-auth-d"><b>' + esc(userLabel()) + '</b><br><span class="cn-auth-prov">' + esc(providerLabel()) + ' 계정</span></p>' +
        '<button class="cn-auth-btn ghost" type="button" data-signout="1">로그아웃</button>';
    } else {
      body.innerHTML =
        '<h2 class="cn-auth-t" id="cnAuthTitle">로그인</h2>' +
        '<p class="cn-auth-d">비밀번호 없이 카카오·구글 계정으로 시작해요.<br>계정은 <b>보호자·선생님용</b>이고, 학생은 로그인 없이 사용할 수 있어요.</p>' +
        providerButtonsHtml() +
        '<p class="cn-auth-fine">로그인하면 계산 과정을 시간 제한 없이 보고, 퀴즈 결과를 저장할 수 있어요.</p>';
    }
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var lastFocus = null;
  function openModal(ctx) {
    var d = buildModal();
    d.setAttribute('data-ctx', ctx || '');
    renderModal();
    lastFocus = document.activeElement;
    d.hidden = false;
    requestAnimationFrame(function () { d.classList.add('on'); });
    var f = d.querySelector('.cn-auth-btn'); if (f) f.focus();
    document.addEventListener('keydown', onEsc, true);
  }
  function closeModal() {
    if (!modalEl) return;
    modalEl.classList.remove('on');
    document.removeEventListener('keydown', onEsc, true);
    setTimeout(function () { if (modalEl) modalEl.hidden = true; }, 180);
    try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (e) {}
  }
  function onEsc(e) { if (e.key === 'Escape') { e.stopPropagation(); closeModal(); } }

  /* 게이트에서 부르는 진입점. 이미 로그인 상태면 모달이 상태·로그아웃을 보여준다. */
  function requireLogin(ctx) {
    trk('login_prompt', { ctx: ctx || '' });
    openModal(ctx);
  }

  /* ── 헤더 계정 진입점 ─────────────────────────────────── */
  /* 각 페이지 헤더의 .site-actions 안에 <a id="authNav"> 가 손으로 들어가 있다
     (SEO — 내부 링크는 원본 HTML에 둔다). 로그인 상태에 맞춰 라벨과 .authed 만 갱신한다.
     playground 는 공용 헤더가 없어(전체화면 앱) 자연히 no-op 이 된다. */
  function mountHeader() {
    var a = document.getElementById('authNav');
    if (!a) return;
    var on = !!session;
    a.classList.toggle('authed', on);
    a.setAttribute('aria-label', on ? '내 계정' : '로그인');
    a.setAttribute('title',      on ? '내 계정' : '로그인');
    /* 아이콘(SVG) 헤더면 접근성 라벨만 갱신하고 마크업은 보존한다.
       텍스트형 페이지는 종전처럼 라벨 텍스트를 넣는다(하위호환). */
    if (!a.querySelector('svg')) a.textContent = on ? '내 계정' : '로그인';
  }

  /* ── 공개 API ─────────────────────────────────────────── */
  var auth = {
    VERSION: VERSION,
    ready: ready,
    get settled() { return settled; },
    get client() { return client; },

    isLoggedIn: function () { return !!session; },
    getSession: function () { return session; },
    getUser: function () { return (session && session.user) || null; },
    /* 후속(저장·유료) Edge Function 호출에 JWT 를 실을 때 쓴다. 지금은 노출만 —
       api-client 는 손대지 않는다(익명 무료 플레이를 깨지 않기 위해). */
    getAccessToken: function () { return (session && session.access_token) || null; },
    provider: function () { return session ? providerOf(session) : null; },

    onAuthChange: function (cb) {
      if (typeof cb !== 'function') return function () {};
      listeners.push(cb);
      try { cb(!!session, session); } catch (e) {}   // 즉시 1회
      return function () {
        var i = listeners.indexOf(cb);
        if (i >= 0) listeners.splice(i, 1);
      };
    },

    signInWithKakao:  function (ctx) { return signIn('kakao',  ctx); },
    signInWithGoogle: function (ctx) { return signIn('google', ctx); },
    signInWithApple:  function (ctx) { return signIn('apple',  ctx); },   // 제공자 설정 후 사용
    signOut: signOut,

    requireLogin: requireLogin,
    openModal: openModal,
    closeModal: closeModal,
    mountHeader: mountHeader,
    providerButtonsHtml: providerButtonsHtml,
    userLabel: userLabel,
    providerLabel: providerLabel
  };

  global.CubeNest = global.CubeNest || {};
  global.CubeNest.auth = auth;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})(typeof globalThis !== 'undefined' ? globalThis : this);
