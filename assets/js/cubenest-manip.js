/* ============================================================================
 * CubeNest manip — H군(조작) 계산  H-a 더쌓기 · H-b 빼기 · H-c 정육면체 완성 · H-d 색칠
 *   유형지도 v0.3 §H(파워유형 유형8·12 공식 확정) · G·H 인수인계서 §3
 *   isomorphic(서버 채점 + 클라 해설 공용). UMD(node require + 브라우저 전역).
 *   좌표: 위=+y, 앞=+z, 옆=+x. heightMap = {"x,z": 높이}.
 * ==========================================================================*/
(function (global) {
  'use strict';

  var VERSION = '0.1.0';

  // ── 실제로 점유한 범위 ──
  //   ⚠ 격자(gx·gz·maxH)가 아니라 '채워진 칸'의 범위를 쓴다.
  //     모양이 격자를 다 채우지 않으면 두 값이 달라지고, 그때 격자를 쓰면 정육면체가 커진다.
  function extents(hmap) {
    var x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, h = 0, count = 0, foot = 0, k, p, v;
    for (k in hmap) {
      v = hmap[k]; if (!(v > 0)) continue;
      p = k.split(','); var x = +p[0], z = +p[1];
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (z < z0) z0 = z; if (z > z1) z1 = z;
      if (v > h) h = v;
      count += v; foot++;
    }
    if (!foot) return { x0: 0, x1: -1, z0: 0, z1: -1, h: 0, count: 0, foot: 0, spanX: 0, spanZ: 0 };
    return { x0: x0, x1: x1, z0: z0, z1: z1, h: h, count: count, foot: foot, spanX: x1 - x0 + 1, spanZ: z1 - z0 + 1 };
  }

  // ── H-c: 정육면체 완성 ──
  //   파워유형 유형8 확정 공식: 더 필요한 수 = 최소 정육면체 개수 − 현재 개수.
  //   m 미지정 시 '모양을 감싸는 가장 작은 정육면체'의 한 변 = max(가로, 세로, 높이).
  //   m 을 주면 "한 변이 m 인 정육면체" 변형(문제집에 둘 다 있다).
  function completeCube(hmap, m) {
    var e = extents(hmap);
    var side = (m != null) ? m : Math.max(e.spanX, e.spanZ, e.h);
    if (side < 1) side = 1;
    var total = side * side * side;
    return { m: side, total: total, count: e.count, need: total - e.count };
  }

  // ── H-d: 색칠한 정육면체 ──
  //   한 변 n 인 정육면체를 쌓아 겉면을 전부 색칠한 뒤 낱개로 떼어냈을 때,
  //   정확히 k 면이 색칠된 나무의 수. (꼭짓점3 · 모서리2 · 면1 · 속0)
  //   합 = 8 + 12(n−2) + 6(n−2)² + (n−2)³ = n³.  ※ n=2 는 전부 3면이라 출제 제외.
  function paintedCubeCount(n, k) {
    var t = n - 2;
    if (k === 3) return 8;
    if (k === 2) return 12 * t;
    if (k === 1) return 6 * t * t;
    if (k === 0) return t * t * t;
    return 0;
  }
  function paintedCubeAll(n) { return [0, 1, 2, 3].map(function (k) { return paintedCubeCount(n, k); }); }

  // 한 변 n 인 꽉 찬 정육면체의 높이지도(렌더·채점용)
  function solidCubeHmap(n) {
    var hm = {}, x, z;
    for (x = 0; x < n; x++) for (z = 0; z < n; z++) hm[x + ',' + z] = n;
    return hm;
  }

  // ── H-a/H-b: 열 단위 조작 ──
  //   우리 모델이 높이지도라 '빼면 위 큐브가 떨어지는' 문제가 없다 — 열 높이를 ±k 하면 끝.
  //   delta<0 로 높이가 0 이 되면 그 열은 발자국에서 사라진다(연결이 끊길 수 있다 → footConnected 로 확인).
  function applyDelta(hmap, key, delta) {
    var out = {}, k;
    for (k in hmap) out[k] = hmap[k];
    var v = (out[key] || 0) + delta;
    if (v <= 0) delete out[key]; else out[key] = v;
    return out;
  }

  // 발자국이 한 덩이인가(마스터 §4: 연결된 모양만 출제)
  function footConnected(hmap) {
    var cells = [], k;
    for (k in hmap) if (hmap[k] > 0) cells.push(k);
    if (cells.length <= 1) return true;
    var set = {}, i;
    for (i = 0; i < cells.length; i++) set[cells[i]] = 1;
    var seen = {}, q = [cells[0]], n = 0;
    seen[cells[0]] = 1;
    while (q.length) {
      var p = q.pop().split(','), x = +p[0], z = +p[1]; n++;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var kk = (x + d[0]) + ',' + (z + d[1]);
        if (set[kk] && !seen[kk]) { seen[kk] = 1; q.push(kk); }
      });
    }
    return n === cells.length;
  }

  // 삼면도 지문 — 발자국 + 앞높이(x별 최대) + 옆높이(z별 최대).
  //   '조작 후 삼면도 그리기'는 조작으로 삼면도가 **실제로 바뀌어야** 문제가 성립한다.
  //   가장 높지 않은 열을 건드리면 실루엣이 그대로라 답이 원본과 같아진다.
  function viewSig(hmap) {
    var front = {}, side = {}, foot = [], k, p, v, x, z;
    for (k in hmap) {
      v = hmap[k]; if (!(v > 0)) continue;
      p = k.split(','); x = +p[0]; z = +p[1];
      if (!(x in front) || v > front[x]) front[x] = v;
      if (!(z in side) || v > side[z]) side[z] = v;
      foot.push(k);
    }
    foot.sort();
    return foot.join(' ') + '|' + JSON.stringify(front) + '|' + JSON.stringify(side);
  }

  // 조작 후보 열거 — 조작이 가능하고, 결과가 연결돼 있고, 삼면도가 달라지는 (열, 변화량) 전부.
  //   add=true 면 +1..(maxH−h), false 면 −1..−h.
  function opCandidates(hmap, maxH, add) {
    var keys = [], k, out = [];
    for (k in hmap) if (hmap[k] > 0) keys.push(k);
    keys.sort();
    var sig0 = viewSig(hmap);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i], h0 = hmap[key], lim = add ? (maxH - h0) : h0;
      for (var d = 1; d <= lim; d++) {
        var next = applyDelta(hmap, key, add ? d : -d), any = false, q;
        for (q in next) if (next[q] > 0) { any = true; break; }
        if (!any) continue;                       // 모양이 통째로 사라지면 안 됨
        if (!footConnected(next)) continue;       // 발자국이 두 덩이로 끊기면 안 됨(마스터 §4)
        if (viewSig(next) === sig0) continue;     // 삼면도가 그대로면 문제가 안 됨
        out.push([key, add ? d : -d]);
      }
    }
    return out;
  }

  var API = {
    VERSION: VERSION, viewSig: viewSig, opCandidates: opCandidates,
    extents: extents,
    completeCube: completeCube,
    paintedCubeCount: paintedCubeCount, paintedCubeAll: paintedCubeAll, solidCubeHmap: solidCubeHmap,
    applyDelta: applyDelta, footConnected: footConnected
  };
  global.CubeNest = global.CubeNest || {};
  global.CubeNest.manip = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

})(typeof globalThis !== 'undefined' ? globalThis : this);
