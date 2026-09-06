/* ============================================================================
 * CubeNest scope — 저장소 스코프 · 학습자(learner) 공용 모듈
 *   window.CubeNest.scope
 *
 *   왜 있는가: 학원에서 한 태블릿을 여러 아이가 공유한다. 그런데 지금까지
 *   localStorage 키에 "누구의 것인가"가 들어 있지 않아, 같은 링크(같은 seed)로
 *   들어온 다음 아이가 앞 아이의 답·연습장을 **이어풀기로 물려받았다.**
 *   `CubeNest.auth` 가 "로그인의 단일 진실"이듯 이 모듈이 **"저장소 스코프의
 *   단일 진실"** 이다. auth 를 참조하는 쪽이고, auth.js 는 이 파일을 모른다.
 *
 *   로드 순서:  supabase-js → auth.js → **scope.js** → mydata.js → 페이지 스크립트
 *
 *   ── 키 규약: 덧붙이기(append-only) ──────────────────────────────────────
 *     key(base) = base                          로그아웃 + 학습자 미선택
 *     key(base) = base + '__' + uid             로그인   + 학습자 미선택
 *     key(base) = base + '__' + uid + '~' + lid 학습자를 고른 경우에만
 *
 *   ⚠ 이 규약이 마이그레이션 호환성 전체를 떠받친다. mydata.js 의 기존
 *     scoped() 가 이미 `base + '__' + uid` 이므로, **학습자를 고르지 않은
 *     사용자의 키는 한 글자도 바뀌지 않는다.** 로컬 자료가 이동할 경로 자체가
 *     없다 = 롤백해도 유실이 없다. 구분자를 '~' 로 쓴 이유도 같다 — uuid 에
 *     안 나오는 문자라 기존 키와 절대 겹치지 않는다.
 *
 *   ⚠ 전부 **동기 반환**이다. /my·/account·run.js 가 렌더 시점에 동기로 소비한다
 *     (mydata.getNickname() 이 세운 전례). 서버 동기화가 붙어도 "읽어서 로컬
 *     캐시를 채우는" 방향으로만 붙일 것 — 시그니처를 Promise 로 바꾸지 말 것.
 *
 *   ⚠ 이 계층은 편의·격리일 뿐 **방어선이 아니다.** 실제 방어선은 RLS 다.
 *     여기 저장되는 값은 신뢰 대상이 아니다(사용자가 DevTools 로 바꿀 수 있다).
 * ==========================================================================*/
