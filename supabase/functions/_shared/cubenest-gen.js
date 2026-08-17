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
 *     · which(minmax)=min|max|diff · dir(facesMc)=front|side|top · sub(hidden)=A-a..A-f · hcols/hasHidden/count/kinds
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
  function kindsGap(k) { return k < 2 ? 1000 : (k > 6 ? (k - 6) : 0); }

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
    if (o.type === 'minmax' && C) {                          // G군(최대·최소) G-a/b/c
      var MM = (global.CubeNest && global.CubeNest.minmax) || null;   // cubenest-minmax.js
      var HDm = (global.CubeNest && global.CubeNest.hidden) || null;
      var hmOf = function (s) { return C.heightMap(coreShape(s)); };
      // 서브 pool — G-a 삼면도(중~최상) / G-b 위+한방향(상~최상) / G-c 층 조건(중~상)
      var gPool = o.level === '중' ? ['G-a', 'G-c']
                : o.level === '상' ? ['G-a', 'G-b', 'G-c']
                : ['G-a', 'G-b'];                            // 최상(G-c 는 상까지)
      var gsub = (o.sub && /^G-[abc]$/.test(o.sub)) ? o.sub
               : gPool[Math.floor(rngFrom(o.seed + ':gsub' + o.index)() * gPool.length)];
      var g2 = 0, r = rngFrom(o.seed + ':q' + o.index)();

      if (gsub === 'G-b' && MM) {
        // 폭이 생기려면 '높이≥2 이면서 칸≥2'인 줄이 있어야 한다(없으면 답이 하나로 고정).
        out.dir = rngFrom(o.seed + ':gd' + o.index)() < 0.5 ? 'front' : 'side';
        while (g2++ < 60 && !MM.hasRange(hmOf(sh), out.dir)) sh = genShape(rng, o.cfg);
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
          if (HDm && HDm.hasHidden(hmOf(sh))) sh = reshape(sh, HDm.flattenHidden(hmOf(sh), fm));
          cand = MM.levelChoices(hmOf(sh), sh.maxH);      // 답이 1 이상이고 전부는 아닌 n
          if (cand.length || g3++ >= 60) break;
          sh = genShape(rng, o.cfg);
        }
        out.n = cand.length ? cand[Math.floor(rngFrom(o.seed + ':gn' + o.index)() * cand.length)] : 2;
        out.count = MM.countAtLeast(hmOf(sh), out.n);
      } else {                                               // G-a — 현행 삼면도 최대·최소
        gsub = 'G-a';
        var rc = C.reverseCounts(coreShape(sh));
        while (g2++ < 40 && rc.maxCount <= rc.minCount) { sh = genShape(rng, o.cfg); rc = C.reverseCounts(coreShape(sh)); }
        out.rc = rc;
        out.which = r < 0.34 ? 'min' : (r < 0.67 ? 'max' : 'diff');
      }
      out.sh = sh; out.sub = gsub;
    }
    if (o.type === 'hidden' && C) {                          // 안 보이는 나무: A-a~f 6종(설계 v0.2)
      var HD = (global.CubeNest && global.CubeNest.hidden) || null;   // cubenest-hidden.js
      var hmapOf = function (s) { return C.heightMap(coreShape(s)); };
      // 서브타입 선택 — 난이도별 pool(hidden 지원 중~최상): 중=유무·위치 / 상=+개수 / 최상=+종류수
      var subPool = o.level === '중' ? ['A-a', 'A-b']
                  : o.level === '상' ? ['A-a', 'A-b', 'A-c', 'A-d', 'A-e']
                  : ['A-a', 'A-b', 'A-c', 'A-d', 'A-e', 'A-f'];      // 최상
      var sub = (o.sub && /^A-[abcdef]$/.test(o.sub)) ? o.sub   // 강제 지정(테스트/선택)
                : subPool[Math.floor(rngFrom(o.seed + ':sub' + o.index)() * subPool.length)];
      var g3 = 0;
      if (HD) {
        if (sub === 'A-a') {                                  // 유무: 있음/없음을 반반으로
          // 랜덤 모양은 난이도가 오를수록 거의 다 '숨음 있음'이다(중 72%·상 93%·최상 99%).
          // 그대로 두면 "있어요"만 눌러도 최상 99점이라, seed 로 답을 반반 정하고 그 쪽을 만든다.
          var wantHidden = rngFrom(o.seed + ':ah' + o.index)() < 0.5;
          if (wantHidden) {
            while (g3++ < 80 && !HD.hasHidden(hmapOf(sh))) sh = genShape(rng, o.cfg);
          } else {
            // '없음'은 최상에서 1% 뿐이라 재생성으로는 못 만난다(80회로도 45% 실패) → 직접 정리.
            // 올림만 쓰면 '없음' 모양만 개수가 커져 새 힌트가 된다 → 올림/내림을 반반 섞는다.
            var fmode = rngFrom(o.seed + ':am' + o.index)() < 0.5 ? 'lower' : 'raise';
            sh = reshape(sh, HD.flattenHidden(hmapOf(sh), fmode));
          }
        } else if (sub === 'A-b') {                           // 위치: 숨은 나무 있어야
          while (g3++ < 60 && !HD.hasHidden(hmapOf(sh))) sh = genShape(rng, o.cfg);
        } else if (sub === 'A-d') {                           // 삼면도: 범위(max>min)
          var rcH = C.reverseCounts(coreShape(sh));
          while (g3++ < 40 && rcH.maxCount <= rcH.minCount) { sh = genShape(rng, o.cfg); rcH = C.reverseCounts(coreShape(sh)); }
          out.rc = rcH; var rq = rngFrom(o.seed + ':q' + o.index)(); out.which = rq < 0.34 ? 'min' : (rq < 0.67 ? 'max' : 'diff');
        } else if (sub === 'A-f') {                           // 종류 수: '정확한' 가짓수가 2..6이 되도록
          // enumerateByVisible 은 cap 없이 = 정확값. (cap 을 주면 초과 시 Infinity)
          // 예전엔 cap=6 이 정답으로 반환돼, 실제 9·216가지인 모양도 "6가지"로 출제됐다.
          var kk = HD.enumerateByVisible(hmapOf(sh));
          var afSh = sh, afKk = kk;                           // 밴드에 가장 가까운 후보 기억
          while (g3++ < 80 && (kk < 2 || kk > 6)) {
            sh = genShape(rng, o.cfg); kk = HD.enumerateByVisible(hmapOf(sh));
            if (kindsGap(kk) < kindsGap(afKk)) { afSh = sh; afKk = kk; }
          }
          if (kk < 2 || kk > 6) { sh = afSh; kk = afKk; }     // 80회 실패 → 최선 후보 채택(정답은 언제나 정확값)
          out.kinds = kk;
        }
        var hm = hmapOf(sh);
        out.hcols = HD.hiddenColumns(hm);                     // 숨은 열 위치(A-a/b/f)
        out.hasHidden = HD.hasHidden(hm);                     // A-a 유무
      }
      out.sh = sh; out.sub = sub; out.count = sh.cells.length; // A-c/A-e 개수
    }
    if (o.type === 'facesMc') {                              // 위·앞·옆 고르기: 방향
      var rngD = rngFrom(o.seed + ':d' + o.index);
      out.dir = ['front', 'side', 'top'][Math.floor(rngD() * 3)];
    }
    return out;
  }

  // 세션 전체(레벨 시퀀스 포함). v0.2: 3축 gen-config(genConfig)로 cfg 해석.
  function cfgRef() { return (typeof CubeNest_genConfig !== "undefined" && CubeNest_genConfig)
    || (global.CubeNest && global.CubeNest.genConfig) || null; }
  function genSession(o) {
    var C = coreRef(o.core);
    var CFG = cfgRef();
    var rngL = rngFrom(o.seed + ':L'), probs = [];
    // 지원 등급 교집합(요청 levels ∩ 유형 지원). 없으면 유형 최소 지원 등급.
    var support = CFG ? CFG.support(o.type) : (o.levels || ['중']);
    var pool = (o.levels || support).filter(function (l) { return support.indexOf(l) >= 0; });
    if (!pool.length) {                     // 요청이 전부 미지원 → 가장 가까운 지원 등급 1개
      var ORD = ['하','중','상','최상'];
      var want = (o.levels && o.levels.length) ? ORD.indexOf(o.levels[o.levels.length-1]) : 1;
      var best = support[0] || '중', bd = 99;
      support.forEach(function(l){ var d=Math.abs(ORD.indexOf(l)-want); if(d<bd){bd=d;best=l;} });
      pool = [best];
    }
    for (var i = 0; i < o.n; i++) {
      var lv = pool[Math.floor(rngL() * pool.length)];
      // cfg 해석: 3축 프리셋(있으면) → 없으면 구 config.levels 폴백.
      var cfg = CFG ? CFG.resolveCfg(o.type, lv, rngFrom(o.seed + ':cfg' + i))
                    : (o.config && o.config.levels && o.config.levels[lv]);
      probs.push(genProblem({ type: o.type, level: lv, seed: o.seed, index: i, cfg: cfg, edu: o.edu, core: C, sub: o.sub }));
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
