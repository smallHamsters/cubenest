/* ============================================================================
 * CubeNest gen-config (3축) — 난이도 라벨 ⟂ 격자 스케일 ⟂ 유형 고유축
 *   리매핑 v0.5 §2 반영. genShape/genProblem은 불변; 이 모듈이 cfg를 만들어 준다.
 *   축: ① difficulty(하/중/상/최상) ② gridScale(S/M/L, XL/XXL 나중) ③ perType
 *   서버 전용(생성기). UMD(node require + 브라우저 전역).
 * ==========================================================================*/
(function (global) {
  var VERSION = "cfg-0.2.0";

  // ── ② 격자 스케일 (독립 축). 경시 XL/XXL은 값만 추가하면 됨. ──
  var GRID = {
    S: { gx: 3, gz: 3, maxH: 3 },
    M: { gx: 4, gz: 4, maxH: 4 },
    L: { gx: 5, gz: 5, maxH: 5 },
    // XL: { gx: 7, gz: 7, maxH: 7 },  XXL: { gx: 10, gz: 10, maxH: 10 }  // 나중(경시 모드)
  };

  // ── 밀도 라벨 → footprint 비율 × 열높이 비율 (U자의 위치) ──
  //   full=꽉참(규칙적·쉬움) / mid=중간(불규칙·가림·제일어려움) / sparse=듬성(개수적음)
  var DENS = {
    full:   { footFrac: [0.85, 1.0], colFrac: [0.80, 1.0] },
    mid:    { footFrac: [0.55, 0.8], colFrac: [0.45, 0.7] },
    sparse: { footFrac: [0.40, 0.6], colFrac: [0.30, 0.5] },
    any:    null  // full|mid|sparse 중 랜덤
  };

  // ── ③ 유형별 등급 프리셋: 등급 → 허용 (grid, density[, edge]) 조합 집합 ──
  //   생성 시 이 중 하나를 rng로 선택. (리매핑 v0.5 §2.3)
  var PRESETS = {
    // B count 개수 (더하기만 → 하~중). 하=작은판 or 큰판이라도 듬성/꽉참.
    count: {
      "하": [["S", "any"], ["M", "sparse"], ["M", "full"], ["L", "sparse"], ["L", "full"]],
      "중": [["S", "mid"], ["M", "mid"], ["L", "mid"]]
    },
    // B volume 부피 (개수+edge곱 → 하~상).
    volume: {
      "하": [["S", "any", 1]],
      "중": [["S", "mid", [1, 3]], ["S", "full", [1, 3]], ["M", "any", [1, 3]]],
      "상": [["M", "mid", [2, 3]], ["M", "full", [2, 3]], ["L", "mid", [2, 3]], ["L", "full", [2, 3]]]
    },
    // B surface 겉넓이 (오목판정+(위+앞+옆)×2 → 하~최상). concave는 genProblem이 label로 밴딩.
    surface: {
      "하":   [["S", "any", 1]],
      "중":   [["S", "mid", [1, 2]], ["M", "sparse", [1, 2]]],
      "상":   [["M", "mid", [2, 3]]],
      "최상": [["L", "mid", [2, 3]]]
    },
    // C heightmap 위수 (하~최상).
    heightmap: {
      "하":   [["S", "any"], ["M", "full"]],
      "중":   [["S", "mid"], ["M", "mid"]],
      "상":   [["M", "mid"], ["L", "sparse"]],
      "최상": [["L", "mid"]]
    },
    // D facesMc 방향 고르기 (하~최상).
    facesMc: {
      "하":   [["S", "any"], ["M", "full"]],
      "중":   [["S", "mid"], ["M", "mid"]],
      "상":   [["M", "mid"], ["L", "sparse"]],
      "최상": [["L", "mid"]]
    },
    // D facesDraw 삼면 그리기 (하~상; 최상 미지원=L 그리기 부담).
    facesDraw: {
      "하": [["S", "mid"]],
      "중": [["M", "mid"]],
      "상": [["M", "mid"], ["L", "sparse"]]
    },
    // G minmax 최대최소 (중~최상; 하 미지원). 밀도 듬성쪽(자유도↑). 폭은 genProblem이 rc로 보장.
    minmax: {
      "중":   [["M", "sparse"]],
      "상":   [["M", "sparse"], ["L", "sparse"]],
      "최상": [["L", "sparse"]]
    },
    // A hidden (중~최상; 하 미지원). 중간밀도+높이 있어야 가림 생김. (A-a~f 신설 전 잠정)
    hidden: {
      "중":   [["S", "mid"], ["M", "mid"]],
      "상":   [["M", "mid"]],
      "최상": [["L", "mid"]]
    }
  };

  // ── 지원 등급(랜딩 카드 levels 표시) = PRESETS 키 순서. 계산복잡도가 최대등급 결정. ──
  var ORDER = ["하", "중", "상", "최상"];
  function support(type) {
    var p = PRESETS[type] || {};
    return ORDER.filter(function (l) { return p[l]; });
  }

  // ── 헬퍼 ──
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
  function band(rng, lo, hi) { return lo + (hi - lo) * rng(); }
  function clampInt(v, lo, hi) { return Math.max(lo, Math.min(hi, Math.round(v))); }

  // ── resolveCfg: (type, label, rng) → genShape가 먹는 cfg + meta ──
  function resolveCfg(type, label, rng) {
    var byLabel = (PRESETS[type] || {})[label];
    if (!byLabel) {                       // 미지원 등급 → 가장 가까운 지원 등급으로
      var sup = support(type); label = sup[sup.length - 1] || "중"; byLabel = PRESETS[type][label];
    }
    var combo = pick(rng, byLabel);       // [gridKey, densKey, edge?]
    var gridKey = combo[0], densKey = combo[1], edgeSpec = combo[2];
    var g = GRID[gridKey] || GRID.S;
    var d = DENS[densKey] || (densKey === "any" ? DENS[pick(rng, ["full", "mid", "sparse"])] : DENS.mid);
    if (densKey === "any") d = DENS[pick(rng, ["full", "mid", "sparse"])];

    var cells = g.gx * g.gz;
    var f = clampInt(band(rng, d.footFrac[0], d.footFrac[1]) * cells, 1, cells);
    var fMin = Math.max(1, f - 1), fMax = Math.min(cells, f + 1);
    // 총 개수 = footprint × maxH × colFrac
    var nMid = band(rng, d.colFrac[0], d.colFrac[1]) * f * g.maxH;
    var nMin = clampInt(nMid * 0.85, f, f * g.maxH);
    var nMax = clampInt(nMid * 1.15, nMin, f * g.maxH);

    // edge(모서리 길이): volume/surface만 의미. 스펙 없으면 1.
    var edge = 1;
    if (edgeSpec === undefined) edge = 1;
    else if (typeof edgeSpec === "number") edge = edgeSpec;
    else if (edgeSpec && edgeSpec.length === 2) edge = clampInt(band(rng, edgeSpec[0], edgeSpec[1]), edgeSpec[0], edgeSpec[1]);

    return {
      gx: g.gx, gz: g.gz, maxH: g.maxH, edge: edge,
      fMin: fMin, fMax: fMax, nMin: nMin, nMax: nMax,
      _meta: { grid: gridKey, density: densKey, label: label }
    };
  }

  var CFG = {
    VERSION: VERSION, GRID: GRID, DENS: DENS, PRESETS: PRESETS, ORDER: ORDER,
    support: support, resolveCfg: resolveCfg
  };
  global.CubeNest = global.CubeNest || {};
  global.CubeNest.genConfig = CFG;
  if (typeof module !== "undefined" && module.exports) module.exports = CFG;

})(typeof globalThis !== "undefined" ? globalThis : this);


// [서버 전용] ESM named export
export const genConfig = globalThis.CubeNest.genConfig;
