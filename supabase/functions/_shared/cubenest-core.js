/*!
 * cubenest-core.js — CubeNest 공용 계산 코어 (마스터 §4 [불변]의 실행형)
 * 버전: 0.1.0  ·  의존성 없음(순수 함수, DOM/Three 불필요)
 *
 * 목적: 모양 수학(직렬화·정방향 계산·투상)을 playground/quiz/worksheets가
 *       "복사"가 아니라 이 파일 하나를 "참조"해서 쓰도록 하는 단일 출처.
 *       (마스터 §4가 스펙, 이 파일이 구현 — 둘을 어긋나지 않게 유지한다.)
 *
 * 상태(잠정): 마스터 §8.1 개정(복사→모듈) 확정 전 참조 구현.
 *             로딩 방식은 전역 네임스페이스(window.CubeNest.core)를 잠정 채택.
 *             리더가 ESM 등으로 정하면 래핑만 바꾸면 된다.
 *
 * 범위(v0.1.0): 4.1 직렬화 · 4.2 정방향 · 4.3 투상.  (4.4 역방향 최소개수는 v0.2.0 예정)
 *
 * 모양 표현: shape = { gx, gy, gz, edge, cells }
 *   - cells: Set<"x,y,z"> | Array<"x,y,z"> | Array<[x,y,z]>  (모두 허용, 내부에서 정규화)
 *   - 좌표계(마스터 3.2): 앞=+z, 옆(오른쪽)=+x, 위=+y. iy=0이 바닥.
 */
