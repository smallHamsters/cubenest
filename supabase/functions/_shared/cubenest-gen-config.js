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
  var VERSION = "cfg-0.4.0";

  var ORDER = ["하", "중", "상", "최상"];

  // ── 격자 (높이는 격자가 아니라 스테이지·등급이 정한다) ──
  var GRID = {
    XS: { gx: 2, gz: 2 },   // 유아·초1~2 하위 등급 — 한눈에 세지는 크기
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
    //   flattenHidden = 가림 자체를 없앤다(저학년 — '안 보이는 나무'는 초6 개념)
    //   capHidden     = 가림은 남기고 숨은 열 높이를 1 로 고정한다
    //     → 겨냥도 + 위모양만으로 개수가 유일해진다. 시중 문제집 3종이 예외 없이 쓰는 관행이고,
    //       개념(숨은 나무 추론)을 살리면서 지면에서도 풀리게 하는 유일한 방법이다.
    //   note = 랜딩 학년 칩 아래에 그대로 노출되는 한 줄 설명(표기의 단일 출처)
    S0: { grade: "유아",   age: "5~7",   open: true,  flatten: true,  capHidden: false, dim: "3d",
          note: "사고력 '도형' 첫걸음 — 2~7개를 눈으로 세요" },
    S1: { grade: "초1~2", age: "7~8",   open: true,  flatten: true,  capHidden: false, dim: "3d",
          note: "초등 저학년 — 3~11개, 위에서 본 모양 찾기까지" },
    S2: { grade: "초3~4", age: "8~9",   open: true,  flatten: true,  capHidden: false, dim: "3d",
          note: "쌓기나무 개수·층별 세기" },
    S3: { grade: "초5",   age: "10",    open: true,  flatten: true,  capHidden: false, dim: "3d",
          note: "겨냥도·위앞옆(삼면도)이 나오는 학년" },
    S4: { grade: "초6",   age: "11",    open: true,  flatten: false, capHidden: true,  dim: "any",
          note: "교과 '공간과 입체' — 부피·겉넓이·안 보이는 나무" },
    // 중1~2 는 노출하지 않는다(사용자 결정 260820). 설계는 남겨 둔다 — 다시 열 때 재작성하지 않으려고.
    S5: { grade: "중1~2", age: "12~13", open: false, flatten: false, capHidden: true,  dim: "any" }
  };
  var DEFAULT_STAGE = "S4";              // 교과 핵심이자 제품의 원점 — 미지정 시 기존 동작 유지
  var STAGE_ORDER = ["S0", "S1", "S2", "S3", "S4", "S5"];

  // ── ① 스테이지 × 등급 → 개수 밴드 · 격자 · 높이 상한 ──
  //   한 칸에 약 1.4배씩 오르는 하나의 자. 스테이지끼리 두 칸씩 겹쳐 절벽을 없앤다.
  //   ⚠ v0.4 재조정 — 시중 문제집 3종 실측(64면)에 맞췄다.
  //     3권 공통: 바닥 3×3 이 80~85%(사용 칸 4~8) · 최고 3층이 90% · 세는 유형 총 개수 7~13개.
  //     이전 값(S4 최상 26~36)은 문제집 '심화' 대역(최대 23)마저 넘었다. 한 스테이지씩 내렸다.
  //     문제집의 큰 수(27·64·125)는 전부 '세지 않고 공식으로 푸는' 정육면체 유형이라
  //     여기가 아니라 manip 고유축(boxTotal·needBand)이 담당한다.
  //   S0·S1 은 v0.5 에서 열었다(유아·초등 저학년). 시중 유아 사고력 '도형' 교재 실측 기준:
  //     쌓기나무 문항의 개수는 2~8개, 높이 2층, 바닥 2×2~3×3 이 거의 전부다.
  //     S0 최상 ↔ S1 하, S1 최상 ↔ S2 상 이 겹치도록 두어 학년 경계에서 절벽이 없다.
  var BANDS = {
    S0: { "하": { n: [2, 3],   grid: "XS", maxH: 2 }, "중": { n: [3, 4],   grid: "XS", maxH: 2 },
          "상": { n: [4, 5],   grid: "S",  maxH: 2 }, "최상": { n: [5, 7],   grid: "S",  maxH: 2 } },
    // ⚠ S1 '하' 를 XS(2×2)로 두면 facesMc '앞' 보기가 2~3개밖에 안 나온다 —
    //   2칸 막대는 서로 다른 실루엣이 8가지뿐이라 오답 후보가 고갈된다(실측 2.9%). 그래서 S 로 둔다.
    S1: { "하": { n: [3, 4],   grid: "S",  maxH: 2 }, "중": { n: [4, 6],   grid: "S", maxH: 2 },
          "상": { n: [6, 8],   grid: "S",  maxH: 3 }, "최상": { n: [8, 11],  grid: "S", maxH: 3 } },
    S2: { "하": { n: [4, 6],   grid: "S",  maxH: 3 }, "중": { n: [6, 8],   grid: "S", maxH: 3 },
          "상": { n: [8, 11],  grid: "S",  maxH: 3 }, "최상": { n: [10, 14], grid: "M", maxH: 3 } },
    S3: { "하": { n: [5, 8],   grid: "S",  maxH: 3 }, "중": { n: [8, 11],  grid: "S", maxH: 3 },
          "상": { n: [10, 14], grid: "S",  maxH: 4 }, "최상": { n: [13, 18], grid: "M", maxH: 4 } },
    S4: { "하": { n: [6, 9],   grid: "S",  maxH: 3 }, "중": { n: [9, 13],  grid: "S", maxH: 3 },
          "상": { n: [12, 18], grid: "M",  maxH: 4 }, "최상": { n: [16, 24], grid: "M", maxH: 4 } },
    S5: { "하": { n: [9, 13],  grid: "S",  maxH: 3 }, "중": { n: [12, 18], grid: "M", maxH: 4 },
          "상": { n: [16, 24], grid: "M",  maxH: 4 }, "최상": { n: [22, 32], grid: "L", maxH: 5 } }
  };

  // ── ① 유형 게이트 — 개수만 줄인다고 저학년용이 되지 않는다 ──
  //   true = 전 서브 / 배열 = 그 서브만. 없으면 그 스테이지에서 닫혀 있다.
  //   근거(한국 교육과정): 겨냥도=초5 · 부피/겉넓이=초6-1 · 공간과 입체=초6-2.
  var ALL_A = ["A-a", "A-b", "A-c", "A-d", "A-e", "A-f"];
  var ALL_G = ["G-a", "G-b", "G-c"];
  var GATE = {
    // 유아·초1~2 — 교과에는 '쌓기나무'가 없지만 사고력 '도형' 교재에는 있다.
    //   그 교재가 내는 것은 딱 두 가지다: ① 몇 개인지 세기 ② 위(앞)에서 보면 어떤 모양인지 고르기.
    //   ②는 facesMc 를 그대로 쓰되 **묻는 방향을 제한**한다(TYPE_AXES.facesMc.dirs) —
    //   '앞·옆'은 높이를 읽어야 하는 삼면도 개념이라 유아에겐 위(발자국)부터가 맞다.
    S0: { count: true, facesMc: true },
    S1: { count: true, facesMc: true },
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
    },

    // facesMc — 고유축은 '어느 방향을 묻는가'다. 개수를 줄여도 앞·옆은 높이 추론이 필요해
    //   저학년에게 어렵고, 위(발자국)는 그림자 찾기라 유아 교재의 표준 문항이다.
    //   지정이 없는 스테이지는 종전대로 위·앞·옆 전부(위모양을 함께 주는 스테이지는 앞·옆만).
    facesMc: {
      dirs: { S0: ["top"], S1: ["top", "front"] }
    },

    // heightmap — 1차 축이 개수가 아니라 **칸 수**다(아이가 쓰는 건 칸마다 숫자 하나).
    //   개수 밴드를 그냥 적용하면 최상 칸 수가 오히려 늘어난다(실측 17 → p90 23).
    //   고유축 = 굴곡(인접 칸 높이차 평균). remap v0.7 이 지정했는데 구현되지 않았던 축이다.
    heightmap: {
      // 칸 수 상한(=발자국). 문제집 실측 '사용 칸 4~8' 에 맞춰 v0.4 에서 낮췄다.
      foot: {
        // S0·S1 은 heightmap 이 게이트에서 닫혀 있어 실제로는 쓰이지 않는다.
        // (스테이지를 열 때 값이 없어 S4 로 떨어지는 사고를 막으려고 함께 둔다.)
        S0: { "하": 2, "중": 2, "상": 3,  "최상": 3  },
        S1: { "하": 2, "중": 3, "상": 3,  "최상": 4  },
        S2: { "하": 3, "중": 4, "상": 5,  "최상": 6  },
        S3: { "하": 4, "중": 5, "상": 6,  "최상": 7  },
        S4: { "하": 4, "중": 6, "상": 8,  "최상": 9  },
        S5: { "하": 6, "중": 8, "상": 11, "최상": 13 }
      },
      // 열 높이 배수(개수 = 칸 수 × 이 배수) — 등급이 오를수록 높이 변화가 커진다.
      //   foot × hMul 이 그 등급의 개수 밴드 안에 떨어지도록 맞춰 뒀다.
      hMul:   { "하": [1.3, 1.7], "중": [1.5, 2.0], "상": [1.7, 2.2], "최상": [1.9, 2.5] },
      rugged: { "하": [0, 0.75],   "중": [0.6, 1.1],  "상": [0.9, 1.3], "최상": [1.15, 99] }
    },

    // hidden — A-f(여러 가지 종류)의 정답이 곧 고유축. 예전엔 {2,3,4,6} 네 값뿐이라
    //   찍어서 25% 맞았다. 숨은 열을 2개 이상 만들면 가짓수 = Π(D−1) 가 퍼진다.
    hidden: {
      kinds: { "하": [2, 3], "중": [3, 4], "상": [4, 9], "최상": [9, 27] },
      hcolsMin: { "하": 1, "중": 1, "상": 2, "최상": 2 }   // A-f 에서 요구할 숨은 열 최소 개수
    },

    // manip — 개수 밴드가 1차 축이 아니다(§4.2 예외).
    //   H-d: 제시물이 꽉 찬 상자라 셀 일이 없다 → 축은 '상자 모양 × k'
    //   H-c: 부담은 개수가 아니라 정답값('더 필요한 개수')
    //   H-c: 답 = m³ − 개수 라 **개수 밴드로는 답을 제어할 수 없다**(넓고 낮으면 답이 폭발한다.
    //        실측: 개수 밴드만 걸었을 때 하 등급 정답이 56, 최상이 106). 그래서 목표 답에서
    //        거꾸로 모양을 만든다 — 한 변 m 정육면체에서 need 개를 덜어낸 계단 모양.
    //        need 상한 = m³ − (m + m² − 1)  (모든 열을 1까지 내리고 한 열만 m 으로 남긴 최소)
    manip: {
      boxTotal: { "하": [8, 18], "중": [18, 36], "상": [36, 64], "최상": [64, 100] },
      cubeM:    { "하": 3, "중": 3, "상": 4, "최상": 4 },
      needBand: { "하": [2, 6], "중": [7, 16], "상": [10, 25], "최상": [26, 45] }
    }
  };

  // ── 'box'(직육면체) — '하'에서만, 계산형에서만 ──
  //   개수 = 가로×세로×높이 로 떨어져 곱셈 한 번이면 센다. 이전 'full'(85~100% 채움)이
  //   규칙성을 못 만든 자리를 대신한다. 나머지 유형은 상자가 되면 문제가 자명해져 제외.
  var BOX_TYPES = { count: 1, volume: 1, surface: 1 };
  var BOX_RATE = 0.5;                     // '하' 문항의 절반

  // ── 겨냥도(3D 형상)를 그대로 제시하는 6종 ──
  //   이 6종에만 capHiddenToOne + 위모양 동봉을 적용한다.
  //   ⚠ hidden(A-a~f)·minmax·manip 에는 절대 적용하지 않는다 —
  //     A-f 의 정답이 곧 '숨은 열의 자유도 곱'이라, 높이를 1 로 고정하면 정답이 항상 1이 된다.
  //     A-a/A-b 도 가림 자체가 문제의 대상이므로 손대면 안 된다.
  var ISO_TYPES = { count: 1, volume: 1, surface: 1, heightmap: 1, facesMc: 1, facesDraw: 1 };

  // ── 지면(worksheets 독립 생성) 적합도 ──
  //   위모양 동봉 후 6종은 3D 회전 없이 풀린다 → paper-safe.
  //   H-a/H-b 만 제외: '표시한 줄'이 빨강 색상뿐이라 흑백 인쇄에서 지시 대상이 사라진다.
  var PAPER_UNSAFE = { "manip:H-a": 1, "manip:H-b": 1 };

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
      .map(function (s) {
        return { id: s, grade: STAGES[s].grade, age: STAGES[s].age, dim: STAGES[s].dim,
                 note: STAGES[s].note || null };
      });
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

  // 지면(worksheets 독립 생성)에서 성립하는가.
  //   위모양 동봉 + 숨은 열 높이 1 규약으로 겨냥도 6종이 지면에서 풀리게 됐다.
  //   남은 예외는 H-a/H-b 뿐 — '표시한 줄'이 빨강 색상뿐이라 흑백 인쇄에서 지시 대상이 사라진다.
  //   ⚠ quiz 를 거쳐 만든 문제지는 이 게이트를 적용하지 않는다(QR·링크로 잇는다).
  function paperSafe(type, sub) {
    return !PAPER_UNSAFE[sub ? (type + ":" + sub) : type];
  }

  // ── facesDraw 출제 형식 (§4.8) ──
  //   모양이 1개면 위·앞·옆 세 면을 모두 그린다. 모양이 여러 개면 모양마다 한 면씩.
  //   여러 모양은 '같은 방향의 문항을 2~3개 연속 배치'로 구현한다 — 모양마다 따로 채점되므로
  //   하나를 틀려도 나머지가 살아남는다. bool 채점을 유지하면서 부담을 분산하는 장치다.
  var DRAW_FORM = {
    "하":   { views: 1, group: 2 },      // 모양 2개 × 각 한 면
    "중":   { views: 1, group: 3 },      // 모양 3개 × 각 한 면
    "상":   { views: 3, group: 1 },      // 모양 1개 × 세 면
    "최상": { views: 3, group: 1 }
  };
  function viewsFor(type, label) {
    if (type !== "facesDraw") return null;
    return (DRAW_FORM[label] || DRAW_FORM["상"]).views;
  }
  function groupFor(type, label) {
    if (type !== "facesDraw") return 1;
    return (DRAW_FORM[label] || DRAW_FORM["상"]).group;
  }

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

    // ── heightmap 은 축이 반대다: 칸 수(발자국)를 먼저 정하고 개수가 따라온다 ──
    if (type === "heightmap" && ax.foot) {
      var fCap = Math.min((ax.foot[stage] || ax.foot.S4)[label] || fHi, cells);
      f = Math.max(1, fCap);
      var mul = ax.hMul[label] || [1, 2];
      var nLo2 = Math.max(f, Math.round(f * mul[0])), nHi2 = Math.min(f * maxH, Math.round(f * mul[1]));
      if (nHi2 < nLo2) nHi2 = nLo2;
      n = clampInt(band(rng, nLo2, nHi2), nLo2, nHi2);
      lo = f; hi = f * maxH;                    // 개수 밴드는 느슨하게(칸 수가 1차 축이라)
    }
    return {
      gx: g.gx, gz: g.gz, maxH: maxH,
      fMin: f, fMax: f, nMin: n, nMax: n,          // genShape 계약 불변
      edge: pickEdge(ax.edge, label, rng),
      nBand: [lo, hi],                              // 재생성 후 밴드 준수 확인용
      box: !!(BOX_TYPES[type] && label === "하" && rng() < BOX_RATE),
      answerMax: ax.answerMax ? ax.answerMax[label] : null,
      concave: ax.concave ? ax.concave[label] : null,
      rugged: ax.rugged ? ax.rugged[label] : null,        // heightmap 굴곡 목표
      kinds: ax.kinds ? ax.kinds[label] : null,           // hidden A-f 가짓수 밴드
      hcolsMin: ax.hcolsMin ? ax.hcolsMin[label] : null,  // A-f 숨은 열 최소
      boxTotal: ax.boxTotal ? ax.boxTotal[label] : null,  // manip H-d 상자 총 개수
      cubeM: ax.cubeM ? Math.min(ax.cubeM[label], maxH) : null,   // manip H-c 목표 정육면체 한 변
      needBand: ax.needBand ? ax.needBand[label] : null,  // manip H-c 정답값 밴드
      views: viewsFor(type, label),                       // facesDraw 출제 형식
      group: groupFor(type, label),                       // 같은 방향을 몇 문항 연속으로
      // facesMc 에서 물을 수 있는 방향. null = 종전대로(gen 이 정한다).
      mcDirs: (ax.dirs && ax.dirs[stage]) ? ax.dirs[stage].slice() : null,
      flatten: !!STAGES[stage].flatten,             // S2·S3 는 가림 자체 금지
      // 겨냥도 6종만: 가림은 남기되 숨은 열 높이를 1 로 고정 → 위모양과 함께 주면 답이 유일해진다.
      //   ⚠ 위모양 동봉은 **capHidden 스테이지(S4·S5)에서만** 한다.
      //     S2·S3 은 flattenHidden 으로 가림이 아예 없어 겨냥도만으로 이미 결정적이라 불필요하고,
      //     무엇보다 위모양을 주면 top 을 물을 수 없게 되어 **S3 의 facesMc 가 위·앞·옆 전부를
      //     내지 못한다**(§7.9-2 확정 위반). 실제 인쇄 미리보기에서 이 충돌이 드러났다.
      capHidden: !!(STAGES[stage].capHidden && ISO_TYPES[type]),
      withTop: !!(STAGES[stage].capHidden && ISO_TYPES[type]),
      subs: subsFor(type, stage),
      _meta: { stage: stage, label: label, grid: b.grid, n: n, foot: f }
    };
  }

  var CFG = {
    VERSION: VERSION,
    GRID: GRID, ORDER: ORDER,
    STAGES: STAGES, STAGE_ORDER: STAGE_ORDER, DEFAULT_STAGE: DEFAULT_STAGE,
    BANDS: BANDS, GATE: GATE, TYPE_AXES: TYPE_AXES,
    stages: stages, typesFor: typesFor, subsFor: subsFor, paperSafe: paperSafe,
    support: support, resolveCfg: resolveCfg, normStage: normStage
  };
  global.CubeNest = global.CubeNest || {};
  global.CubeNest.genConfig = CFG;
  if (typeof module !== "undefined" && module.exports) module.exports = CFG;

})(typeof globalThis !== "undefined" ? globalThis : this);


// [서버 전용] ESM named export
export const genConfig = globalThis.CubeNest.genConfig;
