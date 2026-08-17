/* ============================================================================
 * CubeNest hidden — "안 보이는 나무" 6종(A-a~f) 핵심 계산
 *   설계: cubenest_hidden_types_260816_v0_2.md · 교과서 70쪽 1·2번 검증.
 *   isomorphic(서버 채점 + 클라 해설 공용). UMD(node require + 브라우저 전역).
 *   좌표: 위=+y, 앞=+z, 옆=+x. heightMap = {"x,z": 높이}.
 *   [불변 규칙] visibleTop = {(x,z)∈footprint : h(x+1,z+1) < h(x,z)}.
 *              숨은 나무(hidden) = footprint − visibleTop.
 *   재사용(core): heightMap·reverseCounts·reverseShapes (여기선 계산 안 함).
 * ==========================================================================*/
(function (global) {
  "use strict";

  // hmap: {"x,z": h}. H(x,z)=격자 밖·빈칸이면 0.
  function H(hmap, x, z) { var v = hmap[x + "," + z]; return v ? v : 0; }

  // footprint = 높이≥1인 열 (x,z) 목록
  function footprint(hmap) {
    var out = [];
    for (var k in hmap) { if (hmap[k] > 0) { var p = k.split(","); out.push([+p[0], +p[1]]); } }
    return out;
  }

  // ── visibleTopFootprint: 겨냥도(고정시점)에서 윗면이 보이는 열 집합 ──
  //   (x,z)의 top은 앞대각(x+1,z+1)이 h(x,z)보다 '더 높을 때만' 가려짐. 동일높이=보임.
  function visibleTopFootprint(hmap) {
    var vis = [];
    var fp = footprint(hmap);
    for (var i = 0; i < fp.length; i++) {
      var x = fp[i][0], z = fp[i][1];
      if (H(hmap, x + 1, z + 1) <= H(hmap, x, z)) vis.push([x, z]); // 동일높이는 보임(<=)
    }
    return vis;
  }

  // ── hiddenColumns: 숨은 나무 열 = footprint − visibleTop ──
  function hiddenColumns(hmap) {
    var visSet = {}; visibleTopFootprint(hmap).forEach(function (c) { visSet[c[0] + "," + c[1]] = 1; });
    return footprint(hmap).filter(function (c) { return !visSet[c[0] + "," + c[1]]; });
  }
  function hasHidden(hmap) { return hiddenColumns(hmap).length > 0; }

  // ── layersToShape: 층별 모양 → 셀 배열 ──
  //   layers = [ Set<"x,z">|Array<[x,z]> , ... ] (index 0 = 1층). 중력 준수(아래층 포함 가정).
  //   반환 cells = [[x,y,z]...] (y=0 바닥).
  function layersToShape(layers) {
    var cells = [];
    for (var y = 0; y < layers.length; y++) {
      var lyr = layers[y]; if (!lyr) continue;
      var arr = (lyr instanceof Set) ? Array.from(lyr) : lyr;
      for (var i = 0; i < arr.length; i++) {
        var c = arr[i];
        if (typeof c === "string") { var p = c.split(","); cells.push([+p[0], y, +p[1]]); }
        else cells.push([c[0], y, c[1]]);
      }
    }
    return cells;
  }
  function layersCount(layers) { var n = 0; for (var y = 0; y < layers.length; y++){ var l=layers[y]; if(!l)continue; n += (l instanceof Set)?l.size:l.length; } return n; }

  // ── enumerateByVisible: 겨냥도(보이는 높이)+위모양 만족 완성형 가짓수 (A-f) ──
  //   숨은 열 (x,z)의 높이 t는 1..(D-1)까지(t<D=앞대각이어야 숨음 유지). 가짓수 = Π(D-1).
  //   ⚠ 반환값은 '정확한 가짓수'다. 예전엔 prod>=cap 일 때 cap 을 돌려줘서
  //     실제 9·12·216가지인 문제의 정답이 6으로 잘려 나갔다(오답 출제). cap 은 이제
  //     '초과 여부'만 알리는 조기 종료 한계선이고, 넘으면 Infinity(=cap보다 많음)를 반환한다.
  //     Infinity 를 정답값으로 쓰면 안 된다 — 정확값이 필요하면 cap 없이 호출한다.
  var MAX_SAFE = 9007199254740991;
  function enumerateByVisible(hmap, cap) {
    var hid = hiddenColumns(hmap), prod = 1;
    for (var i = 0; i < hid.length; i++) {
      var x = hid[i][0], z = hid[i][1];
      var D = H(hmap, x + 1, z + 1);                  // 앞대각 높이(숨음 조건상 D >= h+1 >= 2)
      var freedom = D - 1; if (freedom < 1) freedom = 1;  // 숨음 유지 높이 t∈[1,D-1]
      prod *= freedom;
      if (cap != null && prod > cap) return Infinity; // "cap 초과" 신호(정답값 아님)
      if (prod > MAX_SAFE) return Infinity;           // 안전 정수 범위 초과(경시 XL 격자 대비)
    }
    return prod;
  }

  var API = {
    H: H, footprint: footprint,
    visibleTopFootprint: visibleTopFootprint,
    hiddenColumns: hiddenColumns, hasHidden: hasHidden,
    layersToShape: layersToShape, layersCount: layersCount,
    enumerateByVisible: enumerateByVisible
  };
  global.CubeNest = global.CubeNest || {};
  global.CubeNest.hidden = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;

})(typeof globalThis !== "undefined" ? globalThis : this);


// [서버 전용] ESM named export
export const hidden = globalThis.CubeNest.hidden;
