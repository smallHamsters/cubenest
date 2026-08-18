/* ============================================================================
 * CubeNest gen-config — 연령 스테이지 × 등급 × 유형
 *   정본: .claude/quiz/cubenest_난이도_재설계_260818_v0_1.md (v0.4)
 *   서버 전용(생성기). UMD(node require + 브라우저 전역).
 *
 * ── v0.3.0 구조 변경: 축 순서를 뒤집었다 ──
 *   [이전] 등급 → (격자, 밀도) → 개수(결과)   ← 개수 상한을 아무도 보지 않았다
 *   [지금] 스테이지 → 개수 밴드(1차) → 격자·높이 → 등급
 *
 *   이전 모델의 "밀도 U자(꽉참=규칙적=쉬움)"는 구현에서 0.9%만 성립했다
 *   (full = '직육면체'가 아니라 '85~100% 채움'이라 규칙성 없이 개수만 컸다).
 *   그 결과 count '하'가 median 25·최대 125 로 나왔고 세 유형에서 등급이
 *   역전됐다. 그래서 밀도 라벨을 버리고, 등급이 개수 밴드를 직접 정한 뒤
 *   격자·발자국은 그 밴드를 만족하는 범위에서만 고르게 했다.
 *
 * ── 축 ──
 *   ① 스테이지(S1~S5)  = 연령/학년. 유형 게이트 · 밴드 · 높이 · 가림 허용
 *   ② 등급(하/중/상/최상) = 스테이지 안에서의 상대 난이도
 *   ③ 유형 고유축       = edge · 정답값 상한 · 오목 등
 *   난이도 = "얼마나 많이"가 아니라 "무엇이 부담인가"로 정한다.
 * ==========================================================================*/
