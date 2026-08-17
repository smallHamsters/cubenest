/*!
 * cubenest-iso.js — 겨냥도(아이소메트릭) SVG 렌더러 (마스터 §4.3 투상의 그림 표현)
 * 버전: 0.1.0  ·  의존성 없음(순수 문자열 생성, DOM/Three 불필요)
 *
 * 목적: quiz/run 이 인라인으로 갖고 있던 renderIso 를 공용 모듈로 승격한다.
 *       서버(Edge Function)도 같은 그림을 그려야 하기 때문 —
 *       '안 보이는 나무' A-a/b/f 는 겨냥도에 안 보이는 것이 문제의 전제라
 *       클라에 모양을 내려보내면 전제가 깨진다. 서버가 이 모듈로 SVG 를 그려 내려보낸다.
 *       (core·gen·hidden 과 같은 방식으로 supabase/functions/_shared/ 에 서버 복본을 둔다.)
 *
 * 좌표: 위=+y, 앞=+z, 옆(오른쪽)=+x. 셀 = {x,y,z}.
 * 모양: sh = { gx, gz, cells:[{x,y,z}...] }   (hmap·maxH·edge 는 필요 없다)
 *
 * API:
 *   rot(p, k, gx, gz) → 90°×k 회전한 셀
 *   renderIso(sh, k, hiSet) → SVG 문자열
 *     · k = 0..3 (90° 단위 회전)
 *     · hiSet = Set<"x,y,z">|null. 주면 그 칸은 빨강으로, 나머지는 흐리게(해설용 강조).
 *
 * ※ 그리는 순서가 곧 은닉이다: 셀을 (x+z) 오름차순 = 뒤→앞으로 칠하므로(painter's algorithm)
 *   앞대각이 더 높은 열은 자연히 가려진다. 이 정렬을 바꾸면 숨은 나무가 드러난다.
 */