(function (global) {
  'use strict';

  var VERSION = '0.1.0';

  var ROSTER_BASE = 'cubenest_learners';     // [{id,name,color,ts}] — 계정별(uid)로 나뉜다
  var CUR_BASE    = 'cubenest_learner_cur';  // {id, at} — 현재 선택 + 마지막 활동 시각
  var ASK_BASE    = 'cubenest_learner_ask';  // '1' = 태블릿 모드(퀴즈 시작마다 묻는다)
  var SESS_PREFIX = 'cubenest_quiz_sess_';   // pruneSessions 대상(run.js 와 같은 값)

  var NAME_MAX = 12;      // ⚠ 2단계 learners.name CHECK 와 **같은 값**이어야 한다.
                          //   갈라지면 클라가 통과시킨 이름을 DB 가 거부해 "저장했는데 안 되는"
                          //   상태가 된다(profiles.nickname 20 이 세운 전례).
  var MAX_LEARNERS = 12;  // 한 계정의 로스터 상한. 학원 한 반을 담고도 남는다.
  var IDLE_MS = 20 * 60 * 1000;   // 유휴 20분 → 다음 진입에서 다시 묻는다(아이가 바뀌는 실제 타이밍)

  /* 학습자 색 — 이름 대신 눈으로 구분하는 장치다(아이가 글자를 잘 못 읽어도 고른다).
     ⚠ 브랜드 3색(위 #3f8fd0 · 앞 #4fae72 · 옆 #d0546f)을 쓰지 않는다 — 그 색은
       '방향'의 뜻을 갖고 있어서, 학습자 색으로 재사용하면 뜻이 흐려진다. */
  var COLORS = ['#e8734a', '#e0a020', '#7aa93c', '#3aa8a0',
                '#4a86d8', '#7a6ad0', '#c25aa8', '#8a8f9a'];

  /* ── 상태 ─────────────────────────────────────────────── */
  var listeners = [];
  var settled   = false;          // auth 세션 복원까지 끝났는가
  var readyRes  = null;
  var ready     = new Promise(function (res) { readyRes = res; });
  var lastId    = null;           // 마지막으로 알린 스코프 토큰(중복 통지 방지)

  function auth() { return (global.CubeNest && global.CubeNest.auth) || null; }

  function uid() {
    try {
      var A = auth();
      if (!A || !A.isLoggedIn()) return null;
      var u = A.getUser();
      return (u && u.id) || null;
    } catch (e) { return null; }
  }

  function ls() { return global.localStorage; }
  function rd(k) { try { return ls().getItem(k); } catch (e) { return null; } }
  function wr(k, v) { try { ls().setItem(k, v); return true; } catch (e) { return false; } }
  function rm(k) { try { ls().removeItem(k); } catch (e) {} }

  /* 로스터·선택은 **계정별**로만 나눈다(학습자별로 또 나누면 자기 자신을 못 찾는다). */
  function acctKey(base) { var u = uid(); return u ? (base + '__' + u) : base; }

  function uuid() {
    try { if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID(); } catch (e) {}
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function cleanName(s) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
  }

  /* ── 로스터 ───────────────────────────────────────────── */
  function roster() {
    try {
      var o = JSON.parse(rd(acctKey(ROSTER_BASE)) || '[]');
      if (!Array.isArray(o)) return [];
      return o.filter(function (x) { return x && x.id && x.name; });
    } catch (e) { return []; }
  }
  function saveRoster(arr) { return wr(acctKey(ROSTER_BASE), JSON.stringify(arr)); }

  function curRaw() {
    try {
      var o = JSON.parse(rd(acctKey(CUR_BASE)) || 'null');
      return (o && o.id) ? o : null;
    } catch (e) { return null; }
  }
  /* 선택된 학습자. **로스터에 없으면 null** — 지운 학습자의 스코프에 갇히지 않게 한다. */
  function learner() {
    var c = curRaw(); if (!c) return null;
    var r = roster();
    for (var i = 0; i < r.length; i++) if (r[i].id === c.id) return r[i];
    return null;
  }
  function curId() { var l = learner(); return l ? l.id : ''; }

  /* ── 스코프 토큰 ──────────────────────────────────────── */
  function id() {
    var u = uid(), l = curId();
    return (u ? '__' + u : '') + (l ? '~' + l : '');
  }
  function key(base) { return String(base) + id(); }

  /* ── 변경 통지 ────────────────────────────────────────── */
  /* cb(changed, id) — 등록 즉시 1회는 **changed=false** 로 부른다(auth.onAuthChange 규약).
     ⚠ auth 세션 복원(settled)으로 토큰이 처음 확정되는 것은 '변경'이 아니다.
       그걸 변경으로 치면 로그인 사용자는 페이지를 열 때마다 run.js 가 리로드한다. */
  function notify(changed) {
    var cur = id();
    if (changed && cur === lastId) return;      // 실제로 안 바뀌었으면 조용히 넘어간다
    lastId = cur;
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](!!changed, cur); } catch (e) {}
    }
  }

  function onChange(cb) {
    if (typeof cb !== 'function') return function () {};
    listeners.push(cb);
    try { cb(false, id()); } catch (e) {}       // 즉시 1회(변경 아님)
    return function () {
      var i = listeners.indexOf(cb);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  /* ── 유휴 · 태블릿 모드 ───────────────────────────────── */
  function askMode() { return rd(acctKey(ASK_BASE)) === '1'; }
  function setAskMode(on) { if (on) wr(acctKey(ASK_BASE), '1'); else rm(acctKey(ASK_BASE)); }

  function touch() {
    var c = curRaw(); if (!c) return;
    wr(acctKey(CUR_BASE), JSON.stringify({ id: c.id, at: Date.now() }));
  }
  function idleExpired() {
    var c = curRaw(); if (!c) return false;
    var at = +c.at || 0;
    return at > 0 && (Date.now() - at) > IDLE_MS;
  }

  /* 지금 학습자를 물어야 하는가.
     ⚠ 유휴 만료가 선택을 **지우지는 않는다.** 지우면 스코프 토큰이 바뀌어 자료가
       갑자기 사라진 것처럼 보인다. 만료는 "다시 물어라"는 신호일 뿐이다. */
  function shouldAsk() {
    var n = roster().length;
    if (!n) return false;                       // 학습자를 안 만든 사람에겐 아무것도 묻지 않는다
    if (askMode()) return true;                 // 학원 기기 — 시작할 때마다
    if (!curId()) return true;                  // 아직 아무도 안 골랐다
    return n > 1 && idleExpired();              // 후보가 둘 이상일 때만 유휴로 되묻는다
  }

  /* ── 로스터 편집 ──────────────────────────────────────── */
  function add(name) {
    var nm = cleanName(name); if (!nm) return null;
    var r = roster();
    if (r.length >= MAX_LEARNERS) return null;
    var it = { id: uuid(), name: nm, color: r.length % COLORS.length, ts: Date.now() };
    r.push(it);
    if (!saveRoster(r)) return null;
    return it;
  }
  function rename(lid, name) {
    var nm = cleanName(name); if (!nm) return false;
    var r = roster(), hit = false;
    for (var i = 0; i < r.length; i++) if (r[i].id === lid) { r[i].name = nm; hit = true; }
    return hit ? saveRoster(r) : false;
  }
  /* 학습자를 지운다. **그 학습자 스코프의 로컬 키까지 함께 지운다** — 안 지우면
     쓰레기가 영구히 남고, 같은 이름으로 다시 만들어도 새 uuid 라 닿지도 못한다. */
  function remove(lid) {
    var r = roster().filter(function (x) { return x.id !== lid; });
    if (!saveRoster(r)) return false;
    purgeScope('~' + lid);
    var c = curRaw();
    if (c && c.id === lid) { rm(acctKey(CUR_BASE)); notify(true); }
    return true;
  }
  function select(lid) {
    if (lid) {
      var r = roster(), ok = false;
      for (var i = 0; i < r.length; i++) if (r[i].id === lid) ok = true;
      if (!ok) return false;
      wr(acctKey(CUR_BASE), JSON.stringify({ id: lid, at: Date.now() }));
    } else {
      rm(acctKey(CUR_BASE));
    }
    notify(true);
    return true;
  }

  /* 접미어가 suffix 로 끝나는 로컬 키를 전부 지운다(학습자 삭제 시).
     ⚠ 계정 접미어(`__uid`)까지 포함된 전체 토큰으로 부를 것 — '~lid' 만 보면
       다른 계정의 같은 학습자 키까지 지울 수 있다. remove() 는 현재 계정
       컨텍스트에서만 불리므로 id() 로 만든 토큰과 자연히 일치한다. */
  function purgeScope(suffix) {
    try {
      var full = (uid() ? '__' + uid() : '') + suffix;
      var doomed = [], s = ls();
      for (var i = 0; i < s.length; i++) {
        var k = s.key(i);
        if (k && k.length > full.length && k.slice(-full.length) === full) doomed.push(k);
        else if (k && k.slice(-3) === '_sc' && k.slice(0, -3).slice(-full.length) === full) doomed.push(k);
      }
      doomed.forEach(rm);
    } catch (e) {}
  }

  /* ── 세션 청소 ────────────────────────────────────────── */
  /* 학습자 N명 × 세션 × 연습장이라 localStorage 압력이 N배가 된다.
     오래된 이어풀기 세션을 걷어낸다(연습장 `_sc` 짝을 함께). 현재 스코프의 것도
     오래됐으면 지운다 — 14일 지난 이어풀기를 이어서 풀 사람은 없다. */
  function pruneSessions(days) {
    var maxAge = (+days > 0 ? +days : 14) * 24 * 3600 * 1000, now = Date.now(), n = 0;
    try {
      var s = ls(), doomed = [];
      for (var i = 0; i < s.length; i++) {
        var k = s.key(i);
        if (!k || k.indexOf(SESS_PREFIX) !== 0) continue;
        if (k.slice(-3) === '_sc') continue;                 // 본체를 보고 짝으로 지운다
        var ts = 0;
        try { ts = +(JSON.parse(s.getItem(k) || '{}').ts) || 0; } catch (e) { ts = 0; }
        if (ts && (now - ts) < maxAge) continue;
        if (!ts) continue;                                   // ts 를 못 읽으면 건드리지 않는다(안전측)
        doomed.push(k);
      }
      doomed.forEach(function (k) { rm(k); rm(k + '_sc'); n++; });
    } catch (e) {}
    return n;
  }

  /* ── 선택 시트 ────────────────────────────────────────── */
  /* auth.css 의 .cn-auth* 클래스를 그대로 재사용한다 — 새 CSS 파일도, 기존
     CSS 의 ?v= 상승도 없다. 6개 소비 페이지 전부 이미 auth.css 를 로드한다.
     ⚠ 부착 지점은 auth.js 와 같은 이유로 #app 우선이다 — playground 가 세로
       모바일에서 #app 을 90° 회전시키므로 body 에 붙이면 시트가 눕는다. */
  function host() { return document.getElementById('app') || document.body; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function colorOf(l) { return COLORS[(l && l.color | 0) % COLORS.length] || COLORS[0]; }
  function initialOf(l) { return (l && l.name) ? l.name.slice(0, 1) : '?'; }

  var sheetEl = null, sheetResolve = null;

  function buildSheet() {
    if (sheetEl) return sheetEl;
    var d = document.createElement('div');
    d.className = 'cn-auth';
    d.id = 'cnScope';
    d.hidden = true;
    d.innerHTML =
      '<div class="cn-auth-scrim" data-close="1"></div>' +
      '<div class="cn-auth-card" role="dialog" aria-modal="true" aria-labelledby="cnScopeTitle">' +
        '<button class="cn-auth-x" type="button" data-close="1" aria-label="닫기">' +
          '<svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>' +
        '</button>' +
        '<div class="cn-auth-body" id="cnScopeBody"></div>' +
      '</div>';
    d.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) { closeSheet(); return; }
      var pick = e.target.closest('[data-pick]');
      if (pick) { select(pick.getAttribute('data-pick')); closeSheet(); return; }
      if (e.target.closest('[data-new]')) { promptNew(); return; }
    });
    host().appendChild(d);
    sheetEl = d;
    return d;
  }

  function renderSheet() {
    if (!sheetEl) return;
    var body = sheetEl.querySelector('#cnScopeBody'); if (!body) return;
    var r = roster(), cur = curId(), h = '';
    h += '<h2 class="cn-auth-t" id="cnScopeTitle">누가 공부하나요?</h2>';
    h += '<p class="cn-auth-d">고른 사람의 기록만 보이고 저장돼요.<br>기기를 함께 쓰면 시작할 때마다 골라 주세요.</p>';
    for (var i = 0; i < r.length; i++) {
      var l = r[i], on = (l.id === cur);
      h += '<button class="cn-auth-btn ' + (on ? 'accent' : 'ghost') + '" type="button" data-pick="' + esc(l.id) + '"' +
           ' style="justify-content:flex-start;gap:10px">' +
           '<span aria-hidden="true" style="width:22px;height:22px;border-radius:50%;flex:0 0 auto;' +
             'display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;' +
             'color:#fff;background:' + colorOf(l) + '">' + esc(initialOf(l)) + '</span>' +
           esc(l.name) + (on ? ' <span style="margin-left:auto;font-size:11.5px;opacity:.8">지금</span>' : '') +
           '</button>';
    }
    if (r.length < MAX_LEARNERS) {
      h += '<button class="cn-auth-btn ghost" type="button" data-new="1">+ 학습자 추가</button>';
    }
    h += '<p class="cn-auth-fine">실명 대신 <b>별명</b>을 권해요. 이름은 이 계정에만 저장되고, ' +
         '나이·학교 같은 정보는 받지 않아요.</p>';
    body.innerHTML = h;
  }

  /* prompt() 를 쓰는 이유: 이 시트는 보호자가 아주 가끔 쓰는 경로라 전용 입력 UI 의
     값보다 코드 표면이 더 비싸다. /account 의 로스터 화면이 정식 편집 자리다. */
  function promptNew() {
    var nm = null;
    try { nm = global.prompt('학습자 별명을 적어 주세요 (' + NAME_MAX + '자 이내)'); } catch (e) { nm = null; }
    if (nm == null) return;
    var it = add(nm);
    if (!it) { renderSheet(); return; }
    select(it.id);
    closeSheet();
  }

  var lastFocus = null;
  function openPicker(ctx) {
    var d = buildSheet();
    d.setAttribute('data-ctx', ctx || '');
    renderSheet();
    lastFocus = document.activeElement;
    d.hidden = false;
    requestAnimationFrame(function () { d.classList.add('on'); });
    var f = d.querySelector('.cn-auth-btn'); if (f) f.focus();
    document.addEventListener('keydown', onEsc, true);
    return new Promise(function (res) { sheetResolve = res; });
  }
  function closeSheet() {
    if (!sheetEl) return;
    sheetEl.classList.remove('on');
    document.removeEventListener('keydown', onEsc, true);
    setTimeout(function () { if (sheetEl) sheetEl.hidden = true; }, 180);
    try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (e) {}
    if (sheetResolve) { var r = sheetResolve; sheetResolve = null; try { r(learner()); } catch (e) {} }
  }
  function onEsc(e) { if (e.key === 'Escape') { e.stopPropagation(); closeSheet(); } }

  /* 진입점에서 부른다 — 물어야 할 때만 시트를 띄우고, 아니면 즉시 통과한다. */
  function ensurePicked(ctx) {
    if (!shouldAsk()) { touch(); return Promise.resolve(learner()); }
    return openPicker(ctx || 'ensure');
  }

  /* ── 초기화 ───────────────────────────────────────────── */
  function init() {
    lastId = id();                       // 통지 기준점(아직 auth 미확정 = 익명 토큰)
    var A = auth();
    if (!A || !A.ready) {                // auth 가 없으면 익명 스코프로 즉시 확정
      settled = true; readyRes(id()); return;
    }
    A.ready.then(function () {
      settled = true;
      readyRes(id());
      notify(false);                     // 토큰이 확정됐음을 알린다 — **변경은 아니다**
      lastId = id();
    }, function () {
      settled = true; readyRes(id());
    });
    /* 로그인·로그아웃으로 uid 가 바뀌면 스코프도 바뀐다.
       ⚠ settled 전 호출(등록 즉시 1회)은 무시한다 — 세션 복원은 변경이 아니다. */
    A.onAuthChange(function () {
      if (!settled) return;
      notify(true);
    });
  }

  /* ── 공개 API ─────────────────────────────────────────── */
  var scope = {
    VERSION: VERSION,
    ready: ready,
    get settled() { return settled; },

    id: id,
    key: key,
    learner: learner,
    list: roster,
    add: add,
    rename: rename,
    remove: remove,
    select: select,
    touch: touch,
    askMode: askMode,
    setAskMode: setAskMode,
    shouldAsk: shouldAsk,
    ensurePicked: ensurePicked,
    openPicker: openPicker,
    closePicker: closeSheet,
    onChange: onChange,
    pruneSessions: pruneSessions,
    colorOf: colorOf,
    NAME_MAX: NAME_MAX,
    MAX_LEARNERS: MAX_LEARNERS
  };

  global.CubeNest = global.CubeNest || {};
  global.CubeNest.scope = scope;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})(typeof globalThis !== 'undefined' ? globalThis : this);
