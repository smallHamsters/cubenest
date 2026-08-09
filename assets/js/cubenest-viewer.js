/*!
 * cubenest-viewer.js — CubeNest 공용 3D 뷰어 모듈 (마스터 §5.1)
 * 버전: 0.1.0  ·  의존: THREE(런타임 주입) + CubeNest.core(silhouettes)
 *
 * 목적: playground/quiz/worksheets가 3D 뷰어·펼쳐보기를 "복사"가 아니라 참조하도록.
 *   - core는 먼저 로드되어야 한다(§5.1). viewer는 core.silhouettes를 쓴다.
 *
 * 범위(v0.1.0): 위·앞·옆 펼쳐보기(삼투상/육투상) 투상 빌더.
 *   buildExplodedProjections(THREE, group, shape, opts) → { center, radius, labels }
 *   - group(THREE.Group)에 격자(답안지)+실루엣 색칠+점선 연결선+라벨을 채운다.
 *   - 회전축(center)·프레이밍 반경(radius)을 분석적으로 계산해 반환.
 *   (오빗 관찰 뷰어 팩토리는 v0.2.0에서 추가 예정.)
 *
 * 좌표: 단위 셀(한 칸=1). 위=+y, 앞=+z, 옆(오른쪽)=+x. iy=0=바닥.
 */
