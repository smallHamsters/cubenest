/* ============================================================================
 * CubeNest mydata — "내 자료" 데이터 계층 (마스터 §6.4)
 *   window.CubeNest.mydata
 *
 *   · 저장/불러오기를 얇은 인터페이스로 추상화한다(§6.4). **로컬이 읽기 정본이고
 *     서버(Supabase)는 미러다** — 백엔드를 통째로 갈아끼우지 않는다. getNickname()
 *     처럼 동기 반환을 /my·/account 가 동기로 소비하는 곳이 있어, 서버는 읽어서
 *     **로컬 캐시를 채우는** 방향으로만 붙인다.
 *   · **계정 경계:** 공용 기기에서 계정을 바꿔도 앞 사람 자료가 보이면 안 된다.
 *     저장소 키에 uid 를 붙여 계정별로 나눈다(storeKey·nickKey). 비로그인은 접미
 *     없는 기존 키를 그대로 써서 이미 쌓인 자료가 사라지지 않는다.
 *   · 그래서 모든 공개 메서드는 Promise 를 돌려준다(로컬은 즉시 resolve).
 *     클라우드로 바뀌어도 호출부가 안 바뀌게 하기 위함이다.
 *   · quiz·worksheets 는 앞으로 결과를 남길 때 CubeNest.mydata.add(...) 를
 *     부른다(쓰기 계약은 §쓰기 API 참고). 지금은 quiz 가 남기는 레거시 키
 *     (cubenest_quiz_last)를 읽어 최근 결과 1건을 함께 보여준다.
 *
 *   ⚠ 이 계층은 편의·캐시일 뿐 방어선이 아니다. 유료·본인확인은 서버/RLS 가
 *     담당한다(§6.2·§6.5). 여기 저장되는 값은 신뢰 대상이 아니다.
 * ==========================================================================*/
