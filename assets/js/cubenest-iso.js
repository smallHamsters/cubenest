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
 * ※ 은닉은 **정렬 + 오클루전 컬링** 둘이다(260831).
 *   · 정렬: 셀을 (x+z) 오름차순 = 뒤→앞으로 칠한다(painter's algorithm). 겹치는 면의
 *     앞뒤 관계를 정하므로 여전히 필요하다 — 이 정렬을 바꾸면 그림이 깨진다.
 *   · 컬링: 가려지는 큐브·면은 **폴리곤을 아예 만들지 않는다.** 정렬만 있던 시절엔
 *     안 보이는 나무의 폴리곤이 페이로드에 그대로 남아, <polygon 개수와 좌표 역산으로
 *     형상이 통째로 복원됐다(실측). 서버가 sh 대신 이 SVG 만 내려보내는 유형(A-a/b/f·2D)의
 *     은닉이 거기서 무너졌다. 이제 페이로드가 화면과 같다.
 */
(function (global) {
  'use strict';

  var VERSION = '0.2.0';

  function rot(p, k, gx, gz) {
    var x = p.x, y = p.y, z = p.z;
    if (k === 1) return { x: gz - 1 - z, y: y, z: x };
    if (k === 2) return { x: gx - 1 - x, y: y, z: gz - 1 - z };
    if (k === 3) return { x: z, y: y, z: gx - 1 - x };
    return { x: x, y: y, z: z };
  }

  //   opts.ghost=false → hiSet 을 '강조'로만 쓰고 나머지를 흐리게 하지 않는다(문제의 표시 열용).
  //   opts.paint      → 큐브 색을 통째로 바꾼다(H-d 색칠한 정육면체용).
  function renderIso(sh, k, hiSet, opts) {
    k = k || 0; opts = opts || {};
    var a = 20, b = 10, c = 24;
    var ghost = !!hiSet && opts.ghost !== false;
    var paint = opts.paint || null;
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
    /* 오클루전 컬링(260831) — 화면에 안 보이는 것은 **폴리곤을 만들지 않는다.**
       종전엔 정렬(뒤→앞)로 덮어 그리기만 해서 가려진 나무의 폴리곤이 페이로드에 남았다.
       서버가 '안 보이는 나무'(A-a/b/f)와 2D 모드에서 sh 대신 이 SVG 만 내려보내는데,
       그 SVG 에서 <polygon 개수로 나무 수가 나오고((P-1)/3), PT() 가 결정적이라
       좌표를 역산해 **형상 전체가 복원됐다**(라이브 6문항 6개 전부 복원, 260831).
       = 화면상의 은닉이지 페이로드상의 은닉이 아니었다. 이제 둘이 같아진다.
       ⚠ 정렬은 그대로 필요하다 — 겹치는 면의 앞뒤 관계는 여전히 순서가 정한다. */
    var FS = new Set();          // 회전 뒤 좌표 기준(cells 는 이미 rot 적용됨)
    for (var q = 0; q < cells.length; q++) FS.add(cells[q].x + ',' + cells[q].y + ',' + cells[q].z);
    /* ⚠ hiSet 이 있으면 컬링하지 않는다. 해설의 강조/ghost 렌더는 **가려진 나무를 빨강으로
         보여주는 것이 목적**이라 컬링하면 기능 자체가 사라진다. 제출 후라 은닉할 이유도 없다. */
    var cull = !hiSet;
    var poly = '';
    for (var n = 0; n < cells.length; n++) {
      var x = cells[n].x, y = cells[n].y, z = cells[n].z;
      /* ① 큐브 통째 생략 — 앞대각 위 칸이 차 있으면 화면에서 완전히 사라진다.
           근거: 투영이 X=a(x-z), Y=b(x+z)-c*y (a=20,b=10,c=24) 라 (x+1,y+1,z+1) 은
           **X 가 완전히 같고 Y 만 4px 위**로 그려져 뒤 큐브를 덮되 바닥 4px 를 남기고,
           그 4px 를 (x+1,y,z+1)(ΔY=+20)이 덮는다. 두 칸을 **모두** 확인하므로
           중력이 없는 모양(minmax 후보·조작 전후)에도 안전하다.
           같은 규칙을 cubenest-hidden.js 가 이미 쓴다("(x+1,y+1,z+1) 이 차 있으면 안 보임").
           ⚠ 이 생략은 viewBox 를 바꾸지 않는다 — 가리는 큐브가 위아래로 더 넓게 걸치므로
             경계상자가 줄지 않는다. 아래 ②는 P() 를 그대로 불러 경계를 유지한다. */
      if (cull && FS.has((x + 1) + ',' + (y + 1) + ',' + (z + 1))
               && FS.has((x + 1) + ',' + y + ',' + (z + 1))) continue;
      // ② 면 단위 — 맞닿은 면은 이웃이 정확히 덮는다(그림은 그대로, 문자열만 준다)
      var sT = cull && FS.has(x + ',' + (y + 1) + ',' + z);         // 위
      var sF = cull && FS.has(x + ',' + y + ',' + (z + 1));         // 앞
      var sR = cull && FS.has((x + 1) + ',' + y + ',' + z);         // 옆
      // ⚠ P() 는 경계상자(minX..maxY)를 갱신하는 부수효과가 있다. 면을 건너뛰더라도
      //   **세 문자열은 반드시 계산해** viewBox 가 종전과 같게 유지한다.
      var top = P(x, y + 1, z) + ' ' + P(x + 1, y + 1, z) + ' ' + P(x + 1, y + 1, z + 1) + ' ' + P(x, y + 1, z + 1);
      var left = P(x, y, z + 1) + ' ' + P(x + 1, y, z + 1) + ' ' + P(x + 1, y + 1, z + 1) + ' ' + P(x, y + 1, z + 1);
      var right = P(x + 1, y, z) + ' ' + P(x + 1, y, z + 1) + ' ' + P(x + 1, y + 1, z + 1) + ' ' + P(x + 1, y + 1, z);
      var hi = !!hiSet && hiSet.has(x + ',' + y + ',' + z);
      var op = (ghost && !hi) ? ' fill-opacity=".28"' : '';
      var st = hi ? ' stroke="#7c1f2c"' : '';
      var base = paint || { L: '#d8a76e', R: '#c8965a', T: '#e6c9a0' };
      var cL = hi ? '#d84a5e' : base.L, cR = hi ? '#b83346' : base.R, cT = hi ? '#ef7f8e' : base.T;
      if (!sF) poly += '<polygon points="' + left + '" fill="' + cL + '"' + op + st + '/>';
      if (!sR) poly += '<polygon points="' + right + '" fill="' + cR + '"' + op + st + '/>';
      if (!sT) poly += '<polygon points="' + top + '" fill="' + cT + '"' + op + st + '/>';
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
