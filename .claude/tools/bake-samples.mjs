/* .claude/tools/bake-samples.mjs — /quiz 랜딩 카드 썸네일용 표본을 미리 굽는다.
   실행: node .claude/tools/bake-samples.mjs [--level 중] [--out quiz/samples.json] [--dry]
   ⚠ 배포된 Edge Function 이 살아 있어야 한다(/quiz/run 과 같은 단서).

   왜 미리 굽나 — /generate 는 1콜=1유형이고(generate/index.ts:37) 익명 한도가 20/분이라
     (rate.ts:6-11) 랜딩 로드 시점에 35콜은 불가능하다. 첫 로드에서 이미 초과한다.
     생성기는 시드에 완전히 결정적이므로(cubenest-gen.js:12,34) 한 번 구우면 영원히 같은 그림이다.

   ⛔ 정답을 저장하지 않는다. /grade 는 **성립 검증에만** 쓰고 응답은 그 자리에서 버린다.
      id·gsig 도 저장 금지 — 저장하면 samples.json 이 35개 고정 문항에 대한
      **영구 /grade 오라클 티켓**이 된다(gsig 엔 만료가 없다). */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// 엔드포인트의 단일 출처는 api-client.js 다 — URL 을 여기 복제하면 반드시 표류한다.
const BASE = /var BASE\s*=\s*"([^"]+)"/.exec(rd('quiz/run/api-client.js'))[1];

const ARG = new Map(process.argv.slice(2).flatMap((a, i, A) =>
  a.startsWith('--') ? [[a.slice(2), (A[i + 1] && !A[i + 1].startsWith('--')) ? A[i + 1] : true]] : []));
const str = (k) => (typeof ARG.get(k) === 'string' ? ARG.get(k) : null);

const LEVEL   = str('level') || '중';   // 랜딩 기본 난이도는 중·상. 표본은 그중 낮은 쪽 한 벌.
const OUT     = str('out')   || 'quiz/samples.json';
const N_PER   = 6;                       // 콜 수를 안 늘리고 후보만 늘린다(1콜에 6문항)
const TRIES   = 3;                       // 시드 재작성 0..2 → 후보 18개
const GEN_GAP = 3500;                    // 17콜/분 < generate 익명 한도 20/분
const GRD_GAP = 1100;                    // 54콜/분 < grade 한도 60/분
const ANON    = crypto.randomUUID();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(fn, body) {
  const res = await fetch(BASE + '/' + fn, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Anon-Id': ANON },
    body: JSON.stringify(body),
  });
  if (res.status === 429) {                       // 한도에 걸리면 서버가 시킨 만큼 자고 재시도
    const ra = +(res.headers.get('Retry-After') || 60);
    console.warn('   429 — ' + ra + '초 대기');
    await sleep((ra + 1) * 1000);
    return post(fn, body);
  }
  if (!res.ok) throw new Error(fn + ' ' + res.status + ' ' + (await res.text()).slice(0, 200));
  return res.json();
}

/* 조합 목록의 정본은 **배포된 /config** 다(서버 GATE 를 그대로 반영한다).
   표를 여기 하드코딩하면 서버가 유형을 열고 닫을 때 조용히 어긋난다. */
async function combos() {
  const res = await fetch(BASE + '/config', { headers: { 'X-Anon-Id': ANON } });
  if (!res.ok) throw new Error('config ' + res.status);
  const cfg = await res.json();
  const list = [];
  for (const st of (cfg.stages || []))            // /config 는 open 스테이지만 준다
    for (const [type, e] of Object.entries(st.types || {}))
      for (const sub of (e.subs && e.subs.length ? e.subs : ['']))
        list.push({ type, sub, stage: st.id });
  // 정렬 = git diff 안정(삽입 순서가 곧 JSON 키 순서다)
  list.sort((a, b) => a.stage.localeCompare(b.stage) || a.type.localeCompare(b.type)
                   || a.sub.localeCompare(b.sub));
  return { cfg, list };
}

const keyOf = (c) => c.type + '|' + c.sub + '|' + c.stage;
/* 시드는 조합에서 결정적으로 나온다 — 다시 구워도 같은 그림이라 git diff 가 빈다.
   반려되면 -1, -2 로 **결정적으로** 재작성한다(랜덤이면 재현이 안 된다). ⚠ '#' 금지(id 구분자). */
