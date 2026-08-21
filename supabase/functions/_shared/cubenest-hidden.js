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

  // ── ambiguousEmpties: 나무가 '숨을 수 있는' 빈 칸 ──
  //   놓인 열이 다 보인다고 해서 겨냥도만으로 모양이 정해지는 것은 아니다.
  //   **비어 보이는 칸**에 1개짜리 나무가 있어도 그림이 똑같을 수 있기 때문이다.
  //   가림 규칙은 "(x+1,y+1,z+1) 이 차 있으면 안 보임" 이므로, 빈 칸 (x,z) 의 바닥 나무
  //   (y=0) 는 앞대각 (x+1,z+1) 이 **2층 이상**일 때 완전히 가려진다.
  //   → 그런 빈 칸이 하나라도 있으면 아이는 위에서 본 모양을 확정할 수 없다.
  //
  //   격자 크기를 안 받아도 된다: 높이 2 이상인 칸에서 뒤(x-1,z-1)로 한 칸 물러나 보므로
  //   결과 좌표는 항상 격자 안이다(x-1>=0, z-1>=0 만 확인하면 된다).
  function ambiguousEmpties(hmap) {
    var out = [], k, p, a, b;
    for (k in hmap) {
      if (!(hmap[k] >= 2)) continue;                 // 2층 이상만 뒤를 가릴 수 있다
      p = k.split(","); a = +p[0]; b = +p[1];
      if (a < 1 || b < 1) continue;                  // 뒤가 격자 밖이면 숨을 자리가 없다
      if (H(hmap, a - 1, b - 1) === 0) out.push([a - 1, b - 1]);
    }
    return out;
  }
  // 겨냥도만으로 모양이 유일한가 = 숨은 열도 없고, 나무가 숨을 빈 칸도 없다.
  //   겨냥도는 바닥 격자를 전부 그리므로 아이는 칸 위치를 안다 — 남은 불확실성은 이 둘뿐이다.
  function isDeterminate(hmap) { return !hasHidden(hmap) && ambiguousEmpties(hmap).length === 0; }

  // ── flattenHidden: 숨은 열이 하나도 없는 높이지도로 정리 (A-a '없음' 문항용) ──
  //   숨음 ⟺ h(x+1,z+1) > h(x,z) 이므로, 대각선 사슬 (x+t, z+t) 을 따라 높이가
  //   뒤로 갈수록 작거나 같으면 아무 열도 안 숨는다. 발자국은 그대로 두고 높이만 고쳐 그 조건을 만든다.
  //   mode='raise' 자기를 앞대각까지 올림(개수 증가, maxH 는 못 넘음)
  //   mode='lower' 앞대각을 자기까지 내림(개수 감소, 발자국 유지 위해 1 미만으로는 안 내려감)
  //   ※ 둘 다 필요하다. 한쪽만 쓰면 '없음' 문항만 개수가 치우쳐 새 힌트가 된다.
  function flattenHidden(hmap, mode) {
    var out = {}, k, i, x, z;
    for (k in hmap) out[k] = hmap[k];
    var fp = footprint(out);
    if (mode === 'lower') {
      // 사슬 앞쪽(x+z 작은 칸)부터: 자기 값이 확정된 뒤 앞대각을 끌어내린다.
      fp.sort(function (a, b) { return (a[0] + a[1]) - (b[0] + b[1]); });
      for (i = 0; i < fp.length; i++) {
        x = fp[i][0]; z = fp[i][1];
        var kf = (x + 1) + "," + (z + 1);
        if (out[kf] > out[x + "," + z]) out[kf] = out[x + "," + z];
      }
    } else {
      // 사슬 뒤쪽(x+z 큰 칸)부터: 앞대각이 이미 확정돼 한 번에 끝난다.
      fp.sort(function (a, b) { return (b[0] + b[1]) - (a[0] + a[1]); });
      for (i = 0; i < fp.length; i++) {
        x = fp[i][0]; z = fp[i][1];
        var D = H(out, x + 1, z + 1);
        if (D > out[x + "," + z]) out[x + "," + z] = D;
      }
    }
    return out;
  }

  // ── capHiddenToOne: 숨은 열의 높이를 1로 내린다 ──
  //   왜: 겨냥도 + 위에서 본 모양만으로 **개수가 유일하게 정해지게** 하려는 것이다.
  //   숨은 열은 그림에 안 보이므로 높이가 1..D-1 어디든 같은 겨냥도가 나온다(enumerateByVisible).
  //   교과·시중 문제집은 이 자유도를 "보이는 위 면 ≠ 위모양이면 그 자리에 1개 있다"는
  //   **규약으로 고정**한다 — 3종 문제집이 예외 없이 이 관행을 따른다.
  //
  //   flattenHidden 과 역할이 다르다:
  //     flattenHidden  = 가림 자체를 없앤다 → '안 보이는 나무' 개념이 사라진다(저학년용)
  //     capHiddenToOne = 가림은 남기고 높이만 1로 고정 → **개념은 살고 답은 유일해진다**
  //
  //   ⚠ 높이를 1 로 내려도 숨음은 유지된다(숨음 조건상 D ≥ 2 이므로 1 < D).
  //     자기 값이 내려가면서 뒤쪽 열(x-1,z-1)의 숨음이 풀릴 수는 있는데,
  //     그건 '덜 숨는' 방향이라 결정성을 해치지 않는다.
  function capHiddenToOne(hmap) {
    var out = {}, k, i;
    for (k in hmap) out[k] = hmap[k];
    // 사슬 뒤쪽(x+z 큰 칸)부터 훑어야 앞대각이 확정된 뒤 자기 숨음을 판정한다.
    var fp = footprint(out).sort(function (a, b) { return (b[0] + b[1]) - (a[0] + a[1]); });
    for (i = 0; i < fp.length; i++) {
      var x = fp[i][0], z = fp[i][1];
      if (H(out, x + 1, z + 1) > out[x + "," + z]) out[x + "," + z] = 1;
    }
    return out;
  }

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
    hiddenColumns: hiddenColumns, hasHidden: hasHidden, flattenHidden: flattenHidden,
    ambiguousEmpties: ambiguousEmpties, isDeterminate: isDeterminate,
    capHiddenToOne: capHiddenToOne,
    layersToShape: layersToShape, layersCount: layersCount,
    enumerateByVisible: enumerateByVisible
  };
  global.CubeNest = global.CubeNest || {};
  global.CubeNest.hidden = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;

})(typeof globalThis !== "undefined" ? globalThis : this);


// [서버 전용] ESM named export
export const hidden = globalThis.CubeNest.hidden;
