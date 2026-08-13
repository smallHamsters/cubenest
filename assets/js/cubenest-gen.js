/*!
 * cubenest-gen.js — CubeNest 공용 문제 생성기 모듈 (마스터 §5.1·§7.3)
 * 버전: 0.1.0  ·  의존: CubeNest.core(silhouettes·exposedFaces·reverseCounts)
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
 *   levelPool(levels, type) → 유형별 허용 난이도(facesDraw=최상 제외)
 *   genProblem({type,level,seed,index,cfg,edu,core}) → { sh, level, which?, rc?, dir?, hmode?, hcells? }
 *   genSession({type,levels,seed,n,config,edu,core}) → [genProblem 결과...]
 *     · which(minmax)=min|max|diff · dir(facesMc)=front|side|top · hmode(hidden)=occ|surround
 */
(function (global) {
  'use strict';
  var VERSION = '0.1.0';

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

  // 오목(노치): 노출면 > 2×(위+앞+옆 실루엣 넓이). core 필요.
  function isConcave(sh, core) {
    var C = coreRef(core); if (!C) return false;
    var cs = coreShape(sh), s = C.silhouettes(cs), sum = s.top.size + s.front.size + s.side.size;
    return C.exposedFaces(cs) > 2 * sum;
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

  function levelPool(levels, type) {
    var p = levels.slice();
    if (type === 'facesDraw') { p = p.filter(function (l) { return l !== '최상'; }); if (!p.length) p = ['상']; }
    return p;
  }

  // 한 문항의 결정적 모양+하위질문
  function genProblem(o) {
    var C = coreRef(o.core);
    var rng = rngFrom(o.seed + ':' + o.index);
    var sh = genShape(rng, o.cfg);
    var out = { sh: sh, level: o.level };

    if (o.type === 'surface' && C) {                        // 겉넓이 오목 난이도 밴딩
      var want = o.level === '최상' ? true : (o.level === '상' ? null : false);
      if (want !== null) { var g = 0; while (g++ < 60 && isConcave(sh, C) !== want) sh = genShape(rng, o.cfg); out.sh = sh; }
    }
    if (o.type === 'minmax' && C) {                          // 최소·최대: 범위 있는(max>min) 모양
      var rc = C.reverseCounts(coreShape(sh)), g2 = 0;
      while (g2++ < 40 && rc.maxCount <= rc.minCount) { sh = genShape(rng, o.cfg); rc = C.reverseCounts(coreShape(sh)); }
      out.sh = sh; out.rc = rc;
      var r = rngFrom(o.seed + ':q' + o.index)(); out.which = r < 0.34 ? 'min' : (r < 0.67 ? 'max' : 'diff');
    }
    if (o.type === 'hidden') {                               // 안 보이는 나무: 가림 ≥1
      var hmode = o.edu === 'think' ? 'surround' : 'occ';
      var hc = hiddenCells(sh, hmode), g3 = 0;
      while (g3++ < 60 && hc.length < 1) { sh = genShape(rng, o.cfg); hc = hiddenCells(sh, hmode); }
      out.sh = sh; out.hmode = hmode; out.hcells = hc;
    }
    if (o.type === 'facesMc') {                              // 위·앞·옆 고르기: 방향
      var rngD = rngFrom(o.seed + ':d' + o.index);
      out.dir = ['front', 'side', 'top'][Math.floor(rngD() * 3)];
    }
    return out;
  }

  // 세션 전체(레벨 시퀀스 포함)
  function genSession(o) {
    var C = coreRef(o.core);
    var rngL = rngFrom(o.seed + ':L'), pool = levelPool(o.levels, o.type), probs = [];
    for (var i = 0; i < o.n; i++) {
      var lv = pool[Math.floor(rngL() * pool.length)];
      var cfg = o.config.levels[lv];
      probs.push(genProblem({ type: o.type, level: lv, seed: o.seed, index: i, cfg: cfg, edu: o.edu, core: C }));
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
