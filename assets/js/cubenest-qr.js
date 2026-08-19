/*!
 * cubenest-qr.js — QR 코드 SVG 렌더러 (CubeNest 공용 모듈)
 * 버전: 0.2.0 · 의존: assets/js/vendor/qrcode-generator.js (먼저 로드) · UMD
 *
 * 역할 분담
 *   인코딩(비트·RS·마스킹) = vendor/qrcode-generator.js  ← Kazuhiko Arase, MIT
 *   SVG 그리기             = 이 파일
 *
 * ⚠ 인코더를 직접 구현하지 않는다. 한 번 시도했다가 독립 디코더(jsQR) 왕복 검증에서
 *   5/5 전부 스캔 실패했다 — 마스킹·포맷정보·버전정보가 조금만 어긋나도 조용히 안 읽힌다.
 *   인쇄물의 QR 은 스캔이 안 되면 그냥 잉크 낭비라, 검증된 구현을 쓰는 편이 옳다.
 *
 * 왜 SVG 인가: 문제지는 인쇄물이다. 래스터로 그리면 확대·축소에서 모서리가 뭉개져
 *   스캔 실패율이 오른다. SVG 는 프린터 해상도로 그대로 나간다(shape-rendering=crispEdges).
 *
 * API
 *   svg(text, opts) → "<svg …>"
 *     opts.size   = 한 변 px (기본 96)
 *     opts.margin = quiet zone 모듈 수 (기본 4 — 규격 최소값. 줄이면 스캔이 불안정해진다)
 *     opts.dark / opts.light  (light:null = 투명)
 *     opts.ec     = 'L'|'M'|'Q'|'H' (기본 'M')
 *   modules(text, ec) → [[bool…]…]
 */
(function (global) {
  'use strict';
  var VERSION = '0.2.0';

  function gen() {
    var q = global.qrcode || (typeof require === 'function' ? require('./vendor/qrcode-generator.js') : null);
    if (!q) throw new Error('cubenest-qr: vendor/qrcode-generator.js 를 먼저 로드하세요');
    return q;
  }

  function modules(text, ec) {
    var q = gen()(0, ec || 'M');       // 0 = 버전 자동 선택
    q.addData(String(text), 'Byte');   // URL 이라 Byte 모드 고정(한글 섞여도 안전)
    q.make();
    var n = q.getModuleCount(), m = [], y, x;
    for (y = 0; y < n; y++) { var row = []; for (x = 0; x < n; x++) row.push(q.isDark(y, x)); m.push(row); }
    return m;
  }

  function svg(text, opts) {
    opts = opts || {};
    var m = modules(text, opts.ec), n = m.length;
    var margin = opts.margin == null ? 4 : opts.margin;
    var total = n + margin * 2, size = opts.size || 96;
    var dark = opts.dark || '#111';
    var light = opts.light === null ? null : (opts.light || '#fff');
    // 가로로 이어진 모듈을 한 사각형으로 묶는다 — path 노드 수가 1/3 로 줄어 인쇄가 가볍다.
    var d = '', x, y;
    for (y = 0; y < n; y++) {
      x = 0;
      while (x < n) {
        if (!m[y][x]) { x++; continue; }
        var run = 1; while (x + run < n && m[y][x + run]) run++;
        d += 'M' + (x + margin) + ' ' + (y + margin) + 'h' + run + 'v1h-' + run + 'z';
        x += run;
      }
    }
    return '<svg viewBox="0 0 ' + total + ' ' + total + '" width="' + size + '" height="' + size +
           '" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" role="img"' +
           ' aria-label="QR 코드 — 휴대폰으로 스캔하면 이 문제를 화면에서 돌려볼 수 있어요">' +
           (light ? '<rect width="' + total + '" height="' + total + '" fill="' + light + '"/>' : '') +
           '<path d="' + d + '" fill="' + dark + '"/></svg>';
  }

  var API = { VERSION: VERSION, svg: svg, modules: modules };
  global.CubeNest = global.CubeNest || {};
  global.CubeNest.qr = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

})(typeof globalThis !== 'undefined' ? globalThis : this);