(function (global) {
  'use strict';

  var VERSION = '0.4.0';
  var SER_VER = 1; // 직렬화 버전 바이트 (playground와 동일 — ?m= 링크 호환)

  // ---------- 유틸: 셀 정규화 ----------
  function K(x, y, z) { return x + ',' + y + ',' + z; }

  // 어떤 형태의 cells든 Set<"x,y,z">로 정규화
  function toCellSet(cells) {
    if (cells instanceof Set) return cells;
    var s = new Set();
    if (!cells) return s;
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      if (Array.isArray(c)) s.add(K(c[0], c[1], c[2]));
      else s.add(String(c));
    }
    return s;
  }

  function parse(k) { var p = k.split(',').map(Number); return { x: p[0], y: p[1], z: p[2] }; }

  function normalize(shape) {
    return {
      gx: shape.gx, gy: shape.gy, gz: shape.gz,
      edge: (shape.edge == null ? 1 : shape.edge),
      cells: toCellSet(shape.cells)
    };
  }

  // ================= 4.1 순수 모양 직렬화 (?m=) =================
  // 포맷: [SER_VER, gx, gy, gz, edge] + 채운 칸 비트마스크(index = x*gy*gz + y*gz + z), URL-safe base64.
  // ※ playground와 바이트 동일 — 모듈 간 공유 링크가 그대로 열린다.

  function b64urlEnc(u8) {
    var s = '';
    for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    var b = (typeof btoa === 'function') ? btoa(s) : Buffer.from(u8).toString('base64');
    return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDec(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    if (typeof atob === 'function') {
      var s = atob(str), u8 = new Uint8Array(s.length);
      for (var i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
      return u8;
    }
    return new Uint8Array(Buffer.from(str, 'base64'));
  }

  function serialize(shape) {
    var sh = normalize(shape);
    var gx = sh.gx, gy = sh.gy, gz = sh.gz, edge = sh.edge, total = gx * gy * gz;
    var mask = new Uint8Array(Math.ceil(total / 8));
    sh.cells.forEach(function (k) {
      var c = parse(k); var i = c.x * (gy * gz) + c.y * gz + c.z;
      mask[i >> 3] |= (1 << (i & 7));
    });
    var out = new Uint8Array(5 + mask.length);
    out.set([SER_VER, gx, gy, gz, edge]); out.set(mask, 5);
    return b64urlEnc(out);
  }

  function deserialize(str) {
    try {
      var a = b64urlDec(str);
      if (a[0] !== SER_VER) return null;
      var gx = a[1], gy = a[2], gz = a[3], edge = a[4];
      var ok = function (v) { return Number.isInteger(v) && v >= 1 && v <= 10; };
      if (![gx, gy, gz, edge].every(ok)) return null;
      var total = gx * gy * gz, mask = a.subarray(5), cells = new Set();
      for (var i = 0; i < total; i++) {
        if ((mask[i >> 3] >> (i & 7)) & 1) {
          var x = Math.floor(i / (gy * gz)), r = i % (gy * gz), y = Math.floor(r / gz), z = r % gz;
          cells.add(K(x, y, z));
        }
      }
      return { gx: gx, gy: gy, gz: gz, edge: edge, cells: cells };
    } catch (e) { return null; }
  }

  // ============= 4.1b 선택(강조) 마스크 (?h=) =============
  // 포맷: 채운 칸을 정규 순서(index = x*gy*gz + y*gz + z 오름차순)로 세우고,
  //       그 '순서 위의' 비트마스크 ceil(개수/8)B, LSB-first, URL-safe base64.
  // ※ ?m= 와 분리했다 — 모양 바이트·SER_VER 를 건드리지 않아 옛 공유 링크가 전부 유효하고,
  //   캐시된 구버전 클라이언트가 새 링크를 열어도 모양은 정상으로 나온다.
  // ※ 전체 격자(최대 1000비트=125B)가 아니라 채운 칸 수만큼만 쓴다 — '강조 ⊆ 채운 칸'이
  //   불변식이기 때문(playground clampHighlight). 나무 20개면 3B → base64 4자.
  // ⚠ 인코더·디코더 양쪽 다 cellOrder 로 정렬할 것. playground 의 cells 는 '편집 순서',
  //   deserialize 가 만든 cells 는 'index 순서'라 정렬을 빠뜨리면 예외 없이 다른 칸이 칠해진다.

  // 채운 칸의 정규 순서 배열 — 마스크 비트 위치의 단일 출처.
  function cellOrder(shape) {
    var sh = normalize(shape), gy = sh.gy, gz = sh.gz, arr = [];
    sh.cells.forEach(function (k) {
      var c = parse(k);
      arr.push({ k: k, i: c.x * (gy * gz) + c.y * gz + c.z });
    });
    arr.sort(function (a, b) { return a.i - b.i; });
    return arr.map(function (e) { return e.k; });
  }

  // marks(Set|Array) → base64url. shape.cells 밖의 키는 무시(불변식 강제).
  // 표시할 게 없으면 '' — 호출부가 &h= 자체를 생략하게 해 링크를 짧게 유지한다.
  function serializeMarks(shape, marks) {
    var order = cellOrder(shape), set = toCellSet(marks);
    if (!order.length || !set.size) return '';
    var mask = new Uint8Array(Math.ceil(order.length / 8)), any = false;
    for (var i = 0; i < order.length; i++) {
      if (set.has(order[i])) { mask[i >> 3] |= (1 << (i & 7)); any = true; }
    }
    return any ? b64urlEnc(mask) : '';
  }

  // base64url → Set<"x,y,z">(항상 shape.cells 의 부분집합). 무효하면 null, 예외는 안 던진다.
  // ⚠ deserialize 보다 엄격하게 검사한다 — ?h= 엔 버전 바이트도 헤더도 없어 길이가 유일한
  //   교차검증 수단이다. 여기서 관대하게 굴면 잘린 마스크가 '부분적으로 맞는 색'으로 통과한다.
  function deserializeMarks(shape, str) {
    try {
      if (!str) return new Set();                            // 없음 = 표시 없음(정상)
      if (!/^[A-Za-z0-9_-]+={0,2}$/.test(str)) return null;  // 손상 → atob 전에 거부
      var a = b64urlDec(str), order = cellOrder(shape);
      if (a.length !== Math.ceil(order.length / 8)) return null;   // 다른 모양의 마스크·잘린 URL
      var out = new Set();
      for (var i = 0; i < order.length; i++) {
        if ((a[i >> 3] >> (i & 7)) & 1) out.add(order[i]);
      }
      return out;
    } catch (e) { return null; }
  }

  // ================= 4.2 정방향 계산 (모양 → 값) =================
  function count(shape) { return toCellSet(shape.cells).size; }

  function volume(shape) {
    var sh = normalize(shape); var e = sh.edge;
    return sh.cells.size * e * e * e;
  }

  function touchingPairs(shape) {
    var cells = toCellSet(shape.cells), pairs = 0;
    cells.forEach(function (k) {
      var c = parse(k);
      if (cells.has(K(c.x + 1, c.y, c.z))) pairs++;
      if (cells.has(K(c.x, c.y + 1, c.z))) pairs++;
      if (cells.has(K(c.x, c.y, c.z + 1))) pairs++;
    });
    return pairs;
  }

  // 방향별 '드러난 면 수'(위=+y, 앞=+z, 옆=+x). 각 축은 +/-가 대칭이라 한쪽만 센다.
  function revealed(shape) {
    var cells = toCellSet(shape.cells), up = 0, front = 0, side = 0;
    cells.forEach(function (k) {
      var c = parse(k);
      if (!cells.has(K(c.x, c.y + 1, c.z))) up++;     // 위
      if (!cells.has(K(c.x, c.y, c.z + 1))) front++;  // 앞
      if (!cells.has(K(c.x + 1, c.y, c.z))) side++;   // 옆
    });
    return { up: up, front: front, side: side };
  }

  // 노출면 = 6N − 2·pairs = 2·(위+앞+옆). 구멍 유무와 무관하게 항상 정확(마스터 4.2).
  function exposedFaces(shape) {
    var r = revealed(shape);
    return 2 * (r.up + r.front + r.side);
  }

  function surfaceArea(shape) {
    var sh = normalize(shape);
    return exposedFaces(sh) * sh.edge * sh.edge; // 바닥면 포함
  }

  // 한 번에 묶어 반환(playground computeStats 대응)
  function stats(shape) {
    var sh = normalize(shape);
    var N = sh.cells.size, r = revealed(sh);
    var exposed = 2 * (r.up + r.front + r.side);
    var pairs = (6 * N - exposed) / 2;
    return {
      count: N,
      volume: N * sh.edge * sh.edge * sh.edge,
      touchingPairs: pairs,
      up: r.up, front: r.front, side: r.side,
      exposedFaces: exposed,
      surfaceArea: exposed * sh.edge * sh.edge
    };
  }

  // ================= 4.3 투상 (모양 → 그림) =================
  // (a) 위에서 본 높이 지도: 각 (x,z)의 최고 높이(쌓인 층 수). 개수가 유일하게 확정.
  function heightMap(shape) {
    var cells = toCellSet(shape.cells), map = {}; // "x,z" -> height
    cells.forEach(function (k) {
      var c = parse(k), key = c.x + ',' + c.z, h = c.y + 1;
      if (!(key in map) || h > map[key]) map[key] = h;
    });
    return map;
  }
  // 앞 실루엣 높이(열 x별 최고), 옆 실루엣 높이(행 z별 최고)
  function viewHeights(shape) {
    var cells = toCellSet(shape.cells), front = {}, side = {};
    cells.forEach(function (k) {
      var c = parse(k), h = c.y + 1;
      if (!(c.x in front) || h > front[c.x]) front[c.x] = h;
      if (!(c.z in side) || h > side[c.z]) side[c.z] = h;
    });
    return { front: front, side: side };
  }

  // (b) 세 방향 실루엣(불리언). 위=XZ("x,z"), 앞=XY("x,y"), 옆=ZY("z,y").
  function silhouettes(shape) {
    var cells = toCellSet(shape.cells), top = new Set(), front = new Set(), side = new Set();
    cells.forEach(function (k) {
      var c = parse(k);
      top.add(c.x + ',' + c.z);
      front.add(c.x + ',' + c.y);
      side.add(c.z + ',' + c.y);
    });
    return { top: top, front: front, side: side };
  }

  // ================= 4.4 역방향 (제약 → 모양 집합): 최대·최소·은면 =================
  // 입력은 '세 뷰': 위 발자국(footprint) + 앞높이(front[x]) + 옆높이(side[z]).
  // 마스터 4.4: 중력 준수(높이지도 모델). 최대=Σ min(앞,옆), 최소=덮개 최적화(결정 2, 값은 유일).

  // 이분 최대 매칭(Kuhn) — adj[i] = 왼쪽 i가 닿는 오른쪽 인덱스 목록
  function maxMatching(adj, nRight) {
    var matchR = new Array(nRight).fill(-1), result = 0;
    function tryK(u, seen) {
      for (var j = 0; j < adj[u].length; j++) {
        var v = adj[u][j];
        if (!seen[v]) {
          seen[v] = true;
          if (matchR[v] === -1 || tryK(matchR[v], seen)) { matchR[v] = u; return true; }
        }
      }
      return false;
    }
    for (var u = 0; u < adj.length; u++) { if (tryK(u, new Array(nRight).fill(false))) result++; }
    return result;
  }

  // 뷰만으로 최소·최대·은면 계산
  //   views = { footprint: Set<"x,z">|Array, front: {x:h}, side: {z:h} }
  function reverseCountsFromViews(views) {
    var fp = toCellSet(views.footprint); // "x,z"
    var front = views.front, side = views.side;
    var Fcount = fp.size;

    // 최대: 각 (x,z)에서 min(앞[x], 옆[z])
    var maxCount = 0;
    fp.forEach(function (k) { var p = k.split(',').map(Number); maxCount += Math.min(front[p[0]], side[p[1]]); });

    // 최소: 봉우리(≥2)를 실현하는 데 필요한 최소 추가 높이.
    //   독립 비용 = Σ(앞[x]-1) + Σ(옆[z]-1). 같은 높이 v의 열-봉우리·행-봉우리를 (x,z)∈F에서
    //   한 칸으로 겹쳐 실현하면 (v-1)씩 절약 → 높이값 v별 이분 최대 매칭으로 절약 최대화.
    var Xp = Object.keys(front).map(Number).filter(function (x) { return front[x] >= 2; });
    var Zp = Object.keys(side).map(Number).filter(function (z) { return side[z] >= 2; });
    var indep = 0;
    Xp.forEach(function (x) { indep += front[x] - 1; });
    Zp.forEach(function (z) { indep += side[z] - 1; });

    var values = {};
    Xp.forEach(function (x) { values[front[x]] = true; });
    Zp.forEach(function (z) { values[side[z]] = true; });
    var savings = 0;
    Object.keys(values).map(Number).forEach(function (v) {
      var xs = Xp.filter(function (x) { return front[x] === v; });
      var zs = Zp.filter(function (z) { return side[z] === v; });
      var zIndex = {}; zs.forEach(function (z, i) { zIndex[z] = i; });
      var adj = xs.map(function (x) {
        var row = [];
        zs.forEach(function (z) { if (fp.has(x + ',' + z)) row.push(zIndex[z]); });
        return row;
      });
      savings += (v - 1) * maxMatching(adj, zs.length);
    });

    var minCount = Fcount + (indep - savings);
    return { minCount: minCount, maxCount: maxCount, hidden: maxCount - minCount, footprint: Fcount };
  }

  // 실제 모양에서 세 뷰를 뽑아 최소·최대·은면 계산(편의)
  function reverseCounts(shape) {
    var hv = viewHeights(shape), sil = silhouettes(shape);
    return reverseCountsFromViews({ footprint: sil.top, front: hv.front, side: hv.side });
  }

  // 매칭 결과(오른쪽→왼쪽 인덱스)를 반환하는 변형 — 최소 모양 재구성용
  function maxMatchingPairs(adj, nRight) {
    var matchR = new Array(nRight).fill(-1);
    function tryK(u, seen) {
      for (var j = 0; j < adj[u].length; j++) {
        var v = adj[u][j];
        if (!seen[v]) { seen[v] = true; if (matchR[v] === -1 || tryK(matchR[v], seen)) { matchR[v] = u; return true; } }
      }
      return false;
    }
    for (var u = 0; u < adj.length; u++) tryK(u, new Array(nRight).fill(false));
    return matchR;
  }

  // 뷰 → 최소·최대 실제 높이지도. { min:{"x,z":h}, max:{"x,z":h} }
  //   max: h(x,z)=min(앞[x],옆[z]). min: 봉우리를 겹쳐 실현(매칭 해)한 최소 배치.
  function reverseShapesFromViews(views) {
    var fp = toCellSet(views.footprint), front = views.front, side = views.side;
    var max = {}, min = {};
    fp.forEach(function (k) { var p = k.split(',').map(Number); max[k] = Math.min(front[p[0]], side[p[1]]); min[k] = 1; });

    // 행/열별 셀 목록
    var rows = {}, cols = {};
    fp.forEach(function (k) { var p = k.split(',').map(Number); (rows[p[0]] = rows[p[0]] || []).push(p[1]); (cols[p[1]] = cols[p[1]] || []).push(p[0]); });

    var Xp = Object.keys(front).map(Number).filter(function (x) { return front[x] >= 2; });
    var Zp = Object.keys(side).map(Number).filter(function (z) { return side[z] >= 2; });
    var coveredX = {}, coveredZ = {};

    // 높이값 v별 이분 매칭 → 매칭된 (x,z)를 v로 세팅(봉우리 둘 동시 실현)
    var values = {};
    Xp.forEach(function (x) { values[front[x]] = true; });
    Zp.forEach(function (z) { values[side[z]] = true; });
    Object.keys(values).map(Number).forEach(function (v) {
      var xs = Xp.filter(function (x) { return front[x] === v; });
      var zs = Zp.filter(function (z) { return side[z] === v; });
      var zIndex = {}; zs.forEach(function (z, i) { zIndex[z] = i; });
      var adj = xs.map(function (x) { var row = []; zs.forEach(function (z) { if (fp.has(x + ',' + z)) row.push(zIndex[z]); }); return row; });
      var matchR = maxMatchingPairs(adj, zs.length);
      for (var zi = 0; zi < matchR.length; zi++) {
        if (matchR[zi] !== -1) {
          var x = xs[matchR[zi]], z = zs[zi];
          min[x + ',' + z] = v; coveredX[x] = true; coveredZ[z] = true;
        }
      }
    });

    // 남은 열-봉우리: 같은 행에서 옆[z']≥앞[x]인 칸을 앞[x]로
    Xp.forEach(function (x) {
      if (coveredX[x]) return;
      var list = rows[x] || [];
      for (var i = 0; i < list.length; i++) { var z = list[i]; if (side[z] >= front[x]) { min[x + ',' + z] = Math.max(min[x + ',' + z] || 1, front[x]); coveredX[x] = true; break; } }
    });
    // 남은 행-봉우리: 같은 열에서 앞[x']≥옆[z]인 칸을 옆[z]로
    Zp.forEach(function (z) {
      if (coveredZ[z]) return;
      var list = cols[z] || [];
      for (var i = 0; i < list.length; i++) { var x = list[i]; if (front[x] >= side[z]) { min[x + ',' + z] = Math.max(min[x + ',' + z] || 1, side[z]); coveredZ[z] = true; break; } }
    });

    return { min: min, max: max };
  }
  function reverseShapes(shape) {
    var hv = viewHeights(shape), sil = silhouettes(shape);
    return reverseShapesFromViews({ footprint: sil.top, front: hv.front, side: hv.side });
  }
  // 최대 개수만(하위호환)
  function maxCount(shape) { return reverseCounts(shape).maxCount; }

  // ================= F5 문제 스키마 (마스터 4.5) =================
  // problem = { shape?(직렬화), givens, ask, answer, reveal }  ·  set = { meta, problems[] }
  // 코어는 스키마 팩토리·검증만 제공(값·판정은 위 함수들). 모듈 간 스키마 단일 출처.
  var ASKS = ['count', 'volume', 'surface', 'min', 'max', 'build', 'project'];
  function makeProblem(p) {
    p = p || {};
    return {
      shape: (p.shape != null ? p.shape : null), // 4.1 직렬화 문자열 권장(순수 유지)
      givens: (p.givens != null ? p.givens : null),
      ask: (p.ask != null ? p.ask : null),
      answer: (p.answer != null ? p.answer : null),
      reveal: (p.reveal != null ? p.reveal : null)
    };
  }
  function makeSet(s) {
    s = s || {};
    return { meta: (s.meta || {}), problems: (s.problems || []).map(makeProblem) };
  }
  function validateProblem(p) {
    var errs = [];
    if (!p || typeof p !== 'object') return ['problem is not an object'];
    if (p.ask == null) errs.push('ask 누락');
    else if (ASKS.indexOf(p.ask) < 0) errs.push('알 수 없는 ask: ' + p.ask);
    if (p.shape != null && typeof p.shape === 'string' && deserialize(p.shape) === null) errs.push('shape 직렬화 무효');
    if (p.answer == null) errs.push('answer 누락');
    return errs; // 빈 배열이면 유효
  }
  var schema = { ASKS: ASKS, makeProblem: makeProblem, makeSet: makeSet, validateProblem: validateProblem };

  var core = {
    VERSION: VERSION, SER_VER: SER_VER,
    // helpers
    normalize: normalize, toCellSet: toCellSet, key: K,
    // 4.1
    serialize: serialize, deserialize: deserialize,
    // 4.1b (선택 마스크 ?h= — 비트 index 수식을 소비처에 복제하지 말 것)
    cellOrder: cellOrder, serializeMarks: serializeMarks, deserializeMarks: deserializeMarks,
    // 4.2
    count: count, volume: volume, touchingPairs: touchingPairs,
    revealed: revealed, exposedFaces: exposedFaces, surfaceArea: surfaceArea, stats: stats,
    // 4.3
    heightMap: heightMap, viewHeights: viewHeights, silhouettes: silhouettes,
    // 4.4 (역방향: 최대·최소·은면)
    reverseCounts: reverseCounts, reverseCountsFromViews: reverseCountsFromViews, maxCount: maxCount,
    reverseShapes: reverseShapes, reverseShapesFromViews: reverseShapesFromViews,
    // F5 (문제 스키마)
    schema: schema
  };

  // 전역 네임스페이스(잠정) + CommonJS(테스트용) 동시 노출
  global.CubeNest = global.CubeNest || {};
  global.CubeNest.core = core;
  if (typeof module !== 'undefined' && module.exports) module.exports = core;

})(typeof globalThis !== 'undefined' ? globalThis : this);


// [서버 전용] ESM named export (원본 IIFE 실행 후 노출; 브라우저 원본은 assets/js/ 것 사용)
export const core = globalThis.CubeNest.core;
