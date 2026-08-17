/* ============================================================================
 * CubeNest minmax — G군(최대·최소) 확장 계산  G-b · G-c
 *   유형지도 v0.3 §G · G·H 인수인계서 §2 · 마스터 §4.4(역방향)
 *   isomorphic(서버 채점 + 클라 해설 공용). UMD(node require + 브라우저 전역).
 *   좌표: 위=+y, 앞=+z, 옆=+x. heightMap = {"x,z": 높이}.
 *
 *   G-a(삼면도 최대·최소)는 core.reverseCounts 가 이미 담당한다. 여기는 그 확장:
 *   G-b = 위모양 + '한 방향' 실루엣만 주어질 때의 최소·최대
 *   G-c = "n층 이상"인 열의 개수
 * ==========================================================================*/
(function (global) {
  'use strict';

  var VERSION = '0.1.0';

  // ── 발자국을 축별로 묶는다 ──
  //   dir='front' → 앞에서 보므로 x 로 묶고 실루엣 높이 = 그 x 열들의 최댓값
  //   dir='side'  → 옆에서 보므로 z 로 묶는다 (완전 대칭)
  function groupByAxis(hmap, dir) {
    var g = {}, k, p, key;
    for (k in hmap) {
      if (!(hmap[k] > 0)) continue;
      p = k.split(',');
      key = (dir === 'side') ? p[1] : p[0];
      if (!g[key]) g[key] = { n: 0, sil: 0 };
      g[key].n++;                                       // 그 줄의 발자국 칸 수
      if (hmap[k] > g[key].sil) g[key].sil = hmap[k];    // 그 줄의 실루엣 높이
    }
    return g;
  }

  // ── G-b: 위모양(발자국) + 한 방향 실루엣 → 최소·최대 ──
  //   최대: 모든 칸을 그 줄의 실루엣 높이까지 채운다(실루엣을 넘지 않으니 항상 유효).
  //         max = Σ sil[a] × n[a]
  //   최소: 줄마다 '한 칸만' 실루엣 높이에 닿게 하고 나머지는 1(발자국이라 최소 1).
  //         min = Σ (sil[a] + n[a] − 1)
  //   ※ 브루트포스(모든 유효 배치 전수 탐색)와 대조 검증 완료.
  function minmaxFromTopAndSil(hmap, dir) {
    var g = groupByAxis(hmap, dir), a, min = 0, max = 0, foot = 0;
    for (a in g) {
      max += g[a].sil * g[a].n;
      min += g[a].sil + g[a].n - 1;
      foot += g[a].n;
    }
    return { minCount: min, maxCount: max, hidden: max - min, footprint: foot };
  }

  // 폭(max−min)이 생기는 조건: 어떤 줄이 '높이 ≥2 이면서 칸 ≥2' 여야 한다.
  //   max−min = Σ (sil[a]−1)(n[a]−1) 이므로 그런 줄이 하나도 없으면 정답이 하나로 고정돼
  //   '최대·최소' 문제가 성립하지 않는다.
  function hasRange(hmap, dir) {
    var g = groupByAxis(hmap, dir), a;
    for (a in g) if (g[a].sil >= 2 && g[a].n >= 2) return true;
    return false;
  }

  // ── G-c: "n층 이상"인 열의 개수 ──
  //   파워유형 유형9 확정 공식: 층 개수 = 위모양에서 n 이상인 칸 수.
  function countAtLeast(hmap, n) {
    var c = 0, k;
    for (k in hmap) if (hmap[k] >= n) c++;
    return c;
  }
  // 조건을 만족하는 n 후보(답이 1 이상이고 전부는 아닌 것) — 문제가 자명해지지 않게.
  function levelChoices(hmap, maxH) {
    var foot = 0, k, out = [], n;
    for (k in hmap) if (hmap[k] > 0) foot++;
    for (n = 2; n <= maxH; n++) {
      var c = countAtLeast(hmap, n);
      if (c >= 1 && c < foot) out.push(n);
    }
    return out;
  }

  var API = {
    VERSION: VERSION,
    groupByAxis: groupByAxis,
    minmaxFromTopAndSil: minmaxFromTopAndSil,
    hasRange: hasRange,
    countAtLeast: countAtLeast,
    levelChoices: levelChoices
  };
  global.CubeNest = global.CubeNest || {};
  global.CubeNest.minmax = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

})(typeof globalThis !== 'undefined' ? globalThis : this);


// [서버 전용] ESM named export
export const minmax = globalThis.CubeNest.minmax;