(function (global) {
  'use strict';

  var VERSION = '0.2.0';

  var STORE_BASE = 'cubenest_my_v1';   // 개인 라이브러리(정본). 로그인 시 '__<uid>' 가 붙는다
  var NICK_BASE  = 'cubenest_nick';    // 표시 이름(닉네임). 로그인 시 '__<uid>' 가 붙는다
  var LEGACY_LAST = 'cubenest_quiz_last'; // quiz/run 이 남기는 마지막 결과 1건
  var LEGACY_HIDDEN = 'cubenest_quiz_last_hidden'; // /my 에서 숨긴 마지막 결과 ts
  var SESS_PREFIX = 'cubenest_quiz_sess_'; // quiz/run 진행(이어풀기) 세션
  var ADOPT_KEY  = 'cubenest_my_adopted';  // 이 기기의 비로그인 자료를 승계한 계정 uid(기기당 1회)
  var MAX_ITEMS  = 200;                 // 로컬 용량 보호(오래된 것부터 잘림)

  var KINDS = { quiz: 1, worksheet: 1, shape: 1 };

  /* quiz/run 유형 코드 → 사람이 읽는 이름. run.js TYPES 와 동기화(표시 전용). */
  var QUIZ_TYPE_LABEL = {
    count: '개수 세기', volume: '부피 구하기', surface: '겉넓이 구하기',
    heightmap: '위에서 본 수 쓰기', facesMc: '위·앞·옆 모양 고르기',
    minmax: '최소·최대', hidden: '안 보이는 나무', facesDraw: '위·앞·옆 그리기'
  };

  /* ── 계정 경계 ───────────────────────────────────────────
     mydata 가 CubeNest.auth 를 참조하는 유일한 구역이다(auth.js 는 mydata 를 모른다).
     ⚠ auth.settled 전에는 uid 가 null 이라 익명 키를 본다 — 세션이 복원되면
       wireAuth() 가 다시 읽게 한다. 페이지는 auth.ready 이후에 그리므로 화면엔 안 보인다. */
  function auth() { return (global.CubeNest && global.CubeNest.auth) || null; }
  function uid() {
    try {
      var A = auth();
      if (!A || !A.isLoggedIn()) return null;
      var u = A.getUser();
      return (u && u.id) || null;
    } catch (e) { return null; }
  }
  function scoped(base) { var id = uid(); return id ? (base + '__' + id) : base; }
  function storeKey() { return scoped(STORE_BASE); }
  function nickKey()  { return scoped(NICK_BASE); }

  function adoptedBy() {
    try { return global.localStorage.getItem(ADOPT_KEY) || ''; } catch (e) { return ''; }
  }
  /* 첫 로그인 승계 — 비로그인으로 쌓은 이 기기 자료를 **처음 로그인한 계정 하나가** 물려받는다.
     원본(익명 키)은 지우지 않는다: 로그아웃하면 그 기기 사용자가 자기 기록을 계속 봐야 한다.
     승계한 uid 를 남겨, 뒤에 로그인하는 다른 계정은 물려받지 못하게 한다(공용 기기 노출 차단). */
  function adopt(id) {
    if (!id) return;
    try {
      var ls = global.localStorage;
      if (ls.getItem(ADOPT_KEY)) return;            // 이 기기는 이미 누군가 승계했다
      ls.setItem(ADOPT_KEY, id);                    // 실패해도 무한 재시도되지 않게 먼저 찍는다
      var anon = ls.getItem(STORE_BASE);
      if (anon && !ls.getItem(STORE_BASE + '__' + id)) ls.setItem(STORE_BASE + '__' + id, anon);
      var nick = (ls.getItem(NICK_BASE) || '').trim();
      if (nick && !ls.getItem(NICK_BASE + '__' + id)) ls.setItem(NICK_BASE + '__' + id, nick);
    } catch (e) {}
  }

  /* ── 로컬 백엔드 ─────────────────────────────────────────── */
  function readStore() {
    try {
      var raw = global.localStorage.getItem(storeKey());
      if (!raw) return { v: 1, items: [] };
      var o = JSON.parse(raw);
      if (!o || !Array.isArray(o.items)) return { v: 1, items: [] };
      return o;
    } catch (e) { return { v: 1, items: [] }; }
  }
  function writeStore(o) {
    try { global.localStorage.setItem(storeKey(), JSON.stringify(o)); return true; }
    catch (e) { return false; }
  }
  function newId(kind) {
    return kind + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  var localBackend = {
    mode: 'local',
    list: function (kind) {
      var items = readStore().items.slice();
      if (kind) items = items.filter(function (it) { return it.kind === kind; });
      items.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
      return Promise.resolve(items);
    },
    add: function (item) {
      var o = readStore();
      var it = {
        id: item.id || newId(item.kind || 'item'),
        kind: KINDS[item.kind] ? item.kind : 'shape',
        title: String(item.title || '제목 없음'),
        sub: item.sub != null ? String(item.sub) : '',
        ts: item.ts || Date.now(),
        meta: item.meta && typeof item.meta === 'object' ? item.meta : {}
      };
      // 같은 id 면 갱신, 아니면 추가
      var i = o.items.findIndex(function (x) { return x.id === it.id; });
      if (i >= 0) o.items[i] = it; else o.items.push(it);
      // 용량 보호: 최신순 상위 MAX_ITEMS 만 유지
      o.items.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
      if (o.items.length > MAX_ITEMS) o.items.length = MAX_ITEMS;
      writeStore(o);
      return Promise.resolve(it);
    },
    remove: function (id) {
      var o = readStore(), n = o.items.length;
      o.items = o.items.filter(function (x) { return x.id !== id; });
      writeStore(o);
      return Promise.resolve(o.items.length < n);
    },
    clear: function (kind) {
      var o = readStore();
      o.items = kind ? o.items.filter(function (x) { return x.kind !== kind; }) : [];
      writeStore(o);
      return Promise.resolve();
    }
  };

  /* 자료(quiz·worksheet·shape)의 클라우드 저장은 다음 마일스톤이다(my_items·quiz_results).
     지금 서버에 붙는 것은 **프로필뿐**이라 백엔드는 계속 로컬 하나다. */
  function pickBackend() { return localBackend; }

  /* ── 프로필(서버 미러) ───────────────────────────────────
     Supabase 클라이언트를 새로 만들지 않는다 — auth 가 만든 하나(CubeNest.auth.client)를 쓴다.
     ⚠ select 는 컬럼을 명시한다(select * 금지, §6.4.1 코드 리뷰 체크 항목). */
  function db() { var A = auth(); return (A && A.client) || null; }

  function cacheNick(v) {
    try {
      if (v) global.localStorage.setItem(nickKey(), v);
      else global.localStorage.removeItem(nickKey());
    } catch (e) {}
  }

  /* 서버 → 로컬 캐시. 로그인·세션 복원 때마다 부른다(멱등).
     행이 없으면(트리거 실패 / 마이그레이션 이전 가입) upsert 로 자가 치유한다 —
     profiles 의 insert 정책이 바로 이걸 위해 있다. */
  var inflight = null, inflightUid = '';
  function syncProfile() {
    var id = uid(), c = db();
    if (!id || !c) return Promise.resolve(null);
    adopt(id);
    // wireAuth(ready+onAuthChange)와 페이지가 동시에 부른다 — 같은 계정 요청은 하나로 합친다.
    if (inflight && inflightUid === id) return inflight;
    inflightUid = id;
    inflight = c.from('profiles').select('nickname,role').eq('user_id', id).maybeSingle()
      .then(function (r) {
        if (!r || r.error) return null;
        if (!r.data) {
          return c.from('profiles').upsert({ user_id: id }, { onConflict: 'user_id' })
                  .then(function () { return null; });
        }
        cacheNick((r.data.nickname || '').trim());
        return r.data;
      })
      .catch(function () { return null; });   // 오프라인·서버 장애: 로컬 캐시로 계속 간다
    var mine = inflight;
    mine.then(function () { if (inflight === mine) inflight = null; });   // 위 catch 로 reject 되지 않는다
    return mine;
  }

  /* auth 배선 — 세션 복원과 계정 전환마다 프로필을 다시 읽는다.
     onAuthChange 는 등록 즉시 1회 동기 호출되므로(auth.js) ready 와 겹쳐 두 번 돌 수 있다 — 멱등이라 무해. */
  function wireAuth() {
    var A = auth();
    if (!A) return;
    try {
      if (A.ready && A.ready.then) A.ready.then(function () { syncProfile(); });
      if (A.onAuthChange) A.onAuthChange(function (loggedIn) { if (loggedIn) syncProfile(); });
    } catch (e) {}
  }

  /* ── 레거시·읽기 전용 소스 ─────────────────────────────────
     quiz/run 은 이제 mydata.add() 를 부르지만(run.js), 그 이전에 쌓인
     마지막 결과 1건이 cubenest_quiz_last 에 남아 있다.
     그걸 읽어 합성 아이템으로 함께 보여준다(중복은 seed+type 으로 걸러낸다). */
  function latestQuiz() {
    try {
      // 계정 경계: 이 기기의 비로그인 흔적은 **승계한 계정에게만** 보인다.
      //   (레거시 키는 quiz/run 이 계정과 무관하게 쓰므로 여기서 가린다.)
      var me = uid();
      if (me && adoptedBy() !== me) return null;
      var raw = global.localStorage.getItem(LEGACY_LAST);
      if (!raw) return null;
      var q = JSON.parse(raw);           // {type, seed, n, score, ts}
      if (!q || !q.type || !q.seed) return null;
      // /my 에서 '삭제'로 숨긴 마지막 결과면 표시하지 않는다(클라이언트 전용).
      try { if (global.localStorage.getItem(LEGACY_HIDDEN) === String(+q.ts || 0)) return null; } catch (e) {}
      var label = QUIZ_TYPE_LABEL[q.type] || q.type;
      var n = Math.max(1, +q.n || 0), score = Math.max(0, +q.score || 0);
      return {
        id: 'legacy_quiz_last',
        kind: 'quiz',
        title: label,
        sub: n ? ('맞힌 문제 ' + score + '/' + n) : '',
        ts: +q.ts || 0,
        meta: { type: q.type, seed: q.seed, n: n, score: score, source: 'device' },
        // 같은 seed → 같은 문제. 진행 세션이 남아 있으면 run.js 가 이어풀기로 복원.
        // 주의: '../' 는 깊이 1 페이지(/my·/account) 기준이다.
        // 더 깊은 곳에서 소비하려면 여기서 경로를 만들지 말고 호출부가 넘겨야 한다.
        openUrl: '../quiz/run/?type=' + encodeURIComponent(q.type) +
                 '&seed=' + encodeURIComponent(q.seed) + '&n=' + n
      };
    } catch (e) { return null; }
  }

  /* 진행 중(이어풀기) 퀴즈 개수 — 정확한 URL 재현은 어려워 "개수"만 알린다. */
  function resumableCount() {
    try {
      var ls = global.localStorage, c = 0;
      for (var i = 0; i < ls.length; i++) {
        var k = ls.key(i);
        if (k && k.indexOf(SESS_PREFIX) === 0 && k.slice(-3) !== '_sc') c++;
      }
      return c;
    } catch (e) { return 0; }
  }

  /* 이 기기에 남아 있는 학습 흔적이 있는가(로그아웃 상태에서 로그인 유도 문구용). */
  function hasDeviceData() {
    if (latestQuiz()) return true;
    if (resumableCount() > 0) return true;
    try { return readStore().items.length > 0; } catch (e) { return false; }
  }

  /* ── 공개 API ─────────────────────────────────────────────
     list/add/remove/clear 는 백엔드로 위임(로컬↔클라우드 교체 무접점).
     quizFeed 는 /my 가 바로 쓰도록 저장분 + 레거시 최근결과를 합쳐준다. */
  var mydata = {
    VERSION: VERSION,
    // 자료는 아직 로컬 전용, 프로필만 서버 미러다.
    mode: function () { return uid() ? 'local+cloud-profile' : 'local'; },

    // meta.url 이 있으면 openUrl 로 승격한다(/my 의 '열기' 버튼 조건).
    //   문제지는 URL 하나가 곧 문제지 사양(유형·난이도·seed)이라 같은 URL = 같은 문제지다.
    list:   function (kind) {
      return pickBackend().list(kind).then(function (items) {
        items.forEach(function (it) {
          if (!it.openUrl && it.meta && it.meta.url) it.openUrl = it.meta.url;
        });
        return items;
      });
    },
    add:    function (item) { return pickBackend().add(item); },
    remove: function (id)   { return pickBackend().remove(id); },
    clear:  function (kind) { return pickBackend().clear(kind); },

    count: function (kind) {
      return pickBackend().list(kind).then(function (a) { return a.length; });
    },

    // /my 퀴즈 섹션용: 저장분 + (중복 아닌) 레거시 최근결과, 최신순.
    quizFeed: function () {
      return pickBackend().list('quiz').then(function (items) {
        // 저장된 퀴즈도 seed 로 같은 문제를 다시 열 수 있게 openUrl 을 채운다.
        items.forEach(function (it) {
          if (!it.openUrl && it.meta && it.meta.seed && it.meta.type) {
            it.openUrl = '../quiz/run/?type=' + encodeURIComponent(it.meta.type) +
                         '&seed=' + encodeURIComponent(it.meta.seed) +
                         '&n=' + (Math.max(1, +it.meta.n || 0) || 10);
          }
        });
        var last = latestQuiz();
        if (last) {
          var dup = items.some(function (it) {
            return it.meta && it.meta.seed === last.meta.seed && it.meta.type === last.meta.type;
          });
          if (!dup) items = [last].concat(items);
        }
        items.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
        return items;
      });
    },

    latestQuiz: latestQuiz,
    resumableCount: resumableCount,
    hasDeviceData: hasDeviceData,
    typeLabel: function (t) { return QUIZ_TYPE_LABEL[t] || t; },

    /* 표시 이름(닉네임) — account 에서 설정, /my 제목에서 사용.
       읽기는 **동기**다(my/index.html·account/index.html 이 동기로 소비). 서버 값은
       syncProfile() 이 로컬 캐시에 미리 채워 둔다 — 이 시그니처는 바꾸지 말 것. */
    getNickname: function () {
      try { return (global.localStorage.getItem(nickKey()) || '').trim(); } catch (e) { return ''; }
    },
    /* 로컬 즉시 저장 + 서버 best-effort 미러.
       ⚠ 20 = 마이그레이션의 check (char_length(nickname) <= 20) 과 **같은 값이어야 한다**.
         갈라지면 클라가 통과시킨 값을 DB 가 거부해 "저장했는데 안 되는" 상태가 된다.
       반환: {value, synced} — 서버가 실패해도 로컬은 저장된 것이라, 호출부가 문구를 정직하게 가른다. */
    setNickname: function (v) {
      v = (v == null ? '' : String(v)).trim().slice(0, 20);
      cacheNick(v);
      var id = uid(), c = db();
      if (!id || !c) return Promise.resolve({ value: v, synced: false });
      return c.from('profiles')
        .upsert({ user_id: id, nickname: v || null }, { onConflict: 'user_id' })
        .then(function (r) { return { value: v, synced: !(r && r.error) }; })
        .catch(function () { return { value: v, synced: false }; });
    },
    /* 서버 프로필 → 로컬 캐시. 페이지가 그리기 전에 부르면 최신 닉네임이 반영된다. */
    syncProfile: syncProfile,

    /* /my '삭제' — quiz/run 이 남긴 마지막 결과(레거시)를 이 기기에서만 숨긴다. */
    dismissLatestQuiz: function (ts) {
      try { global.localStorage.setItem(LEGACY_HIDDEN, String(+ts || 0)); } catch (e) {}
      return Promise.resolve(true);
    }
  };

  global.CubeNest = global.CubeNest || {};
  global.CubeNest.mydata = mydata;

  // auth.js 는 모든 소비 페이지에서 mydata.js 보다 **먼저** 로드된다(4곳 모두 확인).
  // 그래도 순서가 뒤집힌 페이지가 생기면 DOMContentLoaded 에서 한 번 더 시도한다.
  if (auth()) wireAuth();
  else if (global.document && global.document.addEventListener) {
    global.document.addEventListener('DOMContentLoaded', wireAuth);
  }

})(typeof globalThis !== 'undefined' ? globalThis : this);