const seedOf = (c, k) =>
  'bk' + crypto.createHash('sha1').update(keyOf(c)).digest('hex').slice(0, 6) + (k ? String(k) : '');

/* 성립하지 않는 문항을 걸러낸다. 근거 = .claude/quiz/난이도_재설계 §11.1 실측:
     A-b 하 14% 가 정답 0칸(찍을 칸이 없어 run.js:422 가 제출을 막는다)
     A-d 하 10.8% 가 max===min 인데 차를 묻는다 → 정답 0
     A-f 하 500/500 이 2가지(안 풀고 맞힌다)
   표본은 그 유형의 얼굴이다 — 성립 안 하는 문항이 얼굴이 되면 안 된다.
   soft = 썸네일 품질 취향. 마지막 시도에서는 완화한다(전부 반려돼 빈칸이 되는 것보다 낫다). */
function reject(gp, key, soft) {
  if (!key) return 'answerKey 없음';
  const sub = gp.sub || '', g = gp.given || {};
  if (sub === 'A-b' && !(key.cells || []).length)                     return 'A-b 정답 0칸';
  if (gp.which === 'diff' && !key.value)                              return 'max===min 인데 차를 묻는다';
  if (sub === 'A-f' && !(key.value > 2))                              return 'A-f 가짓수 2 이하';
  if (key.type === 'num' && key.value == null)                        return 'num 정답 없음';
  if (gp.form === 'mc' && (gp.opts || []).length < 4)                 return '보기 4개 미만';
  if (g.kind === 'layers' && (g.layers || []).length > 3)             return '층 4개 — 패널이 45px 로 찌그러진다';
  if (!soft) return null;
  // ── 여기부터는 썸네일 품질(마지막 시도에서 완화) ──
  if (gp.sh && (gp.sh.cells || []).length < 4)                        return '나무 4개 미만';
  if (g.kind === 'numTop' && Object.keys(g.heights || {}).length < 4) return '칸 4개 미만';
  if (g.kind === 'layers' && (g.layers || []).length < 2)             return '층 1개';
  if (sub === 'A-a' && key.value === false)                           return 'A-a 없어요 — 그림이 밋밋하다';
  return null;
}

// renderSil 은 truthy 만 본다(figures.js:41) → 1/0 이 true/false 와 동일하게 그려지고 40% 작다.
const sil = (s) => !s ? null
  : (s.t === 'grid' ? { t: 'grid', g: s.g.map((r) => r.map((v) => (v ? 1 : 0))), cols: s.cols, rows: s.rows }
                    : { t: 'bars', a: s.a.slice(), rows: s.rows });

/* ⚠ **넣는 방식**이지 지우는 방식이 아니다. 응답에서 delete 하면 서버가 필드를 늘릴 때마다
   새 것이 조용히 새어 나간다. 아래 적힌 것만 나간다. */
function compact(gp) {
  // 문말 단서는 presentSpec 이 항상 <br><small>… 로 **맨 뒤에** 붙인다(gen-adapter:279-282).
  //   그래서 <br> 로 자르는 것이 태그를 안 깨는 유일한 분리점이다. 문자열 substring 금지.
  const parts = String(gp.ask || '').split('<br>');
  const it = { kind: null, ask: parts[0].trim() };
  const note = parts.slice(1).join(' ').replace(/<\/?small>/g, '').trim();
  if (note) it.note = note;
  if (gp.given) {
    const g = gp.given, k = g.kind;
    it.kind = k;
    if      (k === 'numTop')      it.given = { kind: k, gx: g.gx, gz: g.gz, heights: g.heights };
    else if (k === 'layers')      it.given = { kind: k, gx: g.gx, gz: g.gz, layers: g.layers };
    else if (k === 'sils')        it.given = { kind: k, sils: { top: sil(g.sils.top), front: sil(g.sils.front), side: sil(g.sils.side) } };
    else if (k === 'topOneSil')   it.given = { kind: k, dir: g.dir, top: sil(g.top), bars: sil(g.bars) };
    else if (k === 'isoTop')      it.given = { kind: k, iso: g.iso, top: sil(g.top) };
    else if (k === 'isoMark')     it.given = { kind: k, iso: g.iso };
    else if (k === 'paintedCube') it.given = { kind: k, iso: g.iso };
    else throw new Error('모르는 given.kind: ' + k);   // 서버가 종류를 늘리면 여기서 멈춘다
  } else if (gp.sh) {
    it.kind = 'sh';
    // cells 는 [x,y,z] 삼중항 — {x,y,z} 객체 대비 15배 작다. 겨냥도는 미리 그리지 않는다
    //   (cells 200B vs SVG 2.7KB, 그리고 cubenest-iso.js 는 이미 랜딩에 로드돼 있다).
    it.sh = { gx: gp.sh.gx, gz: gp.sh.gz, cells: (gp.sh.cells || []).map((c) => [c.x, c.y, c.z]) };
    if (gp.top) it.top = sil(gp.top);
  } else throw new Error('given 도 sh 도 없다');
  return it;
}