(function (global) {
  'use strict';

  var VERSION = '0.2.3';
  var S = 1; // 단위 셀 크기

  function coreRef() {
    var c = global.CubeNest && global.CubeNest.core;
    if (!c) throw new Error('cubenest-viewer: CubeNest.core 가 먼저 로드되어야 합니다(§5.1).');
    return c;
  }

  // 간단한 캔버스 라벨 텍스처(폴백). 호출부가 opts.makeLabelTexture를 주면 그걸 우선 사용.
  // 라벨 평면 종횡비(가로:세로) — 텍스처도 같은 비율로 만들어 글자 왜곡 방지
  var LABEL_ASPECT = 1.6;
  function defaultLabelTexture(THREE, text, hex) {
    var W = 160, H = Math.round(W / LABEL_ASPECT);   // 160x100 (1.6:1)
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    g.fillStyle = hex; g.font = '800 ' + Math.round(H * 0.62) + 'px sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, W / 2, H / 2 + 2);
    var t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
  }

  /*
   * THREE: 주입된 three 네임스페이스
   * group: 채울 THREE.Group (기존 자식은 dispose 후 비움)
   * shape: { gx, gy, gz, cells:Set<"x,y,z">|Array }
   * opts:
   *   gap        (기본 3.6)  물체↔패널 간격
   *   explode6   (기본 false) 6면(육투상) 여부
   *   soloAxis   (기본 null)  null|'x'|'y'|'z' — 그 축만 표시
   *   colors     {top,front,side} hex 숫자 (기본 파랑/초록/빨강)
   *   showLabels (기본 true)
   *   makeLabelTexture(text, hex) → THREE.Texture (없으면 내부 폴백)
   *   primaryLabels — (v0.2.3부터 미사용) 만들어진 면의 라벨은 모두 표시
   *   labels     {top,bottom,front,back,right,left} (기본 위/아래/앞/뒤/옆/왼쪽)
   */
  function buildExplodedProjections(THREE, group, shape, opts) {
    opts = opts || {};
    var core = coreRef();
    var gap = (opts.gap == null ? 3.6 : opts.gap);
    var explode6 = !!opts.explode6;
    var soloAxis = (opts.soloAxis == null ? null : opts.soloAxis);
    var COL = opts.colors || { top: 0x3f8fd0, front: 0x4fae72, side: 0xd0546f };
    var showLabels = (opts.showLabels !== false);
    var primary = opts.primaryLabels || ['위', '앞', '옆'];
    var LBL = opts.labels || { top: '위', bottom: '아래', front: '앞', back: '뒤', right: '옆', left: '왼쪽' };
    var mkTex = opts.makeLabelTexture || function (text, hex) { return defaultLabelTexture(THREE, text, hex); };

    var gx = shape.gx, gy = shape.gy, gz = shape.gz;
    var cells = core.toCellSet(shape.cells);
    var labels = [];

    // ----- group 비우기(dispose) -----
    for (var i = group.children.length - 1; i >= 0; i--) {
      var o = group.children[i];
      if (o.geometry) o.geometry.dispose();
      if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
      group.remove(o);
    }
    var center = new THREE.Vector3(0, gy * S / 2, 0);
    if (cells.size === 0) return { center: center, radius: 0, labels: labels };

    // ----- 경계 추적(분석적) -----
    var mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    function expand(x, y, z) {
      if (x < mn[0]) mn[0] = x; if (x > mx[0]) mx[0] = x;
      if (y < mn[1]) mn[1] = y; if (y > mx[1]) mx[1] = y;
      if (z < mn[2]) mn[2] = z; if (z > mx[2]) mx[2] = z;
    }
    // 모델 박스
    expand(-gx * S / 2, 0, -gz * S / 2); expand(gx * S / 2, gy * S, gz * S / 2);

    function pcellX(x) { return (x - (gx - 1) / 2) * S; }
    function pcellY(y) { return (y + 0.5) * S; }
    function pcellZ(z) { return (z - (gz - 1) / 2) * S; }
    function V(x, y, z) { return new THREE.Vector3(x, y, z); }

    var sil = core.silhouettes({ gx: gx, gy: gy, gz: gz, cells: cells });

    // 채운 실루엣 셀 → 색 사각형(+테두리)
    var _pc = new THREE.Vector3();
    function buildPanel(cellsSet, centerFn, uAxis, vAxis, colorHex) {
      var half = 0.46, uu = uAxis.clone().multiplyScalar(half), vv = vAxis.clone().multiplyScalar(half);
      var pos = [], idx = [], ln = [], vb = 0;
      cellsSet.forEach(function (key) {
        centerFn(key, _pc);
        var a = _pc.clone().sub(uu).sub(vv), b = _pc.clone().add(uu).sub(vv),
            c = _pc.clone().add(uu).add(vv), d = _pc.clone().sub(uu).add(vv);
        pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z);
        idx.push(vb, vb + 1, vb + 2, vb, vb + 2, vb + 3);
        ln.push(a.x, a.y, a.z, b.x, b.y, b.z, b.x, b.y, b.z, c.x, c.y, c.z, c.x, c.y, c.z, d.x, d.y, d.z, d.x, d.y, d.z, a.x, a.y, a.z);
        vb += 4;
      });
      var fg = new THREE.BufferGeometry();
      fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setIndex(idx);
      group.add(new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })));
      var lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.Float32BufferAttribute(ln, 3));
      group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: colorHex })));
    }
    function dashed(pairs, colorHex) {
      var pos = [];
      pairs.forEach(function (pr) { pos.push(pr[0].x, pr[0].y, pr[0].z, pr[1].x, pr[1].y, pr[1].z); });
      var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      var ls = new THREE.LineSegments(g, new THREE.LineDashedMaterial({ color: colorHex, transparent: true, opacity: 0.5, dashSize: 0.3, gapSize: 0.22 }));
      ls.computeLineDistances(); group.add(ls);
    }
    // axis 크기의 전체 격자(답안지). 격자 사각형 모서리로 경계도 확장.
    function buildGridLines(origin, uAxis, vAxis, uN, vN, colorHex) {
      var pos = [], i;
      for (i = 0; i <= uN; i++) {
        var ax = origin.x + uAxis.x * i * S, ay = origin.y + uAxis.y * i * S, az = origin.z + uAxis.z * i * S;
        pos.push(ax, ay, az, ax + vAxis.x * vN * S, ay + vAxis.y * vN * S, az + vAxis.z * vN * S);
      }
      for (var j = 0; j <= vN; j++) {
        var bx = origin.x + vAxis.x * j * S, by = origin.y + vAxis.y * j * S, bz = origin.z + vAxis.z * j * S;
        pos.push(bx, by, bz, bx + uAxis.x * uN * S, by + uAxis.y * uN * S, bz + uAxis.z * uN * S);
      }
      var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      group.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.35 })));
      // 격자 네 모서리로 경계 확장
      expand(origin.x, origin.y, origin.z);
      expand(origin.x + uAxis.x * uN, origin.y + uAxis.y * uN, origin.z + uAxis.z * uN);
      expand(origin.x + vAxis.x * vN, origin.y + vAxis.y * vN, origin.z + vAxis.z * vN);
      expand(origin.x + uAxis.x * uN + vAxis.x * vN, origin.y + uAxis.y * uN + vAxis.y * vN, origin.z + uAxis.z * uN + vAxis.z * vN);
    }
    function addLabel(text, colorHex, x, y, z) {
      if (!showLabels) return;
      var hex = '#' + colorHex.toString(16).padStart ? '#' + colorHex.toString(16).padStart(6, '0') : '#' + colorHex.toString(16);
      var m = new THREE.Mesh(new THREE.PlaneGeometry(1.28, 0.8),
        new THREE.MeshBasicMaterial({ map: mkTex(text, hex), transparent: true, depthWrite: false }));
      m.position.set(x, y, z);
      m.visible = true;   // 만들어진 면의 라벨은 모두 표시(육투상=6면 전부, 솔로=양쪽)
      group.add(m); labels.push(m);
      expand(x - 0.64, y - 0.4, z); expand(x + 0.64, y + 0.4, z);   // 라벨 평면 크기 반영(빌드 시점 바운딩)
    }

    var AX = V(1, 0, 0), AY = V(0, 1, 0), AZ = V(0, 0, 1);
    var yTop = gy * S + gap, yBot = -gap;
    var zF = gz * S / 2 + gap, zB = -(gz * S / 2 + gap);
    var xR = gx * S / 2 + gap, xL = -(gx * S / 2 + gap);
    var gXh = gx * S / 2, gZh = gz * S / 2, gYh = gy * S;

    function panelTop(yP, surfY, label) {
      buildGridLines(V(-gXh, yP, -gZh), AX, AZ, gx, gz, COL.top);
      buildPanel(sil.top, function (k, o) { var q = k.split(',').map(Number); o.set(pcellX(q[0]), yP, pcellZ(q[1])); }, AX, AZ, COL.top);
      var pr = [];[-gXh, gXh].forEach(function (X) {[-gZh, gZh].forEach(function (Z) { pr.push([V(X, surfY, Z), V(X, yP, Z)]); }); }); dashed(pr, COL.top);
      addLabel(label, COL.top, 0, yP + (yP >= surfY ? 0.9 : -0.9), 0);
    }
    function panelZ(zP, surfZ, label) {
      buildGridLines(V(-gXh, 0, zP), AX, AY, gx, gy, COL.front);
      buildPanel(sil.front, function (k, o) { var q = k.split(',').map(Number); o.set(pcellX(q[0]), pcellY(q[1]), zP); }, AX, AY, COL.front);
      var pr = [];[-gXh, gXh].forEach(function (X) {[0, gYh].forEach(function (Y) { pr.push([V(X, Y, surfZ), V(X, Y, zP)]); }); }); dashed(pr, COL.front);
      addLabel(label, COL.front, 0, -0.9, zP);
    }
    function panelX(xP, surfX, label) {
      buildGridLines(V(xP, 0, -gZh), AZ, AY, gz, gy, COL.side);
      buildPanel(sil.side, function (k, o) { var q = k.split(',').map(Number); o.set(xP, pcellY(q[1]), pcellZ(q[0])); }, AZ, AY, COL.side);
      var pr = [];[-gZh, gZh].forEach(function (Z) {[0, gYh].forEach(function (Y) { pr.push([V(surfX, Y, Z), V(xP, Y, Z)]); }); }); dashed(pr, COL.side);
      addLabel(label, COL.side, xP, -0.9, 0);
    }

    var sY = !soloAxis || soloAxis === 'y', sZ = !soloAxis || soloAxis === 'z', sX = !soloAxis || soloAxis === 'x';
    if (sY) { panelTop(yTop, gy * S, LBL.top); if (explode6) panelTop(yBot, 0, LBL.bottom); }
    if (sZ) { panelZ(zF, gz * S / 2, LBL.front); if (explode6) panelZ(zB, -gz * S / 2, LBL.back); }
    if (sX) { panelX(xR, gx * S / 2, LBL.right); if (explode6) panelX(xL, -gx * S / 2, LBL.left); }

    // 중심·반경(경계 상자에서)
    center.set((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2);
    var radius = 0;
    for (var b = 0; b < 8; b++) {
      var cx = (b & 1) ? mx[0] : mn[0], cy = (b & 2) ? mx[1] : mn[1], cz = (b & 4) ? mx[2] : mn[2];
      var dx = cx - center.x, dy = cy - center.y, dz = cz - center.z;
      var d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d > radius) radius = d;
    }
    return { center: center, radius: radius, labels: labels };
  }

  // ================= 관찰 뷰어 팩토리 (v0.2.0) =================
  // createViewer(container, opts) → controller
  //   opts: { THREE(주입|전역), shape, faceColors(면 축색), showLabels, background,
  //           editable(false), gap }
  //   controller: { setShape, setExplode, setExplode6, setSolo, reset, resize, dispose,
  //                 scene, camera, group, get radius }
  // playground의 검증된 카메라·좌표 수학을 그대로 포팅. 큐브는 관찰용 단순 메시.
  // ※ 실제 렌더는 WebGL — 소비자 브라우저에서 확인 필요.
  function createViewer(container, opts) {
    opts = opts || {};
    var THREE = opts.THREE || global.THREE;
    if (!THREE) throw new Error('cubenest-viewer.createViewer: THREE가 필요합니다(opts.THREE 또는 전역).');
    var core = coreRef();
    var FOV = 45, TAN = Math.tan(FOV * Math.PI / 180 / 2);
    var faceColors = !!opts.faceColors;
    var showLabels = (opts.showLabels !== false);
    var bg = (opts.background != null) ? opts.background : 0xe9eef4;
    var gap = (opts.gap == null ? 3.6 : opts.gap);

    var state = { gx: 3, gy: 3, gz: 3, edge: 1 };
    var cells = new Set();

    // ----- 렌더러/씬/조명/카메라 -----
    var canvas = document.createElement('canvas');
    canvas.style.width = '100%'; canvas.style.height = '100%'; canvas.style.display = 'block';
    container.appendChild(canvas);
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    var scene = new THREE.Scene(); scene.background = new THREE.Color(bg);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa7b5, 0.85));
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    var dl = new THREE.DirectionalLight(0xffffff, 0.7); dl.position.set(6, 11, 4); scene.add(dl);
    var cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);

    // ----- 큐브(관찰용 단순 메시) + 바닥 + 그룹 -----
    var cubeGroup = new THREE.Group(); scene.add(cubeGroup);
    var projGroup = new THREE.Group(); projGroup.visible = false; scene.add(projGroup);
    var boxGeo = new THREE.BoxGeometry(0.98, 0.98, 0.98);
    var edgeGeo = new THREE.EdgesGeometry(boxGeo);
    (function bake() {
      var cols = new Float32Array(24 * 3), _c = new THREE.Color(), FA = [0xd0546f, 0xd0546f, 0x3f8fd0, 0x3f8fd0, 0x4fae72, 0x4fae72];
      for (var f = 0; f < 6; f++) { _c.setHex(FA[f]); for (var v = 0; v < 4; v++) { var i = (f * 4 + v) * 3; cols[i] = _c.r; cols[i + 1] = _c.g; cols[i + 2] = _c.b; } }
      boxGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    })();
    var matWood = new THREE.MeshLambertMaterial({ color: 0xe4b878 });
    var matFace = new THREE.MeshLambertMaterial({ vertexColors: true });
    var edgeMat = new THREE.LineBasicMaterial({ color: 0x8a6a3c, transparent: true, opacity: 0.55 });
    // 특정 큐브 강조색(공용): 회전·펼쳐보기와 무관하게 유지
    var highlight = new Set((opts.highlightCells || []).map(function (c) { return Array.isArray(c) ? c.join(',') : String(c); }));
    var highlightColor = opts.highlightColor || '#e0455e';
    var matHi = new THREE.MeshLambertMaterial({ color: new THREE.Color(highlightColor) });
    var floor = null, floorGrid = null;

    function cellPos(x, y, z, o) { return o.set((x - (state.gx - 1) / 2) * S, (y + 0.5) * S, (z - (state.gz - 1) / 2) * S); }

    function clearGroup(g) {
      for (var i = g.children.length - 1; i >= 0; i--) {
        var o = g.children[i];
        if (o.geometry && o.geometry !== boxGeo && o.geometry !== edgeGeo) o.geometry.dispose();
        if (o.material && o.material !== matWood && o.material !== matFace && o.material !== edgeMat && o.material !== matHi) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
        g.remove(o);
      }
    }

    function rebuildCubes() {
      clearGroup(cubeGroup);
      var base = (faceColors || explodeOn) ? matFace : matWood, _p = new THREE.Vector3();
      cells.forEach(function (k) {
        var q = k.split(',').map(Number);
        var mat = highlight.has(k) ? matHi : base;
        var m = new THREE.Mesh(boxGeo, mat); cellPos(q[0], q[1], q[2], _p); m.position.copy(_p); cubeGroup.add(m);
        var e = new THREE.LineSegments(edgeGeo, edgeMat); e.position.copy(_p); cubeGroup.add(e);
      });
    }
    // 강조 큐브 지정/해제 (cells=[[x,y,z]...], color 선택). 없으면 해제.
    function setHighlight(hcells, color) {
      highlight = new Set((hcells || []).map(function (c) { return Array.isArray(c) ? c.join(',') : String(c); }));
      if (color && color !== highlightColor) { highlightColor = color; matHi.color = new THREE.Color(color); matHi.needsUpdate = true; }
      rebuildCubes();
    }

    function buildFloor() {
      if (floor) { cubeGroup.parent && scene.remove(floor); floor.geometry.dispose(); floor.material.dispose(); floor = null; }
      if (floorGrid) { scene.remove(floorGrid); floorGrid.geometry.dispose(); floorGrid.material.dispose(); floorGrid = null; }
      var gx = state.gx, gz = state.gz;
      var g = new THREE.PlaneGeometry(gx * S, gz * S);
      floor = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xdfe6ee }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = 0; scene.add(floor);
      // 격자선
      var pos = [];
      for (var i = 0; i <= gx; i++) { var x = -gx / 2 + i; pos.push(x, 0.001, -gz / 2, x, 0.001, gz / 2); }
      for (var j = 0; j <= gz; j++) { var z = -gz / 2 + j; pos.push(-gx / 2, 0.001, z, gx / 2, 0.001, z); }
      var lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      floorGrid = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xb8c4d2 })); scene.add(floorGrid);
    }

    // ----- 방향 라벨(위·앞·옆, 회전 시 카메라 향함) -----
    var dirLabels = [];
    function labelTex(text, hex) {
      if (opts.makeLabelTexture) return opts.makeLabelTexture(text, hex);
      return defaultLabelTexture(THREE, text, hex);
    }
    // 방향 라벨 위치: 물체 밖(실루엣 방향) — 어느 각도에서도 큐브를 가리지 않음.
    // opts.dirLabelPositions {top,front,side}로 페이지별 커스터마이즈 가능(3-C).
    function dirLabelDefs() {
      var o = opts.dirLabelPositions || {};
      var gx = state.gx, gy = state.gy, gz = state.gz;
      return [
        { t: '위', c: '#3f8fd0', p: o.top   || [0, gy * S + 0.85, 0] },
        { t: '앞', c: '#4fae72', p: o.front || [0, -0.8, gz * S / 2 + 0.55] },
        { t: '옆', c: '#d0546f', p: o.side  || [gx * S / 2 + 0.55, -0.8, 0] }
      ];
    }
    var LBL_W = 1.1, LBL_H = LBL_W / LABEL_ASPECT;   // 평면도 텍스처와 같은 종횡비
    function buildDirLabels() {
      dirLabels.forEach(function (m) { scene.remove(m); m.material.map.dispose(); m.material.dispose(); m.geometry.dispose(); });
      dirLabels = [];
      if (!showLabels) return;
      dirLabelDefs().forEach(function (d) {
        var m = new THREE.Mesh(new THREE.PlaneGeometry(LBL_W, LBL_H), new THREE.MeshBasicMaterial({ map: labelTex(d.t, d.c), transparent: true, depthWrite: false }));
        m.position.set(d.p[0], d.p[1], d.p[2]); scene.add(m); dirLabels.push(m);
      });
    }

    // ----- 카메라(playground 검증 수학) -----
    var sph = { theta: -0.7 + Math.PI + Math.PI / 2 + Math.PI, phi: 1.02, radius: 8 };
    var SPH0 = { theta: sph.theta, phi: sph.phi };
    var target = new THREE.Vector3(0, 1.5, 0);
    var explodeOn = false, explode6 = false, soloAxis = null, projRadius = 0;
    var explodeCenter = new THREE.Vector3();

    function modelRadiusWorld() { return 0.5 * Math.sqrt(state.gx * state.gx + state.gy * state.gy + state.gz * state.gz) * S; }
    // 관찰 반경: 모델 + 방향 라벨(물체 밖)까지 포함해 잘리지 않게
    function observeRadius() {
      var R = modelRadiusWorld();
      if (showLabels) {
        var ty = state.gy * S / 2, margin = 0.6;
        dirLabelDefs().forEach(function (d) {
          var dd = Math.sqrt(d.p[0] * d.p[0] + (d.p[1] - ty) * (d.p[1] - ty) + d.p[2] * d.p[2]) + margin;
          if (dd > R) R = dd;
        });
      }
      return R;
    }
    function fitRadius() {
      var w = container.clientWidth || 300, h = container.clientHeight || 300, fill = 0.92;
      var R = (explodeOn && projRadius > 0) ? projRadius : observeRadius();
      var Hf = 2 * R * h / (Math.min(w, h) * fill);
      return Hf / (2 * TAN);
    }
    function updateTarget() { target.set(0, state.gy * S / 2, 0); }
    function camPos(o) { var t = sph.theta, p = sph.phi; return o.set(Math.sin(p) * Math.sin(t), Math.cos(p), Math.sin(p) * Math.cos(t)).multiplyScalar(sph.radius).add(target); }
    function applyCam() { var pos = camPos(new THREE.Vector3()); cam.position.copy(pos); cam.up.set(0, 1, 0); cam.lookAt(target); }
    function setFrustum() {
      var w = container.clientWidth || 300, h = container.clientHeight || 300, aspect = w / h;
      var Hf = 2 * sph.radius * TAN, ww = Hf * aspect;
      cam.left = -ww / 2; cam.right = ww / 2; cam.top = Hf / 2; cam.bottom = -Hf / 2; cam.updateProjectionMatrix();
    }
    function reframe() { sph.radius = fitRadius(); setFrustum(); }

    // ----- 펼쳐보기(stage1 재사용) -----
    function rebuildExplode() {
      if (!explodeOn) { projGroup.visible = false; return; }
      var res = buildExplodedProjections(THREE, projGroup, { gx: state.gx, gy: state.gy, gz: state.gz, cells: cells },
        { gap: gap, explode6: explode6, soloAxis: soloAxis, showLabels: showLabels, makeLabelTexture: opts.makeLabelTexture });
      projGroup.visible = true;
      projRadius = res.radius;
      if (cells.size > 0) explodeCenter.copy(res.center);
      cubeGroup.children.forEach(function (o) { if (o.material === matWood) o.material = matFace; }); // 면색
    }

    // ----- 상호작용(오빗) -----
    var drag = false, lx = 0, ly = 0;
    function onDown(e) { drag = true; lx = e.clientX; ly = e.clientY; canvas.style.cursor = 'grabbing'; if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId); }
    function onMove(e) { if (!drag) return; var dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; sph.theta -= dx * 0.008; sph.phi = Math.max(0.12, Math.min(Math.PI - 0.12, sph.phi - dy * 0.008)); }
    function onUp() { drag = false; canvas.style.cursor = 'grab'; }
    canvas.style.cursor = 'grab';
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    function resize() {
      var w = container.clientWidth || 300, h = container.clientHeight || 300;
      renderer.setSize(w, h, false); reframe();
    }
    var onWinResize = resize; window.addEventListener('resize', onWinResize);

    // ----- 애니메이션 루프 -----
    var raf = null, disposed = false;
    function loop() {
      if (disposed) return;
      applyCam();
      var camQ = cam.quaternion;
      dirLabels.forEach(function (m) { m.quaternion.copy(camQ); });
      if (explodeOn) { if (cells.size > 0) target.copy(explodeCenter); }
      renderer.render(scene, cam);
      raf = requestAnimationFrame(loop);
    }

    // ----- 공개 API -----
    function setShape(shape) {
      var sh = core.normalize(shape);
      state.gx = sh.gx; state.gy = sh.gy; state.gz = sh.gz; state.edge = sh.edge;
      cells = sh.cells;
      updateTarget(); buildFloor(); rebuildCubes(); buildDirLabels();
      if (explodeOn) rebuildExplode(); else { if (cells.size > 0 && !explodeOn) { /* keep */ } target.set(0, state.gy * S / 2, 0); }
      reframe();
    }
    function setExplode(on) {
      explodeOn = !!on; projGroup.visible = explodeOn;
      if (explodeOn) { rebuildExplode(); if (cells.size > 0) target.copy(explodeCenter); }
      else { clearGroup(projGroup); projRadius = 0; updateTarget(); cubeGroup.children.forEach(function (o) { if (o.material === matFace && !faceColors) o.material = matWood; }); }
      reframe();
    }
    function setExplode6(on) { explode6 = !!on; if (explodeOn) { rebuildExplode(); if (cells.size > 0) target.copy(explodeCenter); reframe(); } }
    function setSolo(axis) { soloAxis = (soloAxis === axis) ? null : axis; if (explodeOn) { rebuildExplode(); if (cells.size > 0) target.copy(explodeCenter); reframe(); } return soloAxis; }
    function reset() { sph.theta = SPH0.theta; sph.phi = SPH0.phi; }
    function dispose() {
      disposed = true; if (raf) cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp); window.removeEventListener('resize', onWinResize);
      clearGroup(cubeGroup); clearGroup(projGroup);
      dirLabels.forEach(function (m) { m.material.map.dispose(); m.material.dispose(); m.geometry.dispose(); });
      boxGeo.dispose(); edgeGeo.dispose(); matWood.dispose(); matFace.dispose(); edgeMat.dispose(); matHi.dispose();
      if (floor) { floor.geometry.dispose(); floor.material.dispose(); }
      if (floorGrid) { floorGrid.geometry.dispose(); floorGrid.material.dispose(); }
      renderer.dispose(); if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }

    // init
    resize();
    if (opts.shape) setShape(opts.shape); else { updateTarget(); buildFloor(); buildDirLabels(); reframe(); }
    loop();

    return {
      setShape: setShape, setExplode: setExplode, setExplode6: setExplode6, setSolo: setSolo,
      reset: reset, resize: resize, dispose: dispose, setHighlight: setHighlight,
      scene: scene, camera: cam, group: cubeGroup,
      get radius() { return sph.radius; }
    };
  }

  var viewer = { VERSION: VERSION, buildExplodedProjections: buildExplodedProjections, createViewer: createViewer };

  global.CubeNest = global.CubeNest || {};
  global.CubeNest.viewer = viewer;
  if (typeof module !== 'undefined' && module.exports) module.exports = viewer;

})(typeof globalThis !== 'undefined' ? globalThis : this);
