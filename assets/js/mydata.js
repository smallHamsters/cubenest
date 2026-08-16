/* ============================================================================
 * CubeNest mydata — "내 자료" 데이터 계층 (마스터 §6.4)
 *   window.CubeNest.mydata
 *
 *   · 저장/불러오기를 얇은 인터페이스로 추상화한다(§6.4). 지금은 이 기기
 *     localStorage 가 백엔드이고, 로그인·RLS 백엔드가 준비되면 이 파일의
 *     backend 만 교체하면 /account·/my 페이지 코드는 그대로 둔다.
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

  var VERSION = '0.1.0';

  var STORE_KEY  = 'cubenest_my_v1';   // 이 기기 개인 라이브러리(정본)
  var LEGACY_LAST = 'cubenest_quiz_last'; // quiz/run 이 남기는 마지막 결과 1건
  var LEGACY_HIDDEN = 'cubenest_quiz_last_hidden'; // /my 에서 숨긴 마지막 결과 ts
  var NICK_KEY   = 'cubenest_nick';    // 표시 이름(닉네임) — account 에서 설정
  var SESS_PREFIX = 'cubenest_quiz_sess_'; // quiz/run 진행(이어풀기) 세션
  var MAX_ITEMS  = 200;                 // 로컬 용량 보호(오래된 것부터 잘림)

  var KINDS = { quiz: 1, worksheet: 1, shape: 1 };

  /* quiz/run 유형 코드 → 사람이 읽는 이름. run.js TYPES 와 동기화(표시 전용). */
  var QUIZ_TYPE_LABEL = {
    count: '개수 세기', volume: '부피 구하기', surface: '겉넓이 구하기',
    heightmap: '위에서 본 수 쓰기', facesMc: '위·앞·옆 모양 고르기',
    minmax: '최소·최대', hidden: '안 보이는 나무', facesDraw: '위·앞·옆 그리기'
  };

  /* ── 로컬 백엔드 ─────────────────────────────────────────── */
  function readStore() {
    try {
      var raw = global.localStorage.getItem(STORE_KEY);
      if (!raw) return { v: 1, items: [] };
      var o = JSON.parse(raw);
      if (!o || !Array.isArray(o.items)) return { v: 1, items: [] };
      return o;
    } catch (e) { return { v: 1, items: [] }; }
  }
  function writeStore(o) {
    try { global.localStorage.setItem(STORE_KEY, JSON.stringify(o)); return true; }
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

  /* 나중에 로그인·RLS 백엔드로 교체할 자리(§6.4). 형태만 남긴다.
     const cloudBackend = {
       mode:'cloud',
       list(kind){ return supabase.from('my_items').select().eq('kind',kind) ... }
       add(item){ ... }  // RLS 가 user_id 강제
       ...
     };
     교체 지점: pickBackend() 가 로그인 + 서버 준비 시 cloudBackend 를 고른다. */
  function pickBackend() { return localBackend; }

  /* ── 레거시·읽기 전용 소스 ─────────────────────────────────
     quiz/run 은 이제 mydata.add() 를 부르지만(run.js), 그 이전에 쌓인
     마지막 결과 1건이 cubenest_quiz_last 에 남아 있다.
     그걸 읽어 합성 아이템으로 함께 보여준다(중복은 seed+type 으로 걸러낸다). */
  function latestQuiz() {
    try {
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
    mode: function () { return pickBackend().mode; },

    list:   function (kind) { return pickBackend().list(kind); },
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

    /* 표시 이름(닉네임) — account 에서 설정, /my 제목에서 사용. 로컬 전용(추후 프로필 동기화 이음새). */
    getNickname: function () {
      try { return (global.localStorage.getItem(NICK_KEY) || '').trim(); } catch (e) { return ''; }
    },
    setNickname: function (v) {
      try {
        v = (v == null ? '' : String(v)).trim().slice(0, 20);
        if (v) global.localStorage.setItem(NICK_KEY, v);
        else global.localStorage.removeItem(NICK_KEY);
      } catch (e) {}
      return Promise.resolve(v);
    },

    /* /my '삭제' — quiz/run 이 남긴 마지막 결과(레거시)를 이 기기에서만 숨긴다. */
    dismissLatestQuiz: function (ts) {
      try { global.localStorage.setItem(LEGACY_HIDDEN, String(+ts || 0)); } catch (e) {}
      return Promise.resolve(true);
    }
  };

  global.CubeNest = global.CubeNest || {};
  global.CubeNest.mydata = mydata;

})(typeof globalThis !== 'undefined' ? globalThis : this);