const { cfg, list } = await combos();
console.log('서버 cfg=' + cfg.version + ' · 조합 ' + list.length + '개 · 등급 ' + LEVEL
          + ' · 예상 ' + Math.ceil(list.length * 5.5 / 60) + '분');

const items = {}, misses = [];
for (const c of list) {
  const key = keyOf(c);
  let done = false;
  for (let k = 0; k < TRIES && !done; k++) {
    const seed = seedOf(c, k);
    await sleep(GEN_GAP);
    // ⚠ dim 을 보내지 않는다 — 기본 시작(state.dim='auto')과 같은 제시물이어야 한다.
    //   서버 resolveDim 이 스테이지로 정한다(S0~S3=3d, S4=유형별).
    const r = await post('generate', {
      theme: c.type, sub: c.sub || null, levels: [LEVEL], n: N_PER, seed, stage: c.stage,
    });
    for (const p of (r.problems || [])) {
      await sleep(GRD_GAP);
      let why;
      try {
        // ⚠ params 는 /generate 에 넘긴 값과 **같은 표현식**이어야 한다 — 다르면 403(gsig 불일치).
        const gr = await post('grade', {
          id: p.id, gsig: p.gsig, answer: null,
          params: { theme: c.type, levels: [LEVEL], n: N_PER, edu: null, stage: c.stage, sub: c.sub || null },
        });
        why = reject(p._gp, gr.answerKey, k < TRIES - 1);   // ← gr 은 여기서만 산다. 저장 경로에 없다.
      } catch (e) { why = 'grade 실패: ' + e.message; }
      if (why) { console.log('   · ' + key + ' ' + p.id + ' 반려 — ' + why); continue; }
      items[key] = Object.assign(compact(p._gp),
        { _src: { seed, idx: +String(p.id).split('#')[1], level: LEVEL, try: k } });
      console.log('OK ' + key.padEnd(22) + ' kind=' + items[key].kind);
      done = true; break;
    }
  }
  if (!done) { misses.push(key); console.error('FAIL ' + key + ' — 후보 ' + TRIES * N_PER + '개 전부 반려'); }
}

const out = {
  _generated: '.claude/tools/bake-samples.mjs 가 만든다 — 손으로 고치지 말 것',
  bakedAt: new Date().toISOString().slice(0, 10),
  cfgVersion: cfg.version,
  level: LEVEL,
  count: Object.keys(items).length,
  items,
};
const blob = JSON.stringify(out, null, 1);
// 마지막 방벽 — 어떤 경로로도 정답·서명이 산출물에 들어가지 않았는지 문자열로 확인한다.
for (const bad of ['answerKey', 'gsig', 'explain', '"correct"'])
  if (blob.includes(bad)) throw new Error('정답이 샐 뻔했다 — 산출물에 ' + bad + ' 가 있다');

if (misses.length) console.error('\n미완 ' + misses.length + '건: ' + misses.join(', '));
if (ARG.get('dry')) { console.log(blob.slice(0, 800)); process.exit(misses.length ? 1 : 0); }

const dest = path.join(ROOT, OUT);
fs.writeFileSync(dest + '.tmp', blob, 'utf8');
fs.renameSync(dest + '.tmp', dest);                 // 원자적 교체
console.log('\n' + OUT + ' ← ' + out.count + '/' + list.length + '건 ('
          + (Buffer.byteLength(blob) / 1024).toFixed(1) + 'KB)');
process.exit(misses.length ? 1 : 0);
