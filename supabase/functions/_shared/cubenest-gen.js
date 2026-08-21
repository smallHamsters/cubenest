/*!
 * cubenest-gen.js — CubeNest 공용 문제 생성기 모듈 (마스터 §5.1·§7.3)
 * 버전: 0.5.0  ·  의존: CubeNest.core · genConfig(스테이지·밴드) · hidden(가림 정리)
 *
 * 목적: quiz·worksheets가 "같은 seed → 같은 문제(모양+하위질문)"를 얻도록 생성 로직을 단일화.
 *   - 각 모듈이 genShape를 각자 인라인하면 표류(같은 버그 2회 수정) → §8.1 위반.
 *   - core 먼저 로드되어야 한다(오목·역방향 판정에 core 사용).
 *
 * 좌표: 위=+y, 앞=+z, 옆(오른쪽)=+x. 셀 = {x,y,z}.
 *
 * API:
 *   rngFrom(str) → 시드 PRNG (xmur3+mulberry32, 결정적)
 *   genShape(rng, cfg) → { gx,gz,maxH, hmap, cells:[{x,y,z}], count, pairs, exposed, edge }
 *   coreShape(sh) → { gx,gy,gz,edge, cells:[[x,y,z]] }  (core 입력 어댑터)
 *   isConcave(sh) → bool  (노출면 > 2×(위+앞+옆 실루엣); core 필요)
 *   hiddenCells(sh, mode) → [{x,y,z}]  (occ=겨냥도 뒤쪽 가림 / surround=이웃 가림)
 *   makeShape(rng, cfg) → 스테이지 규칙(직육면체·가림금지·개수밴드)을 지킨 모양. genShape 대신 쓴다
 *   levelPool(levels, type) → (구) 폴백. 지금은 genConfig.support(type, stage) 가 정본
 *   genProblem({type,level,stage,seed,index,cfg,edu,core}) → { sh, level, stage, which?, rc?, dir?, ... }
 *   genSession({type,levels,stage,seed,n,config,edu,core}) → [genProblem 결과...]
 *     · which(minmax)=min|max|diff · dir(facesMc)=front|side|top · sub(hidden)=A-a..A-f · hcols/hasHidden/count/kinds
 */