(function (global) {
  var VERSION = "cfg-0.3.0";

  var ORDER = ["하", "중", "상", "최상"];

  // ── 격자 (높이는 격자가 아니라 스테이지·등급이 정한다) ──
  var GRID = {
    XS: { gx: 2, gz: 2 },   // S1 전용 — S1 보류 중이라 현재 미사용
    S:  { gx: 3, gz: 3 },
    M:  { gx: 4, gz: 4 },
    L:  { gx: 5, gz: 5 }
    // XL: { gx: 7, gz: 7 }, XXL: { gx: 10, gz: 10 }   ← 경시 모드(나중)
  };

  // ── ① 스테이지 ──
  //   open=false 면 노출하지 않는다(설계는 남겨 두어 열 때 다시 만들지 않는다).
  //   flatten=true 면 '안 보이는 나무'를 강제로 없앤다 — 그 개념은 초6에서 처음 배운다.
  //   dim: '3d'=회전 가능한 뷰어 고정 / 'any'=2D 겨냥도 허용. 겨냥도는 초5에서 처음 배운다.
  var STAGES = {
    S1: { grade: "초1~2", age: "6~7",   open: false, flatten: true,  dim: "3d"  },
    S2: { grade: "초3~4", age: "8~9",   open: true,  flatten: true,  dim: "3d"  },
    S3: { grade: "초5",   age: "10",    open: true,  flatten: true,  dim: "3d"  },
    S4: { grade: "초6",   age: "11",    open: true,  flatten: false, dim: "any" },
    S5: { grade: "중1~2", age: "12~13", open: true,  flatten: false, dim: "any" }
  };
  var DEFAULT_STAGE = "S4";              // 교과 핵심이자 제품의 원점 — 미지정 시 기존 동작 유지
  var STAGE_ORDER = ["S1", "S2", "S3", "S4", "S5"];

  // ── ① 스테이지 × 등급 → 개수 밴드 · 격자 · 높이 상한 ──
  //   한 칸에 약 1.4배씩 오르는 하나의 자. 스테이지끼리 두 칸씩 겹쳐 절벽을 없앤다.
  var BANDS = {
    S1: { "하": { n: [2, 4],   grid: "XS", maxH: 2 }, "중": { n: [4, 6],   grid: "S", maxH: 2 },
          "상": { n: [6, 8],   grid: "S",  maxH: 2 }, "최상": { n: [8, 10],  grid: "S", maxH: 2 } },
    S2: { "하": { n: [5, 8],   grid: "S",  maxH: 3 }, "중": { n: [8, 11],  grid: "S", maxH: 3 },
          "상": { n: [11, 15], grid: "M",  maxH: 3 }, "최상": { n: [15, 20], grid: "M", maxH: 3 } },
    S3: { "하": { n: [7, 10],  grid: "S",  maxH: 3 }, "중": { n: [10, 14], grid: "M", maxH: 3 },
          "상": { n: [14, 20], grid: "M",  maxH: 3 }, "최상": { n: [20, 28], grid: "M", maxH: 3 } },
    S4: { "하": { n: [8, 12],  grid: "S",  maxH: 4 }, "중": { n: [12, 18], grid: "M", maxH: 4 },
          "상": { n: [18, 26], grid: "M",  maxH: 4 }, "최상": { n: [26, 36], grid: "L", maxH: 4 } },
    S5: { "하": { n: [12, 18], grid: "M",  maxH: 4 }, "중": { n: [18, 26], grid: "M", maxH: 5 },
          "상": { n: [26, 36], grid: "L",  maxH: 5 }, "최상": { n: [36, 52], grid: "L", maxH: 5 } }
  };

  // ── ① 유형 게이트 — 개수만 줄인다고 저학년용이 되지 않는다 ──
  //   true = 전 서브 / 배열 = 그 서브만. 없으면 그 스테이지에서 닫혀 있다.
  //   근거(한국 교육과정): 겨냥도=초5 · 부피/겉넓이=초6-1 · 공간과 입체=초6-2.
  var ALL_A = ["A-a", "A-b", "A-c", "A-d", "A-e", "A-f"];
  var ALL_G = ["G-a", "G-b", "G-c"];
  var GATE = {
    S1: { count: true },
    S2: { count: true, heightmap: true, hidden: ["A-c", "A-e"], minmax: ["G-c"] },
    S3: { count: true, heightmap: true, hidden: ["A-c", "A-e"], minmax: ["G-c"],
          facesMc: true,                        // 위·앞·옆 전부 — 방향 개념이 삼면도의 핵심
          manip: ["H-c"] },
    S4: { count: true, volume: true, surface: true, heightmap: true,
          facesMc: true, facesDraw: true,
          hidden: ALL_A, minmax: ALL_G, manip: ["H-c", "H-d"] },
    S5: { count: true, volume: true, surface: true, heightmap: true,
          facesMc: true, facesDraw: true,
          hidden: ALL_A, minmax: ALL_G, manip: ["H-a", "H-b", "H-c", "H-d"] }
  };

  // ── ③ 유형 고유축 ──
  //   edge      : 모서리 길이(volume·surface 만 의미)
  //   answerMax : 정답값 상한 — 개수와 edge 가 곱으로 겹쳐 네 자리가 되는 것을 막는다
  //               (이전엔 volume 중이 최대 1701, 상이 3186 이었다)
  //   concave   : 겉넓이 오목 밴딩(true=강제 / false=금지 / null=무관)
  var TYPE_AXES = {
    volume: {
      edge:      { "하": 1, "중": [1, 2], "상": [2, 3], "최상": [2, 3] },
      answerMax: { "하": 30, "중": 200, "상": 999, "최상": 999 }
    },
    surface: {
      edge:      { "하": 1, "중": [1, 2], "상": [2, 3], "최상": [2, 2] },
      answerMax: { "하": 99, "중": 300, "상": 999, "최상": 999 },
      concave:   { "하": false, "중": false, "상": null, "최상": true }
    }
  };

  // ── 'box'(직육면체) — '하'에서만, 계산형에서만 ──
  //   개수 = 가로×세로×높이 로 떨어져 곱셈 한 번이면 센다. 이전 'full'(85~100% 채움)이
  //   규칙성을 못 만든 자리를 대신한다. 나머지 유형은 상자가 되면 문제가 자명해져 제외.
  var BOX_TYPES = { count: 1, volume: 1, surface: 1 };
  var BOX_RATE = 0.5;                     // '하' 문항의 절반

  // ── 헬퍼 ──
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
  function band(rng, lo, hi) { return lo + (hi - lo) * rng(); }
  function clampInt(v, lo, hi) { return Math.max(lo, Math.min(hi, Math.round(v))); }
  function riBetween(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }

  function normStage(stage) {
    return (stage && STAGES[stage] && STAGES[stage].open) ? stage : DEFAULT_STAGE;
  }
  function stages() {                     // 노출용 목록(랜딩 단일 출처)
    return STAGE_ORDER.filter(function (s) { return STAGES[s].open; })
      .map(function (s) { return { id: s, grade: STAGES[s].grade, age: STAGES[s].age, dim: STAGES[s].dim }; });
  }

  // 유형이 그 스테이지에서 열려 있으면 4등급 전부 지원한다.
  //   (밴드를 스테이지가 정하므로 '이 유형은 상까지'라는 옛 제한이 필요 없어졌다.)
  function support(type, stage) {
    var g = GATE[normStage(stage)] || {};
    return g[type] ? ORDER.slice() : [];
  }
  // 그 스테이지에서 허용되는 서브 목록. true(전 서브)면 null 을 돌려준다.
  function subsFor(type, stage) {
    var v = (GATE[normStage(stage)] || {})[type];
    return (v && v.length) ? v.slice() : null;
  }
  // 그 스테이지에서 열린 유형 목록(랜딩 카드 필터용)
  function typesFor(stage) { return Object.keys(GATE[normStage(stage)] || {}); }

  function nearestLevel(label) {
    var i = ORDER.indexOf(label);
    return i >= 0 ? label : "중";
  }
  function pickEdge(spec, label, rng) {
    if (!spec) return 1;
    var e = spec[label];
    if (e === undefined) return 1;
    if (typeof e === "number") return e;
    return riBetween(rng, e[0], e[1]);
  }

  // ── resolveCfg: (type, stage, label, rng) → genShape 가 먹는 cfg + 생성 제약 ──
  function resolveCfg(type, stage, label, rng) {
    stage = normStage(stage);
    label = nearestLevel(label);
    var b = BANDS[stage][label];
    var g = GRID[b.grid] || GRID.S;
    var maxH = b.maxH;
    var cells = g.gx * g.gz;

    // 목표 개수 n — 밴드 안에서, 격자가 담을 수 있는 만큼만
    var lo = Math.min(b.n[0], cells * maxH), hi = Math.min(b.n[1], cells * maxH);
    var n = clampInt(band(rng, lo, hi), lo, hi);

    // 발자국 f — n 을 높이 maxH 이하로 담을 수 있는 범위에서. 이것이 밀도를 대신한다.
    var fLo = Math.max(1, Math.ceil(n / maxH)), fHi = Math.min(cells, n);
    if (fLo > fHi) fLo = fHi;
    var f = clampInt(band(rng, fLo, fHi), fLo, fHi);

    var ax = TYPE_AXES[type] || {};
    return {
      gx: g.gx, gz: g.gz, maxH: maxH,
      fMin: f, fMax: f, nMin: n, nMax: n,          // genShape 계약 불변
      edge: pickEdge(ax.edge, label, rng),
      nBand: [lo, hi],                              // 재생성 후 밴드 준수 확인용
      box: !!(BOX_TYPES[type] && label === "하" && rng() < BOX_RATE),
      answerMax: ax.answerMax ? ax.answerMax[label] : null,
      concave: ax.concave ? ax.concave[label] : null,
      flatten: !!STAGES[stage].flatten,             // S2·S3 는 가림 금지
      subs: subsFor(type, stage),
      _meta: { stage: stage, label: label, grid: b.grid, n: n, foot: f }
    };
  }

  var CFG = {
    VERSION: VERSION,
    GRID: GRID, ORDER: ORDER,
    STAGES: STAGES, STAGE_ORDER: STAGE_ORDER, DEFAULT_STAGE: DEFAULT_STAGE,
    BANDS: BANDS, GATE: GATE, TYPE_AXES: TYPE_AXES,
    stages: stages, typesFor: typesFor, subsFor: subsFor,
    support: support, resolveCfg: resolveCfg, normStage: normStage
  };
  global.CubeNest = global.CubeNest || {};
  global.CubeNest.genConfig = CFG;
  if (typeof module !== "undefined" && module.exports) module.exports = CFG;

})(typeof globalThis !== "undefined" ? globalThis : this);


// [서버 전용] ESM named export
export const genConfig = globalThis.CubeNest.genConfig;
