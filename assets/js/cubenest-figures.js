/*!
 * cubenest-figures.js — 문제 제시물(도형) SVG 렌더러 공용 모듈
 * 버전: 0.1.0  ·  의존성 없음(순수 문자열 생성). 겨냥도는 cubenest-iso 소관.
 *
 * 목적: quiz/run 이 인라인으로 갖고 있던 실루엣·삼면도·위에서 본 수·층별 렌더러를 승격한다.
 *       worksheets(문제지)가 같은 그림을 그려야 하는데 재구현하면 두 곳이 표류한다(마스터 §8.1).
 *
 * 핵심 진입점은 renderGiven(given) — 서버가 준 제시물(given)을 종류별로 알아서 그린다.
 *   given.kind = sils · numTop · layers · topOneSil · isoTop · isoMark · paintedCube
 *   isoTop/isoMark/paintedCube 의 겨냥도는 **서버가 이미 SVG 로 그려 보낸 것**을 그대로 쓴다
 *   (정답 은닉 — 마스터 §6.7). 클라가 모양으로 다시 그리면 전제가 깨진다.
 *
 * 색: CSS 변수(tokens.css)를 쓰므로 이 SVG 를 넣는 문서에 tokens.css 가 있어야 한다.
 */
(function (global) {
  'use strict';

  var VERSION = '0.1.0';
  var B = '#3f8fd0', G = '#4fae72', R = '#d0546f';   // 위·앞·옆 방향색

  // ── 방향별 실루엣: 앞=x별 max_z, 옆=z별 max_x(막대) / 위=발자국(격자) ──
  function frontSil(sh) { var a = [], x, z, m; for (x = 0; x < sh.gx; x++) { m = 0; for (z = 0; z < sh.gz; z++) m = Math.max(m, sh.hmap[x][z]); a.push(m); } return { t: 'bars', a: a, rows: Math.max.apply(null, a.concat([1])) }; }
  function sideSil(sh) { var a = [], x, z, m; for (z = 0; z < sh.gz; z++) { m = 0; for (x = 0; x < sh.gx; x++) m = Math.max(m, sh.hmap[x][z]); a.push(m); } a.reverse(); return { t: 'bars', a: a, rows: Math.max.apply(null, a.concat([1])) }; }
  function topSil(sh) { var g = [], x, z, row; for (z = 0; z < sh.gz; z++) { row = []; for (x = 0; x < sh.gx; x++) row.push(sh.hmap[x][z] > 0); g.push(row); } return { t: 'grid', g: g, cols: sh.gx, rows: sh.gz }; }
  function silsOf(sh) { return { top: topSil(sh), front: frontSil(sh), side: sideSil(sh) }; }

  // 실루엣(막대/격자)을 88×88 균일 박스에 중앙 배치 → 어떤 형태든 레이아웃이 일정하다
  function renderSil(sil, color) {
    var cols = sil.t === 'bars' ? sil.a.length : sil.cols, rows = sil.rows;
    var box = 88, pad = 8, avail = box - pad * 2, s = Math.min(avail / cols, avail / rows, 20);
    var gw = cols * s, gh = rows * s, ox = (box - gw) / 2, oy = (box - gh) / 2, gap = 1;
    var cell = function (cx, cy, on) {
      return '<rect x="' + (cx + gap / 2).toFixed(1) + '" y="' + (cy + gap / 2).toFixed(1) +
        '" width="' + (s - gap).toFixed(1) + '" height="' + (s - gap).toFixed(1) +
        '" rx="2.5" fill="' + (on ? (color || 'var(--accent)') : 'var(--line-2)') + '"/>';
    };
    var r = '', x, y, z;
    if (sil.t === 'bars') { for (x = 0; x < cols; x++) for (y = 0; y < rows; y++) r += cell(ox + x * s, oy + (rows - 1 - y) * s, y < sil.a[x]); }
    else { for (z = 0; z < sil.rows; z++) for (x = 0; x < sil.cols; x++) r += cell(ox + x * s, oy + z * s, sil.g[z][x]); }
    return '<svg viewBox="0 0 ' + box + ' ' + box + '" xmlns="http://www.w3.org/2000/svg">' + r + '</svg>';
  }

  function pv(inner, label) { return '<div class="pv">' + inner + '<span>' + label + '</span></div>'; }
  function renderThreeViews(sils) {
    return '<div class="threeviews">' + pv(renderSil(sils.top, B), '위') + pv(renderSil(sils.front, G), '앞') + pv(renderSil(sils.side, R), '옆') + '</div>';
  }

  // 위에서 본 수(각 칸 높이) 격자. hit = Set<"x,z"> 를 주면 그 칸을 초록으로 강조.
  function renderTopNums(sh, hit) {
    var s = 26, g = 3, W = sh.gx * (s + g) + g, H = sh.gz * (s + g) + g, r = '', x, z;
    for (z = 0; z < sh.gz; z++) for (x = 0; x < sh.gx; x++) {
      var h = sh.hmap[x][z], X = g + x * (s + g), Y = g + z * (s + g);
      var on = !!(hit && hit.has(x + ',' + z));
      var fill = h > 0 ? (on ? 'var(--add-soft)' : 'var(--accent-soft)') : 'var(--line-2)';
      var stroke = h > 0 ? (on ? 'var(--add)' : 'var(--accent)') : null;
      r += '<rect x="' + X + '" y="' + Y + '" width="' + s + '" height="' + s + '" rx="4" fill="' + fill + '"' +
        (stroke ? ' stroke="' + stroke + '" stroke-width="' + (on ? 2 : 1) + '"' : '') + '/>';
      if (h > 0) r += '<text x="' + (X + s / 2) + '" y="' + (Y + s / 2 + 0.5) + '" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="800" fill="' + (on ? '#0b6e3e' : 'var(--accent-ink)') + '">' + h + '</text>';
    }
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" xmlns="http://www.w3.org/2000/svg">' + r + '</svg>';
  }

  // 층별 모양(1층·2층·…)
  function renderLayers(sh) {
    var s = 22, g = 2, W = sh.gx * (s + g) + g, H = sh.gz * (s + g) + g, panels = '', y, x, z;
    for (y = 0; y < sh.maxH; y++) {
      var any = false, cells = '';
      for (z = 0; z < sh.gz; z++) for (x = 0; x < sh.gx; x++) {
        var on = sh.hmap[x][z] > y; if (on) any = true;
        var X = g + x * (s + g), Y = g + z * (s + g);
        cells += '<rect x="' + X + '" y="' + Y + '" width="' + s + '" height="' + s + '" rx="3" fill="' + (on ? 'var(--accent-soft)' : 'var(--line-2)') + '"' + (on ? ' stroke="var(--accent)" stroke-width="1"' : '') + '/>';
      }
      if (!any && y > 0) continue;
      panels += pv('<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">' + cells + '</svg>', (y + 1) + '층');
    }
    return '<div class="threeviews">' + panels + '</div>';
  }

  // 위·앞·옆 그리기 격자의 칸 수(행 수 = 등급 maxH — 실제 높이로 그리면 정답이 새어나간다)
  function drawDims(sh) { return { H: sh.maxH, top: { cols: sh.gx, rows: sh.gz }, front: { cols: sh.gx, rows: sh.maxH }, side: { cols: sh.gz, rows: sh.maxH } }; }
  // 삼면도 격자(비대화형). filled = Set<"view,c,r"> 를 주면 그 칸을 칠한다 —
  //   drawSil 정답은 answerKey.cells 가 바로 그 형식이라, 모양이 없어도 정답 그림을 그릴 수 있다
  //   (H-a/H-b 처럼 클라가 '조작 후 모양'을 모르는 경우에 이 경로가 필요하다).
  function renderDrawGrids(sh, cell, filled) {
    var d = drawDims(sh), px = cell || 18;
    var grid = function (view, cols, rows, label) {
      var c = '', r, x;
      for (r = 0; r < rows; r++) for (x = 0; x < cols; x++)
        c += '<div class="dcell' + (filled && filled.has(view + ',' + x + ',' + r) ? ' on' : '') + '"></div>';
      return '<div class="dview"><div class="dgrid" style="grid-template-columns:repeat(' + cols + ',' + px + 'px)">' + c + '</div><span>' + label + '</span></div>';
    };
    return '<div class="draw">' + grid('top', d.top.cols, d.top.rows, '위') + grid('front', d.front.cols, d.front.rows, '앞') + grid('side', d.side.cols, d.side.rows, '옆') + '</div>';
  }

  // ── 서버가 준 제시물(given) → 렌더용 모양 ──
  //   ⚠ isoTop·isoMark·sils 는 '발자국'까지만 알 수 있다. 숨은 열의 높이는 의도적으로
  //     전송되지 않으므로 높이를 1 로 채운 부분 정보다(_partial). 개수·겉넓이 계산에 쓰면 안 된다.
  function shapeFromGiven(g) {
    var gx = g.gx, gz = g.gz, hmap = [], x, z, k, p;
    for (x = 0; x < gx; x++) { hmap.push([]); for (z = 0; z < gz; z++) hmap[x].push(0); }
    var foot = function (t) { for (var zz = 0; zz < t.rows; zz++) for (var xx = 0; xx < t.cols; xx++) if (t.g[zz][xx]) hmap[xx][zz] = 1; };
    if (g.kind === 'numTop') { for (k in g.heights) { p = k.split(','); hmap[+p[0]][+p[1]] = g.heights[k]; } }
    else if (g.kind === 'layers') { (g.layers || []).forEach(function (cs) { cs.forEach(function (kk) { p = kk.split(','); hmap[+p[0]][+p[1]]++; }); }); }
    else if (g.kind === 'isoTop' && g.top) foot(g.top);
    else if (g.kind === 'topOneSil' && g.top) foot(g.top);
    else if (g.kind === 'sils' && g.sils) foot(g.sils.top);
    var maxH = 0, cells = [], y;
    for (x = 0; x < gx; x++) for (z = 0; z < gz; z++) { var h = hmap[x][z]; if (h > maxH) maxH = h; for (y = 0; y < h; y++) cells.push({ x: x, y: y, z: z }); }
    var partial = g.kind === 'isoTop' || g.kind === 'isoMark' || g.kind === 'sils' || g.kind === 'topOneSil';
    return { gx: gx, gz: gz, maxH: g.maxH || Math.max(1, maxH), hmap: hmap, cells: cells, edge: 1, _partial: partial };
  }

  // ── 제시물 그림 (종류별) ──
  //   opts.caption = 그림 아래 안내 문구(HTML 허용). 없으면 그림만.
  function renderGiven(g, opts) {
    opts = opts || {};
    var body = '';
    if (!g) return '';
    if (g.kind === 'sils') body = renderThreeViews(g.sils);
    else if (g.kind === 'numTop') body = renderTopNums(shapeFromGiven(g));
    else if (g.kind === 'layers') body = renderLayers(shapeFromGiven(g));
    else if (g.kind === 'topOneSil') {
      var side = g.dir === 'side';
      body = '<div class="threeviews">' + pv(renderSil(g.top, B), '위') + pv(renderSil(g.bars, side ? R : G), side ? '옆' : '앞') + '</div>';
    }
    else if (g.kind === 'isoTop') body = '<div class="isofig">' + (g.iso || '') + '</div>' + (g.top ? pv(renderSil(g.top, B), '위에서 본 모양') : '');
    else if (g.kind === 'isoMark' || g.kind === 'paintedCube') body = '<div class="isofig">' + (g.iso || '') + '</div>';
    var cap = opts.caption ? '<div class="rotcap">' + opts.caption + '</div>' : '';
    return '<div class="viewer">' + body + cap + '</div>';
  }

  var API = {
    VERSION: VERSION,
    frontSil: frontSil, sideSil: sideSil, topSil: topSil, silsOf: silsOf,
    renderSil: renderSil, renderThreeViews: renderThreeViews,
    renderTopNums: renderTopNums, renderLayers: renderLayers,
    drawDims: drawDims, renderDrawGrids: renderDrawGrids,
    shapeFromGiven: shapeFromGiven, renderGiven: renderGiven
  };
  global.CubeNest = global.CubeNest || {};
  global.CubeNest.figures = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

})(typeof globalThis !== 'undefined' ? globalThis : this);