(function (global) {
  'use strict';
  var VERSION = '0.5.0';   // 0.5.0 = 세션 내 중복 회피(§genSession)

  function coreRef(explicit) {
    return explicit || (global.CubeNest && global.CubeNest.core) || null;
  }

  // ----- 시드 PRNG -----
  function xmur3(s) { var h = 1779033703 ^ s.length; for (var i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return function () { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return (h ^= h >>> 16) >>> 0; }; }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function rngFrom(str) { var s = xmur3(str); return mulberry32(s()); }

  // ----- 원시 모양 생성(연결·중력) -----
  function genShape(rng, cfg) {
    var gx = cfg.gx, gz = cfg.gz, maxH = cfg.maxH;
    var ri = function (n) { return Math.floor(rng() * n); };
    var rr = function (a, b) { return a + Math.floor(rng() * (b - a + 1)); };
    var f = Math.min(rr(cfg.fMin, cfg.fMax), gx * gz);
    var foot = new Set(); var sx = ri(gx), sz = ri(gz); foot.add(sx + ',' + sz);
    while (foot.size < f) {
      var cand = [];
      foot.forEach(function (k) { var p = k.split(',').map(Number), x = p[0], z = p[1];[[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var nx = x + d[0], nz = z + d[1]; if (nx >= 0 && nx < gx && nz >= 0 && nz < gz && !foot.has(nx + ',' + nz)) cand.push(nx + ',' + nz); }); });
      if (!cand.length) break; foot.add(cand[ri(cand.length)]);
    }
    var arr = Array.from(foot).map(function (k) { return k.split(',').map(Number); });
    var H = {}; arr.forEach(function (p) { H[p[0] + ',' + p[1]] = 1; });
    var N = Math.max(arr.length, Math.min(rr(cfg.nMin, cfg.nMax), arr.length * maxH));
    var rem = N - arr.length, guard = 0;
    while (rem > 0 && guard++ < 999) { var opts = arr.filter(function (p) { return H[p[0] + ',' + p[1]] < maxH; }); if (!opts.length) break; var q = opts[ri(opts.length)]; H[q[0] + ',' + q[1]]++; rem--; }
    var hmap = []; for (var x = 0; x < gx; x++) { hmap.push(new Array(gz).fill(0)); }
    var cells = [], count = 0;
    arr.forEach(function (p) { var h = H[p[0] + ',' + p[1]]; hmap[p[0]][p[1]] = h; count += h; for (var y = 0; y < h; y++) cells.push({ x: p[0], y: y, z: p[1] }); });
    var set = new Set(cells.map(function (c) { return c.x + ',' + c.y + ',' + c.z; }));
    var pairs = 0; cells.forEach(function (c) { [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach(function (d) { if (set.has((c.x + d[0]) + ',' + (c.y + d[1]) + ',' + (c.z + d[2]))) pairs++; }); });
    var exposed = 6 * count - 2 * pairs;
    return { gx: gx, gz: gz, maxH: maxH, hmap: hmap, cells: cells, count: count, pairs: pairs, exposed: exposed, edge: cfg.edge };
  }

  function coreShape(sh) { return { gx: sh.gx, gy: sh.maxH, gz: sh.gz, edge: sh.edge, cells: sh.cells.map(function (c) { return [c.x, c.y, c.z]; }) }; }

  // 높이지도({"x,z":h})를 shape 에 되쓰기 — genShape 와 같은 필드를 다시 계산한다.
  // (hidden 이 모양을 다듬어 돌려줄 때 쓴다. cells·count·pairs·exposed 가 어긋나면 안 된다.)
  function reshape(sh, hmapObj) {
    var hmap = [], x;
    for (x = 0; x < sh.gx; x++) hmap.push(new Array(sh.gz).fill(0));
    var cells = [], count = 0;
    for (var k in hmapObj) {
      var p = k.split(',').map(Number), h = hmapObj[k];
      if (!(h > 0)) continue;
      hmap[p[0]][p[1]] = h; count += h;
      for (var y = 0; y < h; y++) cells.push({ x: p[0], y: y, z: p[1] });
    }
    var set = new Set(cells.map(function (c) { return c.x + ',' + c.y + ',' + c.z; }));
    var pairs = 0;
    cells.forEach(function (c) { [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach(function (d) { if (set.has((c.x + d[0]) + ',' + (c.y + d[1]) + ',' + (c.z + d[2]))) pairs++; }); });
    return { gx: sh.gx, gz: sh.gz, maxH: sh.maxH, hmap: hmap, cells: cells, count: count, pairs: pairs, exposed: 6 * count - 2 * pairs, edge: sh.edge };
  }

  // 오목(노치): 노출면 > 2×(위+앞+옆 실루엣 넓이). core 필요.
  function isConcave(sh, core) {
    var C = coreRef(core); if (!C) return false;
    var cs = coreShape(sh), s = C.silhouettes(cs), sum = s.top.size + s.front.size + s.side.size;
    return C.exposedFaces(cs) > 2 * sum;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 스테이지 규칙을 지키는 모양 만들기 (난이도 재설계 v0.4 §7)
  //   cfg.box     = 직육면체로 낸다('하' 계산형) — 개수 = 가로×세로×높이 라 곱셈 한 번
  //   cfg.flatten = 가림 금지(S2·S3) — '안 보이는 나무'는 초6에서 처음 배운다
  //   cfg.nBand   = 개수 밴드. 재생성 후에도 이 안에 들어와야 한다
  // ───────────────────────────────────────────────────────────────────────────
  function hmObjOf(sh) {
    var o = {}, x, z;
    for (x = 0; x < sh.gx; x++) for (z = 0; z < sh.gz; z++) if (sh.hmap[x][z] > 0) o[x + ',' + z] = sh.hmap[x][z];
    return o;
  }
  function hiddenRef() { return (global.CubeNest && global.CubeNest.hidden) || null; }

  // 직육면체 — 밴드 안에 떨어지는 (가로·세로·높이) 조합 중 하나. 없으면 null.
  function genBox(rng, cfg) {
    var lo = cfg.nBand ? cfg.nBand[0] : cfg.nMin, hi = cfg.nBand ? cfg.nBand[1] : cfg.nMax;
    var cand = [], a, b, h, t;
    for (a = 1; a <= cfg.gx; a++) for (b = 1; b <= cfg.gz; b++) for (h = 1; h <= cfg.maxH; h++) {
      t = a * b * h;
      if (t >= lo && t <= hi && t > 1) cand.push([a, b, h]);
    }
    if (!cand.length) return null;
    var c = cand[Math.floor(rng() * cand.length)];
    var ox = Math.floor(rng() * (cfg.gx - c[0] + 1)), oz = Math.floor(rng() * (cfg.gz - c[1] + 1));
    var H = {}, x, z;
    for (x = 0; x < c[0]; x++) for (z = 0; z < c[1]; z++) H[(ox + x) + ',' + (oz + z)] = c[2];
    return reshape({ gx: cfg.gx, gz: cfg.gz, maxH: cfg.maxH, edge: cfg.edge }, H);
  }

  function inBand(sh, cfg) {
    if (!cfg || !cfg.nBand) return true;
    return sh.count >= cfg.nBand[0] && sh.count <= cfg.nBand[1];
  }
  function bandGap(sh, cfg) {
    if (!cfg || !cfg.nBand) return 0;
    var lo = cfg.nBand[0], hi = cfg.nBand[1];
    return sh.count < lo ? (lo - sh.count) : (sh.count > hi ? (sh.count - hi) : 0);
  }

  // genShape 대신 이것을 쓴다. 재생성 루프 안에서도 마찬가지 — 안 그러면 스테이지 규칙이 샌다.
  function makeShape(rng, cfg) {
    var HD = hiddenRef(), sh, best = null, g = 0;
    if (cfg.box) {
      sh = genBox(rng, cfg);                       // 직육면체는 가림이 없어 flatten 이 필요 없다
      if (sh) return sh;
    }
    for (;;) {
      sh = genShape(rng, cfg);
      if (cfg.flatten && HD) {
        var hm = hmObjOf(sh);
        // 올림/내림을 번갈아 — 한쪽만 쓰면 개수가 한 방향으로 치우쳐 새 힌트가 된다.
        if (HD.hasHidden(hm)) sh = reshape(sh, HD.flattenHidden(hm, (g % 2) ? 'raise' : 'lower'));
      } else if (cfg.capHidden && HD) {
        // 가림은 남기고 숨은 열 높이만 1 로. 위모양을 함께 주면 개수가 유일해진다(교과 관행).
        var hm2 = hmObjOf(sh);
        if (HD.hasHidden(hm2)) sh = reshape(sh, HD.capHiddenToOne(hm2));
      }
      if (inBand(sh, cfg)) return sh;
      if (best === null || bandGap(sh, cfg) < bandGap(best, cfg)) best = sh;
      if (++g >= 40) return best;                  // 밴드를 못 맞추면 가장 가까운 것을 고른다
    }
  }

  // 유형이 스스로 가림을 없애야 할 때(겨냥도에서 열 높이를 읽어야 성립하는 문항) 쓴다.
  //   올림/내림 중 개수 밴드를 지키는 쪽을 고른다 — 한쪽으로 고정하면 flatten 이 밴드를 밀어낸다
  //   (G-c 최상에서 실측 p90 이 밴드를 1 넘겼다). 둘 다 벗어나면 덜 벗어난 쪽.
  function flattenInBand(sh, cfg, HD, preferRaise) {
    if (!HD) return sh;
    var hmv = hmObjOf(sh);
    if (!HD.hasHidden(hmv)) return sh;
    var a = reshape(sh, HD.flattenHidden(hmv, preferRaise ? 'raise' : 'lower'));
    if (inBand(a, cfg)) return a;
    var b = reshape(sh, HD.flattenHidden(hmv, preferRaise ? 'lower' : 'raise'));
    if (inBand(b, cfg)) return b;
    return bandGap(a, cfg) <= bandGap(b, cfg) ? a : b;
  }

  // H-c 전용 모양 — 한 변 m 정육면체에서 need 개를 덜어낸 계단.
  //   H-c 의 답은 m³ − 개수 라, 일반 개수 밴드로는 답을 제어할 수 없다(넓고 낮으면 답이 폭발).
  //   그래서 목표 답에서 거꾸로 만든다. 높이를 x·z 양방향으로 비증가로 유지하면
  //   h(x+1,z+1) ≤ h(x,z) 가 자동 성립해 **가림이 생기지 않는다** — 겨냥도로 개수를 셀 수 있다.
  //   (0,0)은 항상 m 으로 남겨 목표 정육면체 크기가 m 으로 고정된다.
  function genCubeGap(rng, m, need, edge) {
    var h = [], x, z;
    for (x = 0; x < m; x++) { h.push([]); for (z = 0; z < m; z++) h[x].push(m); }
    var total = m * m * m, target = total - need, guard = 0;
    while (total > target && guard++ < 5000) {
      var cand = [];
      for (x = 0; x < m; x++) for (z = 0; z < m; z++) {
        if (x === 0 && z === 0) continue;                 // 최고 높이 m 유지
        if (h[x][z] <= 1) continue;                       // 발자국은 꽉 채운 상태로 둔다(연결·범위 보장)
        var sx = (x + 1 < m) ? h[x + 1][z] : 0, sz = (z + 1 < m) ? h[x][z + 1] : 0;
        if (h[x][z] - 1 >= sx && h[x][z] - 1 >= sz) cand.push([x, z]);
      }
      if (!cand.length) break;
      var c = cand[Math.floor(rng() * cand.length)];
      h[c[0]][c[1]] -= 1; total -= 1;
    }
    var H = {};
    for (x = 0; x < m; x++) for (z = 0; z < m; z++) H[x + ',' + z] = h[x][z];
    return reshape({ gx: m, gz: m, maxH: m, edge: edge || 1 }, H);
  }

  // H-c(정육면체 완성) 모양 — 정답값(need)에서 거꾸로 만든다.
  //   H-c 의 부담은 개수가 아니라 정답값('더 필요한 개수')이라, 개수 밴드로는 제어할 수 없다.
  //   ⚠ 겨냥도로 현재 개수를 세야 하므로 숨은 열이 있으면 성립하지 않는데, genCubeGap 의
  //     비증가 높이 구성이 그것을 구조적으로 막는다. 이미 정육면체면 답이 0이라 출제 불가인 것도
  //     need ≥ 1 을 목표로 잡아 피한다.
  //   H-a/H-b 가 후보를 못 찾았을 때의 대체 경로도 **이 함수를 쓴다** — 두 곳에서 각자 만들면
  //   한쪽만 밴드를 지키게 된다(실제로 그랬다).
  function buildHc(o, MP, hmOfM) {
    var mC = Math.max(2, (o.cfg && o.cfg.cubeM) || 3);
    var nb = (o.cfg && o.cfg.needBand) || [2, 6];
    var needMaxPossible = mC * mC * mC - (mC + mC * mC - 1);
    var nLoC = Math.max(1, Math.min(nb[0], needMaxPossible));
    var nHiC = Math.max(nLoC, Math.min(nb[1], needMaxPossible));
    var needT = nLoC + Math.floor(rngFrom(o.seed + ':hcn' + o.index)() * (nHiC - nLoC + 1));
    var shC = genCubeGap(rngFrom(o.seed + ':hcs' + o.index), mC, needT, o.cfg && o.cfg.edge);
    var cc = MP.completeCube(hmOfM(shC));                  // 서버가 정답의 단일 출처 — 되계산해 확인
    return { sh: shC, m: cc.m, need: cc.need };
  }

  // 스테이지가 허용하는 서브만 남긴다(유형 고유축 pool ∩ 스테이지 게이트).
  function poolGate(pool, subs) {
    if (!subs || !subs.length) return pool;
    var p = pool.filter(function (s) { return subs.indexOf(s) >= 0; });
    return p.length ? p : subs.slice();
  }

  // 안 보이는 나무: occ=겨냥도 뒤쪽 가림((x+1,y+1,z+1) 채워짐) / surround=앞·위·옆 이웃 모두 채워짐
  function hiddenCells(sh, mode) {
    var set = new Set(sh.cells.map(function (c) { return c.x + ',' + c.y + ',' + c.z; }));
    var has = function (x, y, z) { return set.has(x + ',' + y + ',' + z); };
    return sh.cells.filter(function (c) {
      return mode === 'surround'
        ? (has(c.x, c.y, c.z + 1) && has(c.x, c.y + 1, c.z) && has(c.x + 1, c.y, c.z))
        : has(c.x + 1, c.y + 1, c.z + 1);
    });
  }

  // A-f 출제 밴드(2~6가지) 이탈 정도. 재생성이 끝내 밴드를 못 맞췄을 때
  // '가장 가까운 후보'를 고르는 기준(정답을 잘라 맞추는 대신 문제를 고른다).
  //   k=1 = 숨은 나무가 없어 모양이 하나로 확정 → 답은 맞아도 A-f 문제로는 무의미하다.
  //   그래서 밴드 아래(1)는 큰 벌점을 줘, 밴드 위(7,8,…)를 항상 먼저 고르게 한다.
  function kindsGap(k, bd) {
    var lo = bd ? bd[0] : 2, hi = bd ? bd[1] : 6;
    if (k < 2) return 1000 + (lo - k);        // k=1 = 모양이 하나로 확정 → A-f 문제가 아니다
    return k < lo ? (lo - k) : (k > hi ? (k - hi) : 0);
  }

  // 굴곡 — 인접한 두 칸(4-이웃)의 높이차 평균. heightmap 의 고유축(§4.9).
  //   칸 수를 눌러도 이것으로 변별력이 살아난다(실측: 등급에 이미 단조).
  function ruggedOf(sh) {
    var d = [], x, z, h, nx, nz, k;
    for (x = 0; x < sh.gx; x++) for (z = 0; z < sh.gz; z++) {
      h = sh.hmap[x][z]; if (!h) continue;
      for (k = 0; k < 2; k++) {
        nx = x + (k ? 0 : 1); nz = z + (k ? 1 : 0);
        if (nx < sh.gx && nz < sh.gz && sh.hmap[nx][nz] > 0) d.push(Math.abs(h - sh.hmap[nx][nz]));
      }
    }
    if (!d.length) return 0;
    var s = 0, i; for (i = 0; i < d.length; i++) s += d[i];
    return s / d.length;
  }
  // 목표 밴드에 들어오는 모양을 찾는다. 못 찾으면 가장 가까운 것(정답을 자르지 않는다).
  function bandRegen(rng, cfg, sh, valOf, bd, tries) {
    var gap = function (v) { return v < bd[0] ? (bd[0] - v) : (v > bd[1] ? (v - bd[1]) : 0); };
    var best = sh, bd0 = gap(valOf(sh)), g = 0;
    while (bd0 > 0 && g++ < (tries || 60)) {
      sh = makeShape(rng, cfg);
      var d = gap(valOf(sh));
      if (d < bd0) { bd0 = d; best = sh; }
      if (d === 0) return sh;
    }
    return bd0 === 0 ? sh : best;
  }

  // (구) 폴백. 지금은 genConfig.support(type, stage) 가 정본이다.
  //   ~~facesDraw 최상 제외~~ 폐기 — 배제 사유가 '그리기 칸 수'였는데, 개수 밴드·높이 상한이
  //   걸리고 출제 형식이 바뀐(모양 여러 개 × 각 한 면) 지금은 그 이유가 성립하지 않는다(§4.8).
  function levelPool(levels, type) { return levels.slice(); }

  // 한 문항의 결정적 모양+하위질문
  function genProblem(o) {
    var C = coreRef(o.core);
    var rng = rngFrom(o.seed + ':' + o.index);
    var sh = makeShape(rng, o.cfg);
    var out = { sh: sh, level: o.level, stage: o.stage || null };

    // 겉넓이 오목 밴딩 + 정답값 상한(부피·겉넓이) — 두 조건을 한 루프에서 본다.
    //   ⚠ 따로 돌리면 뒤에 도는 쪽이 앞의 조건을 깬다. 또 makeShape 가 가림 정리를 끝낸
    //     모양을 주므로 오목 판정은 항상 '정리된 뒤'에 이뤄진다(순서가 뒤집히면 2.4% 뒤집힌다).
    //   정답값 상한이 없으면 개수와 edge 가 곱으로 겹쳐 네 자리가 된다(옛 volume 중 최대 1701).
    if ((o.type === 'surface' || o.type === 'volume') && C) {
      var wantC = o.type !== 'surface' ? null
        : (o.cfg && o.cfg.concave !== undefined && o.cfg.concave !== null ? o.cfg.concave
           : (o.cfg && o.cfg.concave === null ? null
              : (o.level === '최상' ? true : (o.level === '상' ? null : false))));
      var capV = (o.cfg && o.cfg.answerMax) || null;
      var eV = sh.edge || 1;
      var valOf = function (s) { return o.type === 'volume' ? s.count * eV * eV * eV : s.exposed * eV * eV; };
      var okOf = function (s) {
        if (wantC !== null && isConcave(s, C) !== wantC) return false;
        if (capV && valOf(s) > capV) return false;
        return true;
      };
      var gS = 0;
      while (gS++ < 60 && !okOf(sh)) sh = makeShape(rng, o.cfg);
      // 재생성으로도 상한을 못 맞추면 모서리 길이를 줄인다.
      //   개수는 밴드에 묶여 있고 edge 는 곱하는 수일 뿐이라, 모양을 흔들지 않고 값만 낮출 수 있다.
      //   (S5 최상 volume: 52개 × 3cm³ = 1404 → edge 2 로 내려 416)
      if (capV) { while (eV > 1 && valOf(sh) > capV) { eV -= 1; sh.edge = eV; } }
      out.sh = sh;
    }

    // heightmap — 칸 수는 cfg 가 이미 정했다(1차 축). 여기서는 굴곡을 목표 밴드에 맞춘다.
    if (o.type === 'heightmap' && o.cfg && o.cfg.rugged) {
      sh = bandRegen(rng, o.cfg, sh, ruggedOf, o.cfg.rugged, 60);
      out.sh = sh; out.rugged = ruggedOf(sh);
    }

    // 위모양 동봉 여부(겨냥도 6종). 어댑터가 이 값을 보고 q.top 을 붙인다.
    out.withTop = !!(o.cfg && o.cfg.withTop);
    // 숨은 열이 실제로 있을 때만 '숨은 자리는 1개' 규약 문구를 붙인다(없으면 군더더기).
    if (out.withTop) {
      var HDt = hiddenRef();
      out.hasHidden = !!(HDt && HDt.hasHidden(hmObjOf(sh)));
    }

    // facesDraw — 모양이 1개면 세 면 전부, 여러 개면 모양마다 한 면씩(§4.8).
    //   '여러 개'는 같은 방향 문항을 group 개씩 연속 배치하는 것으로 구현한다.
    //   모양마다 따로 채점되므로 하나를 틀려도 나머지가 살아남는다(bool 채점 유지).
    //   ⚠ 위모양을 제시물로 주는 스테이지에서는 **묻는 방향에서 top 을 뺀다** —
    //     위모양이 곧 top 의 정답이라 함께 주면 답을 알려주는 셈이다.
    //     대신 문제집 표준 조합 "위에서 본 모양 + 겨냥도 → 앞·옆 그리기"가 된다.
    if (o.type === 'facesDraw') {
      var withTop = !!(o.cfg && o.cfg.withTop);
      var DIRS = withTop ? ['front', 'side'] : ['top', 'front', 'side'];
      var nv = (o.cfg && o.cfg.views) || 3;
      if (nv >= 3) out.views = DIRS.slice();                // withTop 이면 앞·옆 2면
      else {
        var grp = Math.max(1, (o.cfg && o.cfg.group) || 1);
        var gi = Math.floor(o.index / grp);                 // 한 묶음은 같은 방향
        out.views = [DIRS[Math.floor(rngFrom(o.seed + ':fdv' + gi)() * DIRS.length)]];
      }
    }
    if (o.type === 'minmax' && C) {                          // G군(최대·최소) G-a/b/c
      var MM = (global.CubeNest && global.CubeNest.minmax) || null;   // cubenest-minmax.js
      var HDm = (global.CubeNest && global.CubeNest.hidden) || null;
      var hmOf = function (s) { return C.heightMap(coreShape(s)); };
      // 서브 pool — G-a 삼면도(중~최상) / G-b 위+한방향(상~최상) / G-c 층 조건(중~상)
      var gPool = (o.level === '하' || o.level === '중') ? ['G-a', 'G-c']
                : o.level === '상' ? ['G-a', 'G-b', 'G-c']
                : ['G-a', 'G-b'];                            // 최상(G-c 는 상까지)
      gPool = poolGate(gPool, o.cfg && o.cfg.subs);          // 스테이지 게이트(S2·S3 = G-c 만)
      var gsub = (o.sub && /^G-[abc]$/.test(o.sub)) ? o.sub
               : gPool[Math.floor(rngFrom(o.seed + ':gsub' + o.index)() * gPool.length)];
      var g2 = 0, r = rngFrom(o.seed + ':q' + o.index)();

      if (gsub === 'G-b' && MM) {
        // 폭이 생기려면 '높이≥2 이면서 칸≥2'인 줄이 있어야 한다(없으면 답이 하나로 고정).
        out.dir = rngFrom(o.seed + ':gd' + o.index)() < 0.5 ? 'front' : 'side';
        while (g2++ < 60 && !MM.hasRange(hmOf(sh), out.dir)) sh = makeShape(rng, o.cfg);
        out.rc = MM.minmaxFromTopAndSil(hmOf(sh), out.dir);
        out.which = r < 0.5 ? 'min' : 'max';                 // G-b 는 차이형 제외(교과 관례)
      } else if (gsub === 'G-c' && MM) {
        // ⚠ 겨냥도만 주는데 숨은 열이 있으면 그 열의 높이를 알 수 없어 문제가 성립하지 않는다.
        //   → 숨은 열이 없는 모양으로만 출제한다. 두 조건(숨은 열 없음 + 쓸 만한 n 존재)을
        //     한 루프에서 함께 만족시켜야 한다 — 따로 처리하면 n 을 찾느라 모양을 다시 뽑을 때
        //     숨은 열이 되살아난다(실측 200문항 중 2건이 '풀 수 없는 문제'로 나갔다).
        var fm = rngFrom(o.seed + ':gf' + o.index)() < 0.5 ? 'lower' : 'raise';
        var cand = [], g3 = 0;
        for (;;) {
          sh = flattenInBand(sh, o.cfg, HDm, fm === 'raise');
          cand = MM.levelChoices(hmOf(sh), sh.maxH);      // 답이 1 이상이고 전부는 아닌 n
          if (cand.length || g3++ >= 60) break;
          sh = makeShape(rng, o.cfg);
        }
        out.n = cand.length ? cand[Math.floor(rngFrom(o.seed + ':gn' + o.index)() * cand.length)] : 2;
        out.count = MM.countAtLeast(hmOf(sh), out.n);
      } else {                                               // G-a — 현행 삼면도 최대·최소
        gsub = 'G-a';
        var rc = C.reverseCounts(coreShape(sh));
        while (g2++ < 40 && rc.maxCount <= rc.minCount) { sh = makeShape(rng, o.cfg); rc = C.reverseCounts(coreShape(sh)); }
        out.rc = rc;
        out.which = r < 0.34 ? 'min' : (r < 0.67 ? 'max' : 'diff');
      }
      out.sh = sh; out.sub = gsub;
    }
    if (o.type === 'hidden' && C) {                          // 안 보이는 나무: A-a~f 6종(설계 v0.2)
      var HD = (global.CubeNest && global.CubeNest.hidden) || null;   // cubenest-hidden.js
      var hmapOf = function (s) { return C.heightMap(coreShape(s)); };
      // 서브타입 선택 — 난이도별 pool(hidden 지원 중~최상): 중=유무·위치 / 상=+개수 / 최상=+종류수
      var subPool = o.level === '하' ? ['A-a', 'A-c', 'A-e']   // 판단 + 제시물이 곧 답의 재료
                  : o.level === '중' ? ['A-a', 'A-b']
                  : o.level === '상' ? ['A-a', 'A-b', 'A-c', 'A-d', 'A-e']
                  : ['A-a', 'A-b', 'A-c', 'A-d', 'A-e', 'A-f'];      // 최상
      subPool = poolGate(subPool, o.cfg && o.cfg.subs);        // 스테이지 게이트(S2·S3 = A-c/A-e 만)
      var sub = (o.sub && /^A-[abcdef]$/.test(o.sub)) ? o.sub   // 강제 지정(테스트/선택)
                : subPool[Math.floor(rngFrom(o.seed + ':sub' + o.index)() * subPool.length)];
      var g3 = 0;
      if (HD) {
        if (sub === 'A-a') {                                  // 유무: 있음/없음을 반반으로
          // 랜덤 모양은 난이도가 오를수록 거의 다 '숨음 있음'이다(중 72%·상 93%·최상 99%).
          // 그대로 두면 "있어요"만 눌러도 최상 99점이라, seed 로 답을 반반 정하고 그 쪽을 만든다.
          var wantHidden = rngFrom(o.seed + ':ah' + o.index)() < 0.5;
          if (wantHidden) {
            while (g3++ < 80 && !HD.hasHidden(hmapOf(sh))) sh = makeShape(rng, o.cfg);
          } else {
            // '없음'은 최상에서 1% 뿐이라 재생성으로는 못 만난다(80회로도 45% 실패) → 직접 정리.
            // 올림만 쓰면 '없음' 모양만 개수가 커져 새 힌트가 된다 → 올림/내림을 반반 섞는다.
            var fmode = rngFrom(o.seed + ':am' + o.index)() < 0.5 ? 'lower' : 'raise';
            sh = flattenInBand(sh, o.cfg, HD, fmode === 'raise');
          }
        } else if (sub === 'A-b') {                           // 위치: 숨은 나무 있어야
          while (g3++ < 60 && !HD.hasHidden(hmapOf(sh))) sh = makeShape(rng, o.cfg);
        } else if (sub === 'A-d') {                           // 삼면도: 범위(max>min)
          var rcH = C.reverseCounts(coreShape(sh));
          while (g3++ < 40 && rcH.maxCount <= rcH.minCount) { sh = makeShape(rng, o.cfg); rcH = C.reverseCounts(coreShape(sh)); }
          out.rc = rcH; var rq = rngFrom(o.seed + ':q' + o.index)(); out.which = rq < 0.34 ? 'min' : (rq < 0.67 ? 'max' : 'diff');
        } else if (sub === 'A-f') {                           // 종류 수: 가짓수가 등급 밴드에 들도록
          // enumerateByVisible 은 cap 없이 = 정확값. (cap 을 주면 초과 시 Infinity)
          // 예전엔 cap=6 이 정답으로 반환돼, 실제 9·216가지인 모양도 "6가지"로 출제됐다.
          // 밴드는 이제 등급이 정한다(하 2~3 … 최상 9~27) — 정답이 {2,3,4,6} 네 값뿐이라
          // 찍어서 25% 맞던 문제를 고친다. 가짓수 = Π(D−1) 이라 숨은 열이 2개 이상이어야 퍼진다.
          var afBand = (o.cfg && o.cfg.kinds) || [2, 6];
          var afMinCols = (o.cfg && o.cfg.hcolsMin) || 1;
          var afGapOf = function (s) {
            var h = hmapOf(s);
            return kindsGap(HD.enumerateByVisible(h), afBand)
                 + (HD.hiddenColumns(h).length >= afMinCols ? 0 : 100);
          };
          // ⚠ A-f 는 **발자국 정책이 다르다.** 가짓수 = Π(D−1) 이라 열 높이가 갈라져야 하는데,
          //   cfg 의 발자국은 문제마다 고정이다. 넓고 낮게 뽑힌 cfg(예: 4×4 에 13칸·14개)로는
          //   어떤 모양을 뽑아도 앞대각 높이차가 1 이라 **가짓수가 영원히 1**이다(실측 200/200 = 1가지).
          //   그래서 이 서브만 매 시도마다 개수 밴드 안에서 발자국을 다시 고른다 —
          //   평균 높이가 1.6 이상 되도록 발자국 상한을 조여 높이가 몰리게 한다.
          var afRng = rngFrom(o.seed + ':afc' + o.index);
          var afCells = o.cfg.gx * o.cfg.gz;
          var afTry = function () {
            var nn = o.cfg.nBand[0] + Math.floor(afRng() * (o.cfg.nBand[1] - o.cfg.nBand[0] + 1));
            var fLo = Math.max(2, Math.ceil(nn / o.cfg.maxH));
            var fHi = Math.max(fLo, Math.min(afCells, Math.ceil(nn / 1.6)));
            var c2 = {}, kc; for (kc in o.cfg) c2[kc] = o.cfg[kc];
            c2.nMin = c2.nMax = nn;
            c2.fMin = c2.fMax = fLo + Math.floor(afRng() * (fHi - fLo + 1));
            return makeShape(rng, c2);
          };
          var afSh = sh, afGap = afGapOf(sh);
          while (g3++ < 240 && afGap > 0) {
            sh = afTry();
            var gk = afGapOf(sh);
            if (gk < afGap) { afSh = sh; afGap = gk; }
          }
          sh = afSh;                                          // 실패해도 최선 후보(정답은 언제나 정확값)
          out.kinds = HD.enumerateByVisible(hmapOf(sh));
        }
        var hm = hmapOf(sh);
        out.hcols = HD.hiddenColumns(hm);                     // 숨은 열 위치(A-a/b/f)
        out.hasHidden = HD.hasHidden(hm);                     // A-a 유무
      }
      out.sh = sh; out.sub = sub; out.count = sh.cells.length; // A-c/A-e 개수
    }
    if (o.type === 'manip' && C) {                           // H군(조작) H-c 정육면체 완성 / H-d 색칠
      var MP = (global.CubeNest && global.CubeNest.manip) || null;
      var HDp = (global.CubeNest && global.CubeNest.hidden) || null;
      var hmOfM = function (s) { return C.heightMap(coreShape(s)); };
      // H-a/H-b 등급 제한('상만', v0.10.2)은 폐기한다. 스테이지 게이트가 생긴 뒤로 "어느 등급에
      // 낼지"는 GATE 와 support() 가 정하는데(열려 있으면 4등급 전부), 여기서 한 번 더 거르면
      // **랜딩은 4등급을 파는데 생성기는 상에서만 뽑는** 어긋남이 된다. 격자 부담은 등급이
      // 개수·격자·높이로 이미 조절한다(실측 답안칸: 하·중 27 / 상·최상 48).
      var mPool = ['H-c', 'H-d', 'H-a', 'H-b'];
      mPool = poolGate(mPool, o.cfg && o.cfg.subs);            // 스테이지 게이트(S3=H-c / S4=H-c·H-d)
      var msub = (o.sub && /^H-[abcd]$/.test(o.sub)) ? o.sub
               : mPool[Math.floor(rngFrom(o.seed + ':msub' + o.index)() * mPool.length)];
      if (MP) {
        if (msub === 'H-d') {
          // 한 변 n = 등급(중 3·상 4·최상 5). n=2 는 전부 3면이라 출제하지 않는다.
          // 직육면체 a×b×c 로 일반화(§4.10). 정육면체만 쓰던 시절엔 최고 높이 4층 확정으로
          // 한 변 5 가 불가능해져 문항 공간이 8개로 줄었다. 넓히면 스테이지별 4~8상자 × k 가 된다.
          //   각 변 ≥2(c=1 이면 낱개가 전부 위·아래 두 면을 갖게 되어 분해가 성립하지 않는다)
          //   높이 c ≤ 스테이지 상한. 총 개수는 등급 밴드(boxTotal).
          var bt = (o.cfg && o.cfg.boxTotal) || [8, 100];
          var cap = Math.max(2, (o.cfg && o.cfg.maxH) || 4);
          var gxB = Math.max(2, (o.cfg && o.cfg.gx) || 5), gzB = Math.max(2, (o.cfg && o.cfg.gz) || 5);
          var bx = [], aa, bb, cc2, tt;
          for (aa = 2; aa <= gxB; aa++) for (bb = 2; bb <= gzB; bb++) for (cc2 = 2; cc2 <= cap; cc2++) {
            tt = aa * bb * cc2;
            if (tt >= bt[0] && tt <= bt[1]) bx.push([aa, bb, cc2]);
          }
          if (!bx.length) bx = [[2, 2, Math.min(2, cap)]];     // 밴드가 비면 최소 상자
          var bsel = bx[Math.floor(rngFrom(o.seed + ':hbox' + o.index)() * bx.length)];
          // k 는 정답이 0 이 아닌 값에서 고른다 — 얇은 상자는 0면·1면이 0 이라 문항이 안 된다.
          var allK = MP.paintedBoxAll(bsel[0], bsel[1], bsel[2]);
          var ks = [0, 1, 2, 3].filter(function (k) { return allK[k] > 0; });
          if (!ks.length) ks = [3];
          var kk2 = ks[Math.floor(rngFrom(o.seed + ':hk' + o.index)() * ks.length)];
          sh = reshape({ gx: gxB, gz: gzB, maxH: cap, edge: o.cfg.edge },
                       MP.solidBoxHmap(bsel[0], bsel[1], bsel[2]));
          out.box = bsel; out.n = bsel[0]; out.k = kk2; out.count = allK[kk2];
        } else if (msub === 'H-a' || msub === 'H-b') {
          // 겨냥도 + 표시된 열에 ±k → 바뀐 모양의 삼면도를 그린다.
          // 성립 조건 3가지를 한 루프에서: ① 숨은 열 없음(높이를 읽을 수 있어야) ②
          // 결과가 연결·비어있지 않음 ③ 삼면도가 실제로 달라짐(안 그러면 답=원본).
          var add = msub === 'H-a';
          var fm3 = rngFrom(o.seed + ':hf' + o.index)() < 0.5 ? 'lower' : 'raise';
          // ⚠ resolveCfg 는 발자국 f 와 개수 n 을 **하나의 값으로 고정**한다. 그래서 n = f×maxH
          //   (모든 열이 높이 상한) 이면 H-a 는 더 쌓을 자리가 없고, 같은 cfg 로 60번을 다시
          //   뽑아도 결과가 같다 — 실측 S4 하·중에서 3% 가 이 포화로 H-c 대체로 떨어졌다.
          //   그래서 첫 실패에서 cfg 를 개수 밴드 전체로 넓혀 여유 있는 모양이 나오게 한다.
          //   (nBand 는 그대로라 makeShape 의 밴드 준수 검사는 변하지 않는다.)
          var cfgTry = o.cfg, g6 = 0, cands = [];
          for (;;) {
            sh = flattenInBand(sh, cfgTry, HDp, fm3 === 'raise');
            cands = MP.opCandidates(hmOfM(sh), sh.maxH, add);
            if (cands.length || g6++ >= 60) break;
            if (g6 === 1 && cfgTry.nBand) {
              var cells6 = cfgTry.gx * cfgTry.gz;
              cfgTry = Object.assign({}, o.cfg, {
                nMin: cfgTry.nBand[0], nMax: cfgTry.nBand[1],
                fMin: Math.max(1, cfgTry.fMin - 1), fMax: Math.min(cells6, cfgTry.fMax + 2)
              });
            }
            sh = makeShape(rng, cfgTry);
          }
          if (cands.length) {
            var pick = cands[Math.floor(rngFrom(o.seed + ':hop' + o.index)() * cands.length)];
            out.target = pick[0]; out.delta = pick[1];
            out.resSh = reshape(sh, MP.applyDelta(hmOfM(sh), pick[0], pick[1]));
          } else {
            // 끝내 못 만들면 같은 등급의 H-c 로 대체한다.
            // ⚠ 예전엔 여기서 '현재 모양'에 completeCube 를 돌렸다. 그러면 정답이 m³−개수 라
            //   needBand 를 통째로 무시하고(S4 상에서 46~52, 밴드는 [10,25]),
            //   모양이 이미 정육면체면 need=0 인 출제 불가 문항이 나왔다.
            //   → 정상 H-c 와 **같은 경로**(buildHc)로 만든다.
            msub = 'H-c';
            var hcF = buildHc(o, MP, hmOfM);
            sh = hcF.sh; out.m = hcF.m; out.need = hcF.need;
          }
        } else {
          msub = 'H-c';
          var hc0 = buildHc(o, MP, hmOfM);
          sh = hc0.sh; out.m = hc0.m; out.need = hc0.need;
        }
      }
      out.sh = sh; out.sub = msub;
    }
    if (o.type === 'facesMc') {                              // 위·앞·옆 고르기: 방향
      // ⚠ 위모양을 제시물로 주는 스테이지에서는 top 을 묻지 않는다 — 정답을 함께 주는 셈이다.
      // 스테이지가 방향을 제한하면(cfg.mcDirs — 유아=위만, 초1~2=위·앞) 그것을 먼저 따른다.
      var mcDirs = (o.cfg && o.cfg.mcDirs && o.cfg.mcDirs.length)
        ? o.cfg.mcDirs.filter(function (d) { return !(o.cfg.withTop && d === 'top'); })
        : ((o.cfg && o.cfg.withTop) ? ['front', 'side'] : ['front', 'side', 'top']);
      if (!mcDirs.length) mcDirs = ['front', 'side'];
      var rngD = rngFrom(o.seed + ':d' + o.index);
      out.dir = mcDirs[Math.floor(rngD() * mcDirs.length)];
    }
    return out;
  }

  // 세션 전체(레벨 시퀀스 포함). v0.2: 3축 gen-config(genConfig)로 cfg 해석.
  function cfgRef() { return (typeof CubeNest_genConfig !== "undefined" && CubeNest_genConfig)
    || (global.CubeNest && global.CubeNest.genConfig) || null; }
  //   o.stage = 연령 스테이지(S2~S5). 없으면 gen-config 의 기본값(S4=초6)으로 떨어진다
  //             → 스테이지를 모르는 기존 호출자는 지금까지와 같은 자리에 그대로 있는다.
  function genSession(o) {
    var C = coreRef(o.core);
    var CFG = cfgRef();
    var stage = CFG ? CFG.normStage(o.stage) : null;
    var rngL = rngFrom(o.seed + ':L'), probs = [];
    // 지원 등급 교집합(요청 levels ∩ 그 스테이지에서 이 유형이 열려 있는가).
    var support = CFG ? CFG.support(o.type, stage) : (o.levels || ['중']);
    var pool = (o.levels || support).filter(function (l) { return support.indexOf(l) >= 0; });
    if (!pool.length) {                     // 요청이 전부 미지원 → 가장 가까운 지원 등급 1개
      var ORD = ['하','중','상','최상'];
      var want = (o.levels && o.levels.length) ? ORD.indexOf(o.levels[o.levels.length-1]) : 1;
      var best = support[0] || '중', bd = 99;
      support.forEach(function(l){ var d=Math.abs(ORD.indexOf(l)-want); if(d<bd){bd=d;best=l;} });
      pool = [best];
    }
    // ── 세션 내 중복 회피 ──
    //   밴드가 좁은 저학년·하 등급은 문제 공간 자체가 작다(실측: S0 하 = 서로 다른 모양 11개,
    //   S1 하 = 45개, S2 heightmap 하 = 22개). 중복 회피가 없으면 8문항 세션에서 같은 문항이
    //   두 번 나오는 비율이 S0 하 100% · S2 count 하 61% · S2 heightmap 하 78% 였다.
    //   → seed 에 재시도 소금(#t)을 붙여 다시 뽑는다. index 는 그대로 두어 facesDraw 묶음
    //     로직(index/group)이 깨지지 않는다. 같은 seed·n → 같은 세션이라 결정성도 유지된다.
    //   ⚠ 공간이 문항 수보다 작으면(예: S0 하 11가지에 12문항) 중복은 불가피하다 —
    //     MAX_TRY 를 소진하면 마지막 후보를 그대로 쓴다(문항 미생성보다 낫다).
    //   ⚠ 중복 판정은 **아이 눈에 같은가**로 한다 — 원 JSON 비교는 소용이 없다.
    //     같은 모양이 격자 반대편에 놓이거나 등급 라벨만 달라도 다른 문자열이 되는데,
    //     아이에게는 똑같은 문제다(실측: 원 JSON 키로는 S0 하 중복률이 100% → 100% 로 그대로였다).
    //     그래서 모양을 점유 범위 기준으로 정규화하고 등급 라벨을 뺀 것을 키로 쓴다.
    function dupKey(p) {
      var rest = {}, k;
      for (k in p) if (k !== 'sh' && k !== 'level') rest[k] = p[k];
      var s = p.sh, sig = '';
      if (s && s.hmap) {
        var occ = [], x, z;
        for (x = 0; x < s.gx; x++) for (z = 0; z < s.gz; z++) if (s.hmap[x][z] > 0) occ.push([x, z, s.hmap[x][z]]);
        if (occ.length) {
          var mx = Infinity, mz = Infinity;
          occ.forEach(function (c) { if (c[0] < mx) mx = c[0]; if (c[1] < mz) mz = c[1]; });
          sig = occ.map(function (c) { return (c[0] - mx) + ',' + (c[1] - mz) + ':' + c[2]; }).sort().join(' ');
        }
      }
      return sig + '|' + JSON.stringify(rest);
    }
    var seen = {}, MAX_TRY = 24;
    for (var i = 0; i < o.n; i++) {
      var lv = pool[Math.floor(rngL() * pool.length)];
      var pr = null, key = '';
      for (var t = 0; t < MAX_TRY; t++) {
        var sd = t ? (o.seed + '#' + t) : o.seed;
        // cfg 해석: 스테이지×등급 밴드(있으면) → 없으면 구 config.levels 폴백.
        var cfg = CFG ? CFG.resolveCfg(o.type, stage, lv, rngFrom(sd + ':cfg' + i))
                      : (o.config && o.config.levels && o.config.levels[lv]);
        pr = genProblem({ type: o.type, level: lv, stage: stage, seed: sd, index: i, cfg: cfg, edu: o.edu, core: C, sub: o.sub });
        key = dupKey(pr);
        if (!seen[key]) break;
      }
      seen[key] = 1;
      probs.push(pr);
    }
    return probs;
  }

  var gen = {
    VERSION: VERSION, rngFrom: rngFrom, genShape: genShape, coreShape: coreShape,
    isConcave: isConcave, hiddenCells: hiddenCells, levelPool: levelPool,
    genProblem: genProblem, genSession: genSession
  };
  global.CubeNest = global.CubeNest || {};
  global.CubeNest.gen = gen;
  if (typeof module !== 'undefined' && module.exports) module.exports = gen;

})(typeof globalThis !== 'undefined' ? globalThis : this);


// [서버 전용] ESM named export
export const gen = globalThis.CubeNest.gen;