(function (global) {
  'use strict';

  var VERSION = '0.1.0';

  function rot(p, k, gx, gz) {
    var x = p.x, y = p.y, z = p.z;
    if (k === 1) return { x: gz - 1 - z, y: y, z: x };
    if (k === 2) return { x: gx - 1 - x, y: y, z: gz - 1 - z };
    if (k === 3) return { x: z, y: y, z: gx - 1 - x };
    return { x: x, y: y, z: z };
  }

  function renderIso(sh, k, hiSet) {
    k = k || 0;
    var a = 20, b = 10, c = 24;
    var ghost = !!hiSet;
    var cells = sh.cells.map(function (p) { return rot(p, k, sh.gx, sh.gz); });
    cells.sort(function (p, q) { return (p.x + p.z) - (q.x + q.z) || p.y - q.y; });  // 뒤→앞(가림 성립)
    var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    var PT = function (x, y, z) {
      var X = a * (x - z), Y = b * (x + z) - c * y;
      if (X < minX) minX = X; if (X > maxX) maxX = X;
      if (Y < minY) minY = Y; if (Y > maxY) maxY = Y;
      return [X, Y];
    };
    var P = function (x, y, z) { var t = PT(x, y, z); return t[0] + ',' + t[1]; };

    // 바닥 격자(회전된 발자국) — 기준 평면
    var g2gx = (k % 2 === 1) ? sh.gz : sh.gx, g2gz = (k % 2 === 1) ? sh.gx : sh.gz;
    var grid = '', i, j, A, B;
    for (i = 0; i <= g2gx; i++) { A = PT(i, 0, 0); B = PT(i, 0, g2gz); grid += '<line x1="' + A[0] + '" y1="' + A[1] + '" x2="' + B[0] + '" y2="' + B[1] + '" stroke="#c3ccda" stroke-width="1"/>'; }
    for (j = 0; j <= g2gz; j++) { A = PT(0, 0, j); B = PT(g2gx, 0, j); grid += '<line x1="' + A[0] + '" y1="' + A[1] + '" x2="' + B[0] + '" y2="' + B[1] + '" stroke="#c3ccda" stroke-width="1"/>'; }
    var q0 = PT(0, 0, 0), q1 = PT(g2gx, 0, 0), q2 = PT(g2gx, 0, g2gz), q3 = PT(0, 0, g2gz);
    grid += '<polygon points="' + q0.join(',') + ' ' + q1.join(',') + ' ' + q2.join(',') + ' ' + q3.join(',') + '" fill="none" stroke="#8a95a6" stroke-width="1.8" stroke-linejoin="round"/>';

    // 큐브 — 공통 stroke 속성은 <g> 로 올리고, 기본값과 같은 속성은 아예 쓰지 않는다.
    //   그리는 결과는 동일하고(SVG 속성 상속) 문자열만 40% 가까이 줄어든다.
    //   서버가 이 SVG 를 문항마다 내려보내므로 페이로드에 그대로 반영된다.
    var poly = '';
    for (var n = 0; n < cells.length; n++) {
      var x = cells[n].x, y = cells[n].y, z = cells[n].z;
      var top = P(x, y + 1, z) + ' ' + P(x + 1, y + 1, z) + ' ' + P(x + 1, y + 1, z + 1) + ' ' + P(x, y + 1, z + 1);
      var left = P(x, y, z + 1) + ' ' + P(x + 1, y, z + 1) + ' ' + P(x + 1, y + 1, z + 1) + ' ' + P(x, y + 1, z + 1);
      var right = P(x + 1, y, z) + ' ' + P(x + 1, y, z + 1) + ' ' + P(x + 1, y + 1, z + 1) + ' ' + P(x + 1, y + 1, z);
      var hi = ghost && hiSet.has(x + ',' + y + ',' + z);
      var op = (ghost && !hi) ? ' fill-opacity=".28"' : '';
      var st = hi ? ' stroke="#7c1f2c"' : '';
      var cL = hi ? '#d84a5e' : '#d8a76e', cR = hi ? '#b83346' : '#c8965a', cT = hi ? '#ef7f8e' : '#e6c9a0';
      poly += '<polygon points="' + left + '" fill="' + cL + '"' + op + st + '/>'
            + '<polygon points="' + right + '" fill="' + cR + '"' + op + st + '/>'
            + '<polygon points="' + top + '" fill="' + cT + '"' + op + st + '/>';
    }
    poly = '<g stroke="#9c6b30" stroke-width="1" stroke-linejoin="round">' + poly + '</g>';

    // 위·앞·옆 라벨 — 회전과 함께 이동(원본 축 방향을 회전·투영)
    var ccx = (sh.gx - 1) / 2, ccz = (sh.gz - 1) / 2;
    var proj = function (X, Y, Z) { return [a * (X - Z), b * (X + Z) - c * Y]; };
    var axisDir = function (dx, dz) {
      var C = rot({ x: ccx, y: 0, z: ccz }, k, sh.gx, sh.gz), Ap = rot({ x: ccx + dx, y: 0, z: ccz + dz }, k, sh.gx, sh.gz);
      var pc = proj(C.x, C.y, C.z), pa = proj(Ap.x, Ap.y, Ap.z);
      var vx = pa[0] - pc[0], vy = pa[1] - pc[1], m = Math.hypot(vx, vy) || 1;
      return [vx / m, vy / m];
    };
    var cX = (minX + maxX) / 2, cY = (minY + maxY) / 2, R = Math.max(maxX - minX, maxY - minY) / 2 + 12;
    var sD = axisDir(1, 0), fD = axisDir(0, 1);
    var lab = function (x, y, t, col) {
      return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" fill="' + col + '" font-size="13" font-weight="800" text-anchor="middle" dominant-baseline="central" paint-order="stroke" stroke="#fff" stroke-width="3.5" stroke-linejoin="round">' + t + '</text>';
    };
    var labels = lab(cX, minY - 12, '위', '#3f8fd0') + lab(cX + fD[0] * R, cY + fD[1] * R, '앞', '#4fae72') + lab(cX + sD[0] * R, cY + sD[1] * R, '옆', '#d0546f');

    var pad = 30, w = (maxX - minX) + pad * 2, h = (maxY - minY) + pad * 2;
    return '<svg viewBox="' + (minX - pad) + ' ' + (minY - pad) + ' ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg">' + grid + poly + labels + '</svg>';
  }

  var iso = { VERSION: VERSION, rot: rot, renderIso: renderIso };
  global.CubeNest = global.CubeNest || {};
  global.CubeNest.iso = iso;
  if (typeof module !== 'undefined' && module.exports) module.exports = iso;

})(typeof globalThis !== 'undefined' ? globalThis : this);


// [서버 전용] ESM named export
export const iso = globalThis.CubeNest.iso;
