// CubeNest Edge Functions — gen/core 어댑터 (서버 전용 생성기)
// ─────────────────────────────────────────────────────────────────────────
// 역할: gen 출력 → API 페이로드 (answerKey · checkAnswer · question · present · explain).
// core·gen·gen-config 의 서버 이식은 완료됐다. 값은 반드시 gen-modules.ts 한 곳에서만
// 가져온다 — 로드 순서(core→genConfig→hidden→gen)와 번들 포함을 거기서 보장한다.
// ─────────────────────────────────────────────────────────────────────────

import { core, gen, genConfig, iso, minmax as mm, manip as mp, GEN_CONFIG } from "./gen-modules.ts";

// deno-lint-ignore no-explicit-any
type Sh = any;

export function coreShape(sh: Sh) {
  return { gx: sh.gx, gy: sh.maxH, gz: sh.gz, edge: sh.edge,
           cells: sh.cells.map((c: any) => [c.x, c.y, c.z]) };
}

// 세션을 seed+params로 결정적으로 재생성 (generate·grade 공통)
// stage = 연령 스테이지(S2~S5). 미지정이면 gen-config 기본값 S4(초6) — 기존 호출자는 그대로다.
//   ⚠ /generate 와 /grade 가 같은 stage 를 넘겨야 재생성 모양이 같다(gsig 지문에 포함).
export function buildProbs(p: {
  type: string; levels: string[]; seed: string; n: number;
  edu?: string | null; sub?: string | null; stage?: string | null;
}): Sh[] {
  return gen.genSession({
    type: p.type, levels: p.levels, seed: p.seed, n: p.n, stage: p.stage ?? null,
    config: GEN_CONFIG, edu: p.edu ?? null, core, sub: p.sub ?? null,
  });
}

// ── run 판정 헬퍼 (PoC mock에서 이식한 verbatim; gen.ts로 옮기는 것을 권장) ──
function frontSil(sh: Sh){const a=[];for(let x=0;x<sh.gx;x++){let m=0;for(let z=0;z<sh.gz;z++)m=Math.max(m,sh.hmap[x][z]);a.push(m);}return {t:"bars",a,rows:Math.max(...a,1)};}
function sideSil(sh: Sh){const a=[];for(let z=0;z<sh.gz;z++){let m=0;for(let x=0;x<sh.gx;x++)m=Math.max(m,sh.hmap[x][z]);a.push(m);}a.reverse();return {t:"bars",a,rows:Math.max(...a,1)};}
function topSil(sh: Sh){const g=[];for(let z=0;z<sh.gz;z++){const row=[];for(let x=0;x<sh.gx;x++)row.push(sh.hmap[x][z]>0);g.push(row);}return {t:"grid",g,cols:sh.gx,rows:sh.gz};}
function silSig(sq: any){return sq.t==="bars"?"b:"+sq.a.join(","):"g:"+sq.g.map((r:any[])=>r.map((c:any)=>c?1:0).join("")).join("/");}
function perturbSil(sil: any, rng: ()=>number){
  const ri=(n:number)=>Math.floor(rng()*n);
  if(sil.t==="bars"){const a=sil.a.slice(),rows=sil.rows,n=a.length,m=ri(3);
    if(m===0){const i=ri(n);a[i]=Math.max(0,Math.min(rows,a[i]+(rng()<.5?1:-1)));}
    else if(m===1)a.reverse(); else{const i=ri(n),j=ri(n),t=a[i];a[i]=a[j];a[j]=t;}
    if(a.every((v:number)=>v===0))a[ri(n)]=1; return {t:"bars",a,rows};}
  const g=sil.g.map((r:any[])=>r.slice());g[ri(sil.rows)][ri(sil.cols)]^=1;
  if(g.every((r:any[])=>r.every((c:any)=>!c)))g[ri(sil.rows)][ri(sil.cols)]=1;
  return {t:"grid",g,cols:sil.cols,rows:sil.rows};
}
function makeSilOpts(correct:any, rng:()=>number){
  const keyS=silSig(correct),opts=[correct],seen:Record<string,number>={};seen[keyS]=1;let guard=0;
  while(opts.length<4&&guard++<80){const d=perturbSil(correct,rng),k=silSig(d);if(!seen[k]){seen[k]=1;opts.push(d);}}
  for(let i=opts.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));const t=opts[i];opts[i]=opts[j];opts[j]=t;}
  return {opts,correct:opts.map((o:any)=>silSig(o)).indexOf(keyS)};
}
function drawDims(sh: Sh){const H=sh.maxH;return {H,top:{cols:sh.gx,rows:sh.gz},front:{cols:sh.gx,rows:H},side:{cols:sh.gz,rows:H}};}
function drawCorrect(sh: Sh, view:string, c:number, r:number){const H=sh.maxH;
  if(view==="top")return topSil(sh).g[r][c];
  if(view==="front")return (H-1-r) < frontSil(sh).a[c];
  return (H-1-r) < sideSil(sh).a[c];
}
// views 를 주면 그 방향만 정답으로 삼는다(§4.8 — 모양 여러 개 × 각 한 면).
//   주지 않으면 위·앞·옆 전부(기존 동작).
function drawCorrectCells(sh: Sh, views?: string[] | null){const d:any=drawDims(sh),out:string[]=[];
  (views && views.length ? views : ["top","front","side"]).forEach((view)=>{const dd=d[view];if(!dd)return;for(let r=0;r<dd.rows;r++)for(let c=0;c<dd.cols;c++)if(drawCorrect(sh,view,c,r))out.push(view+","+c+","+r);});
  return out;
}

// ── 정답 산출 (서버 채점 핵심) — 현행 8유형. 신규 17유형은 매핑표대로 확장 ──
export function answerKeyFor(type: string, pr: Sh, idx: number, seed: string): any {
  const sh = pr.sh, cs = coreShape(sh), st = core.stats(cs);
  switch (type) {
    case "count":   return { type: "num", value: st.count };
    case "volume":  return { type: "num", value: st.volume };
    case "surface": return { type: "num", value: st.surfaceArea };
    case "minmax": {
      // G군 — G-a 삼면도 / G-b 위+한방향 / G-c 층 조건 개수
      const gsub = pr.sub || "G-a";
      if (gsub === "G-c") {
        // 파워유형 유형9 확정 공식: n층 이상인 칸 수 = 위모양에서 n 이상인 칸 수.
        return { type: "num", value: mm.countAtLeast(core.heightMap(cs), pr.n), n: pr.n };
      }
      const rc = gsub === "G-b"
        ? mm.minmaxFromTopAndSil(core.heightMap(cs), pr.dir || "front")
        : core.reverseCounts(cs);
      const which = pr.which || "min";
      const val = which === "min" ? rc.minCount : which === "max" ? rc.maxCount : (rc.maxCount - rc.minCount);
      return { type: "num", value: val, min: rc.minCount, max: rc.maxCount, which };
    }
    case "manip": {
      // H군 — H-c 정육면체 완성 / H-d 색칠 정육면체
      const msub = pr.sub || "H-c";
      if (msub === "H-d") {
        // 직육면체 a×b×c 로 일반화됨. box 가 없는 옛 인스턴스는 정육면체로 되읽는다.
        const bx = pr.box || [pr.n, pr.n, pr.n];
        return { type: "num", value: mp.paintedBoxCount(bx[0], bx[1], bx[2], pr.k), box: bx, k: pr.k };
      }
      // H-a/H-b — 조작 후 모양의 삼면도. facesDraw 와 같은 drawSil 집합 일치로 채점.
      if ((msub === "H-a" || msub === "H-b") && pr.resSh) return { type: "drawSil", cells: drawCorrectCells(pr.resSh) };
      const cc = mp.completeCube(core.heightMap(cs));        // 재계산(서버가 정답의 단일 출처)
      return { type: "num", value: cc.need, m: cc.m, total: cc.total, count: cc.count };
    }
    case "hidden": {
      // 안 보이는 나무 A-a~f (gen v0.3이 sub·hasHidden·hcols·count·rc·which·kinds 첨부)
      const sub = pr.sub || "A-a";
      if (sub === "A-a") return { type: "bool", value: !!pr.hasHidden };
      if (sub === "A-b") return { type: "markCells", cells: (pr.hcols || []).map((c: any) => c[0] + "," + c[1]) };
      if (sub === "A-c" || sub === "A-e") return { type: "num", value: pr.count };
      if (sub === "A-d") {
        const rc = pr.rc || core.reverseCounts(cs), which = pr.which || "min";
        const val = which === "min" ? rc.minCount : which === "max" ? rc.maxCount : (rc.maxCount - rc.minCount);
        return { type: "num", value: val, min: rc.minCount, max: rc.maxCount, which };
      }
      if (sub === "A-f") return { type: "num", value: pr.kinds };
      return { type: "bool", value: !!pr.hasHidden };
    }
    case "heightmap": {
      // core.heightMap 은 2차원 배열이 아니라 {"x,z": h} 객체다(cubenest-core.js §4.3).
      // hm[z][x] 로 읽던 시절엔 grid 가 항상 {} 라 만점 답안도 오답 처리됐다.
      const hm = core.heightMap(cs), grid: Record<string, number> = {};
      for (let z = 0; z < sh.gz; z++) for (let x = 0; x < sh.gx; x++) {
        const h = hm[x + "," + z] || 0; if (h > 0) grid[x + "," + z] = h;
      }
      return { type: "markCount", grid };
    }
    case "facesMc": {
      const dir = pr.dir, correctSil = dir === "front" ? frontSil(sh) : dir === "side" ? sideSil(sh) : topSil(sh);
      const built = makeSilOpts(correctSil, gen.rngFrom(seed + ":o" + idx));
      return { type: "mc", correct: built.correct };
    }
    case "facesDraw": return { type: "drawSil", cells: drawCorrectCells(sh, pr.views) };
    default: return { type: "num", value: st.count };
  }
}

export function checkAnswer(_type: string, answer: any, key: any): boolean {
  if (!answer) return false;
  switch (key.type) {
    case "num":  return Number(answer.value) === Number(key.value);
    case "bool": return !!answer.value === !!key.value;
    case "mc":   return Number(answer.pick) === Number(key.correct);
    case "markCount": return mapEq(answer.grid, key.grid);
    case "markCells": {
      const A: Record<string, 1> = {}, B: Record<string, 1> = {};
      (answer.cells || []).forEach((x: string) => A[x] = 1);
      (key.cells || []).forEach((x: string) => B[x] = 1);
      for (const k in A) if (!B[k]) return false;
      for (const k in B) if (!A[k]) return false;
      return true;
    }
    case "drawSil": {
      const A: Record<string, 1> = {}, B: Record<string, 1> = {};
      (answer.cells || []).forEach((x: string) => A[x] = 1);
      (key.cells || []).forEach((x: string) => B[x] = 1);
      for (const k in A) if (!B[k]) return false;
      for (const k in B) if (!A[k]) return false;
      return true;
    }
    default: return false;
  }
}
function mapEq(a: any, b: any): boolean {
  a = a || {}; b = b || {}; const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (String(a[k]) !== String(b[k])) return false;
  return true;
}

// ── 제시물(given) 빌더 — 은닉 유형은 모양 대신 '주어진 것'만 내려보낸다 ──
function silTrio(sh: Sh) { return { top: topSil(sh), front: frontSil(sh), side: sideSil(sh) }; }
function heightGrid(sh: Sh) {                     // A-c: 위에서 본 수 = 높이 전체(제시물 자체)
  const g: Record<string, number> = {};
  for (let x = 0; x < sh.gx; x++) for (let z = 0; z < sh.gz; z++) if (sh.hmap[x][z] > 0) g[x + "," + z] = sh.hmap[x][z];
  return g;
}
function layerGrids(sh: Sh) {                     // A-e: 층별 모양(1층부터). 빈 층은 생략
  const out: string[][] = [];
  for (let y = 0; y < sh.maxH; y++) {
    const cells: string[] = [];
    for (let x = 0; x < sh.gx; x++) for (let z = 0; z < sh.gz; z++) if (sh.hmap[x][z] > y) cells.push(x + "," + z);
    if (!cells.length && y > 0) continue;
    out.push(cells);
  }
  return out;
}
function hiddenGiven(pr: Sh, sh: Sh) {
  const base = { gx: sh.gx, gz: sh.gz };
  if (pr.sub === "A-c") return { ...base, kind: "numTop", heights: heightGrid(sh) };
  if (pr.sub === "A-e") return { ...base, kind: "layers", layers: layerGrids(sh) };
  if (pr.sub === "A-d") return { ...base, kind: "sils", sils: silTrio(sh) };
  // A-a · A-b · A-f — 겨냥도가 제시물이고 '거기 안 보이는 것'이 문제다.
  // 모양을 보내면 전제가 깨지므로 서버가 SVG 로 그려 보낸다(숨은 열의 높이는 전송되지 않는다).
  // top(위에서 본 모양)은 주어진 정보이고 A-b 답안 격자의 발자국으로도 쓰인다.
  return { ...base, kind: "isoTop", iso: iso.renderIso({ gx: sh.gx, gz: sh.gz, cells: sh.cells }, 0), top: topSil(sh) };
}

// ── 발문·답 형식 (문제의 일부라 서버가 단일 출처) ──
//   quiz 화면과 worksheets 문제지가 같은 문구를 써야 한다. 클라 두 곳에서 각자 조립하면
//   반드시 표류한다(마스터 §8.1) → 여기서 한 번만 만든다. 정답은 물론 들어가지 않는다.
// 발문 규격(시중 문제집 3종 공통 관행):
//   ① [상황 선언] + [요구] 2문장 · 45~55자
//   ② 단서는 문말 괄호로 별행
//   ③ 부정형 핵심어(아닌·다른·없는·잘못된)는 <b> 강조 — 오답 유도 방지
const TYPE_SPEC: Record<string, { ask: string; form: string; unit: string }> = {
  count:     { ask: "쌓기나무로 쌓은 모양입니다. 쌓기나무는 모두 몇 개일까요?", form: "num", unit: "개" },
  volume:    { ask: "쌓기나무로 쌓은 모양입니다. 이 모양의 부피는 얼마일까요?", form: "num", unit: "cm³" },
  surface:   { ask: "쌓기나무로 쌓은 모양입니다. 이 모양의 겉넓이는 얼마일까요?", form: "num", unit: "cm²" },
  heightmap: { ask: "쌓기나무로 쌓은 모양입니다. 위에서 본 모양의 각 칸에 쌓인 나무 수를 써 보세요.", form: "hm", unit: "" },
  facesMc:   { ask: "쌓기나무로 쌓은 모양입니다. 앞에서 본 모양을 고르세요.", form: "mc", unit: "" },
  facesDraw: { ask: "쌓기나무로 쌓은 모양입니다. 위·앞·옆에서 본 모양을 각 칸을 칠해 그려 보세요.", form: "draw", unit: "" },
  minmax:    { ask: "세 방향에서 본 모양이 되는 쌓기나무 개수는?", form: "num", unit: "개" },
  hidden:    { ask: "안 보이는 쌓기나무를 생각해 보세요.", form: "num", unit: "개" },
  manip:     { ask: "조건에 맞는 쌓기나무 수를 구하세요.", form: "num", unit: "개" },
};
const MINMAX_ASK = (s: string, w: string, dir: string, n: number) =>
  s === "G-c" ? `겨냥도를 보고, <b>${n}층 이상</b> 쌓인 칸은 모두 몇 칸인지 세요.`
: s === "G-b" ? `위에서 본 모양과 <b>${dir === "side" ? "옆" : "앞"}에서 본 모양</b>이 이래요. 쌓기나무는 <b>${w === "max" ? "최대" : "최소"}</b> 몇 개일까요?`
: w === "diff" ? "세 방향 모양이 같도록 쌓을 때, <b>최대와 최소의 차이</b>는 몇 개일까요?"
: `세 방향(위·앞·옆)에서 본 모양이 되려면, 쌓기나무는 <b>${w === "max" ? "최대" : "최소"}</b> 몇 개일까요?`;
const HIDDEN_ASK: Record<string, string> = {
  "A-a": "겨냥도와 위에서 본 모양을 비교해요. <b>안 보이게 숨은 쌓기나무가 있나요?</b>",
  "A-b": "위에서 본 모양에서 <b>안 보이는 나무가 숨은 칸</b>을 모두 눌러요.",
  "A-c": "위에서 본 모양의 각 칸에 <b>쌓인 나무 수</b>가 적혀 있어요. 쌓기나무는 모두 몇 개일까요?",
  "A-e": "<b>층별로 나타낸 모양</b>이에요. 쌓기나무는 모두 몇 개일까요?",
  "A-f": "겨냥도와 위에서 본 모양이 이래요. <b>쌓은 모양이 될 수 있는 것은 몇 가지</b>일까요?",
};
const PAINT_K = ["색칠되지 않은", "한 면만 색칠된", "두 면이 색칠된", "세 면이 색칠된"];

// 문말 단서 — 문제집이 전 문항에서 붙이는 것만 옮겼다. 별행 우측이 관행이라 <br> 로 띄운다.
const NOTE_SURFACE = "<br><small>(단, 바닥에 닿는 면도 포함합니다.)</small>";
const NOTE_KINDS   = "<br><small>(단, 돌렸을 때 같은 모양은 한 가지로 봅니다.)</small>";
// 위모양을 함께 주는 6종의 규약 — 이 한 줄이 있어야 답이 유일해진다.
//   겨냥도에 안 보이는 자리의 높이는 그림만으로 정해지지 않는다. 교과·문제집은 이 자유도를
//   "위모양에 있는데 겨냥도에 안 보이면 그 자리는 1개"로 고정하고, 생성기도 그렇게 만든다.
const NOTE_HIDDEN1 = "<br><small>(단, 위에서 본 모양에는 있는데 보이지 않는 자리에는 쌓기나무가 1개씩 있습니다.)</small>";

function presentSpec(pr: Sh, type: string) {
  const base = TYPE_SPEC[type] || TYPE_SPEC.count;
  let ask = base.ask, form = base.form, unit = base.unit;
  if (type === "facesMc") {
    ask = "쌓기나무로 쌓은 모양입니다. "
        + (pr.dir === "front" ? "앞" : pr.dir === "side" ? "옆" : "위") + "에서 본 모양을 고르세요.";
  } else if (type === "minmax") {
    const s = pr.sub || "G-a";
    ask = MINMAX_ASK(s, pr.which, pr.dir, pr.n);
    if (s === "G-c") unit = "칸";
  } else if (type === "hidden") {
    const s = pr.sub || "A-a";
    if (s === "A-a") { form = "bool"; unit = ""; }
    else if (s === "A-b") { form = "markCells"; unit = ""; }
    else if (s === "A-f") unit = "가지";
    ask = s === "A-d"
      ? (pr.which === "diff"
          ? "세 방향 모양이 되도록 쌓을 때 <b>최대와 최소의 차이</b>(안 보이는 나무)는 몇 개일까요?"
          : `세 방향(위·앞·옆)에서 본 모양이 되려면 쌓기나무는 <b>${pr.which === "max" ? "최대" : "최소"}</b> 몇 개일까요?`)
      : (HIDDEN_ASK[s] || base.ask);
  } else if (type === "manip") {
    const s = pr.sub || "H-c";
    if (s === "H-d") {
      // 직육면체로 일반화되면서 치수를 발문에 밝힌다 — 겨냥도만으로 안쪽까지 세는 문항이 아니고,
      // 공식으로 푸는 문항이라 치수가 조건이다(정육면체 시절엔 '한 변 n'이 그림에 보였다).
      const bx = pr.box || [pr.n, pr.n, pr.n];
      const dims = bx[0] === bx[1] && bx[1] === bx[2] ? `한 변이 <b>${bx[0]}개</b>인 정육면체`
                                                      : `가로 <b>${bx[0]}</b>·세로 <b>${bx[1]}</b>·높이 <b>${bx[2]}</b>개인 직육면체`;
      ask = `${dims}의 겉면을 모두 색칠한 뒤 낱개로 떼어내면, <b>${PAINT_K[pr.k]}</b> 쌓기나무는 몇 개일까요?`;
    }
    else if (s === "H-a" || s === "H-b") {
      form = "draw"; unit = "";
      ask = (pr.delta > 0 ? `표시한 줄에 <b>${pr.delta}개를 더 쌓은</b> 뒤` : `표시한 줄에서 <b>${-pr.delta}개를 빼낸</b> 뒤`)
          + "의 <b>위·앞·옆에서 본 모양</b>을 각 칸을 칠해 그리세요.";
    } else ask = "이 모양에 쌓기나무를 더 놓아 <b>가장 작은 정육면체</b>를 만들려고 해요. 몇 개가 더 필요할까요?";
  }
  // facesDraw — 발문이 답란과 어긋나면 안 된다.
  //   위모양을 제시물로 주면 top 이 답에서 빠져 답란은 앞·옆 2칸인데, 발문만 "위·앞·옆"이면
  //   아이가 없는 칸을 찾는다(인쇄 실촬영에서 실제로 이 불일치가 나왔다).
  if (type === "facesDraw" && pr.views && pr.views.length) {
    const L: Record<string, string> = { top: "위", front: "앞", side: "옆" };
    const names = pr.views.map((v: string) => L[v] || v).join("·");
    ask = "쌓기나무로 쌓은 모양입니다. <b>" + names + "</b>에서 본 모양을 각 칸을 칠해 그려 보세요.";
  }

  // ── 문말 단서 (문제집 관행) ──
  if (type === "surface") ask += NOTE_SURFACE;
  if (type === "hidden" && (pr.sub || "") === "A-f") ask += NOTE_KINDS;
  // 위모양을 함께 주고 숨은 열을 1로 고정한 6종에만. 이 규약이 있어야 답이 유일해진다.
  if (pr.withTop && pr.hasHidden) ask += NOTE_HIDDEN1;
  return { ask, form, unit };
}

// 렌더용 질문 데이터(_gp). **정답은 절대 넣지 않는다.**
//   예전엔 q.correct(facesMc 정답 번호)·q.rc(min/max)·q.kinds(A-f 정답)를 그대로 보내
//   JSON 에서 숫자 하나만 읽으면 답이 나왔다. 지금은 전부 /grade 응답으로만 간다.
// **dim = 제시물(given)의 형태**다. "클라가 어떤 뷰어를 띄울지"가 아니다.
//   dim==="3d" 일 때만 형상(sh)을 보낸다 — 돌려서 가려진 나무를 확인하는 것이 풀이 과정이라
//   그때는 은닉이 설계상 불가능하다(수용). dim==="2d" 면 서버가 겨냥도를 그려 보내고
//   형상은 보내지 않는다 → **2D 모드에서는 은닉이 성립한다.**
//
// 형상을 안 보내는 유형. 이 넷은 스테이지와 무관하게 제시물이 이미 서버가 그린 2D 다.
//   ⚠ 예전엔 이들이 STAGES[stage].dim 을 그대로 물려받아 S2·S3 에서 q.dim==="3d" 라고
//     **거짓말을 했다** — 형상이 없어 3D 를 띄우는 것 자체가 불가능한데도. dim 은 스테이지
//     단위인데 given 은 유형·서브 단위로 정해진다는 어긋남이 원인이었다.
const GIVEN_ONLY: Record<string, 1> = { hidden: 1, minmax: 1, manip: 1, facesDraw: 1 };

// 최종 dim 은 "3d" | "2d" 둘 중 하나뿐이다. "any"(스테이지 정책)는 여기서 소멸한다 —
//   밖으로 내보내면 클라가 다시 추측해야 해서 판단의 단일 출처가 깨진다.
export function resolveDim(stage: string | null, type: string, req?: string | null): "3d" | "2d" {
  // facesDraw 가 2D 인 이유(사용자 결정 260821): ① 위모양 + 문말 단서로 답이 이미 유일하다.
  //   ② 오히려 3D 를 앞·옆으로 돌리면 **답 실루엣을 그대로 읽을 수 있어** 문항이 무의미해진다.
  if (GIVEN_ONLY[type]) return "2d";
  // 저학년(S0~S3)은 겨냥도를 아직 안 배웠으므로(초5에서 처음 나온다) 3D 고정이 요청보다 우선한다.
  const sd = stage && genConfig.STAGES[stage] ? genConfig.STAGES[stage].dim : "any";
  if (sd === "3d") return "3d";
  return req === "2d" ? "2d" : "3d";               // dim:"any" 스테이지(S4·S5)만 요청을 받는다
}

export function questionFor(pr: Sh, idx: number, seed: string, type: string, reqDim?: string | null) {
  const sh = pr.sh;
  const spec = presentSpec(pr, type);
  const stage = pr.stage ?? null;
  // ⚠ dim 은 **표현 전용**이다. 절대 buildProbs/genSession 에 넘기지 말 것 —
  //   /generate(dim 있음)와 /grade(dim 없음)의 rng 스트림이 갈라져 조용한 오채점이 난다.
  //   answerKeyFor·explainFor 도 dim 을 모른다. 그래서 gsig(paramsHash)에도 넣지 않는다.
  const dim = resolveDim(stage, type, reqDim);
  const q: any = { level: pr.level ?? pr.lv, type, stage, dim, ask: spec.ask, form: spec.form, unit: spec.unit };

  if (type === "minmax") {
    const gsub = pr.sub || "G-a";
    q.sub = gsub;
    if (gsub === "G-b") {
      // 위모양 + '한 방향' 실루엣만. dir 은 무엇을 보여주는지라 답이 아니다.
      q.which = pr.which; q.dir = pr.dir;
      q.given = { gx: sh.gx, gz: sh.gz, kind: "topOneSil", top: topSil(sh), dir: pr.dir,
                  bars: pr.dir === "side" ? sideSil(sh) : frontSil(sh) };
    } else if (gsub === "G-c") {
      // 겨냥도 + "n층 이상". n 은 조건(문제의 일부)이지 답이 아니다.
      // gen 이 숨은 열 없는 모양만 주므로 겨냥도만으로 모든 열의 높이를 읽을 수 있다.
      q.n = pr.n;
      q.given = { gx: sh.gx, gz: sh.gz, kind: "isoTop", n: pr.n,
                  iso: iso.renderIso({ gx: sh.gx, gz: sh.gz, cells: sh.cells }, 0), top: topSil(sh) };
    } else {
      q.which = pr.which;                                 // 무엇을 묻는지(최소/최대/차) — 답이 아니다
      q.given = { gx: sh.gx, gz: sh.gz, kind: "sils", sils: silTrio(sh) };
    }
    return q;
  }
  if (type === "manip") {
    const msub = pr.sub || "H-c";
    q.sub = msub;
    if (msub === "H-d") {
      // 상자 치수·k 는 문제의 조건이지 답이 아니다(답 = 그 조건에서의 개수).
      q.n = pr.n; q.k = pr.k; q.box = pr.box || null;
      q.box = pr.box || null;
      q.given = { gx: sh.gx, gz: sh.gz, kind: "paintedCube", n: pr.n, box: pr.box || null,
                  iso: iso.renderIso({ gx: sh.gx, gz: sh.gz, cells: sh.cells }, 0,
                                     null, { paint: { L: "#7fb3e8", R: "#5b93cc", T: "#a9d1f5" } }) };
    } else if ((msub === "H-a" || msub === "H-b") && pr.resSh) {
      // 표시된 열을 빨강으로(ghost:false = 나머지는 흐리게 하지 않는다). 표시 열·변화량은 조건이지 답이 아니다.
      const p = String(pr.target).split(",").map(Number);
      const h0 = sh.hmap[p[0]][p[1]];
      const hi = new Set<string>();
      for (let y = 0; y < h0; y++) hi.add(p[0] + "," + y + "," + p[1]);
      q.target = pr.target; q.delta = pr.delta;
      // maxH 는 답안 격자의 행 수다. **조작 후 실제 높이가 아니라 등급 maxH** 를 보낸다 —
      // 결과 높이로 격자를 그리면 격자 크기가 정답을 흘린다.
      q.given = { gx: sh.gx, gz: sh.gz, maxH: sh.maxH, kind: "isoMark", delta: pr.delta,
                  iso: iso.renderIso({ gx: sh.gx, gz: sh.gz, cells: sh.cells }, 0, hi, { ghost: false }) };
    } else {
      // 겨냥도만. gen 이 숨은 열 없는 모양만 주므로 개수를 셀 수 있다. m·need 는 답이라 미전송.
      q.given = { gx: sh.gx, gz: sh.gz, kind: "isoTop",
                  iso: iso.renderIso({ gx: sh.gx, gz: sh.gz, cells: sh.cells }, 0), top: topSil(sh) };
    }
    return q;
  }
  if (type === "hidden") {
    q.sub = pr.sub;
    if (pr.sub === "A-d") q.which = pr.which;
    q.given = hiddenGiven(pr, sh);
    return q;
  }

  if (dim === "3d") {
    q.sh = sh;
  } else {
    // 2D = 제시물이 서버가 그린 겨냥도 한 장이다. 형상을 안 보내므로 클라가 돌릴 수 없고,
    //   돌릴 수 없으니 heightmap·facesMc 의 "답란은 회전을 모른다" 결함도 함께 사라진다.
    //   maxH 는 답안 격자의 행 수(H-a/H-b 의 isoMark 가 이미 같은 이유로 싣는 값)다.
    q.given = { gx: sh.gx, gz: sh.gz, maxH: sh.maxH, kind: "isoTop",
                iso: iso.renderIso({ gx: sh.gx, gz: sh.gz, cells: sh.cells }, 0), top: topSil(sh) };
    // ⚠ 여기서 q.sh 를 보내지 않는 것이 2D 은닉의 전부다. 되돌리지 말 것 —
    //   260821~260830 동안 옛 클라 호환용으로 함께 보내던 줄이 있었고, 그 기간엔
    //   2D 은닉이 성립하지 않았다(facesDraw·2D facesMc 는 정답이 sh 만의 함수라
    //   문항과 정답을 같이 배송한 셈이었다). 260830 삭제.
    //   클라는 이미 given.iso 로 그린다: run.js(givenShape→_partial) ·
    //   worksheets(FIG.renderGiven 이 given 분기 우선) · quiz 미리보기(is3D=false).
  }
  // ⚠ 모서리 길이. 발문에는 안 들어 있고 오직 이 값으로만 학생에게 전달된다.
  //   ① 2D 는 형상이 없어 클라가 sh.edge 를 못 읽는다(givenShape 는 edge:1 하드코딩) —
  //      안 보내면 edge≠1 인 문항이 "한 모서리 = 1cm" 로 표시돼 전원 오답.
  //   ② /worksheets 독립 생성은 예전부터 이 값을 아예 못 받아 **모서리 길이 없이 인쇄**됐다
  //      (그 문구가 run.js 에만 있었다). 한 필드로 두 경로를 함께 고친다.
  if (type === "volume" || type === "surface") q.edge = sh.edge;

  // ── 위에서 본 모양 동봉 (겨냥도 6종) ──
  //   겨냥도만 주면 숨은 열의 높이가 정해지지 않아 종이에서 답이 유일하지 않다.
  //   시중 문제집 3종이 예외 없이 위모양을 함께 주고, 숨은 열은 1개로 규약한다.
  //   생성기가 capHiddenToOne 으로 그 규약을 이미 지켰으므로, 위모양만 붙이면 답이 유일해진다.
  //   → 이 6종이 3D 회전 없이도 지면에서 풀린다.
  //   ⚠ facesMc·facesDraw 는 위모양이 곧 정답의 일부다. 그래서 이 둘은 생성기가
  //     묻는 방향에서 top 을 빼 두고(gen: dir·views), 대신 위모양을 제시물로 준다.
  //     이것이 문제집의 표준 조합이다 — "위에서 본 모양 + 겨냥도 → 앞·옆 그리기".
  if (pr.withTop) q.top = topSil(sh);
  // facesDraw 출제 형식 — 그릴 방향. 모양 1개면 세 면, 여러 개면 한 면(§4.8).
  //   답란도 이 방향만 그려야 한다(안 그리면 빈 격자가 정답인 것처럼 보인다).
  if (type === "facesDraw") q.views = pr.views || ["top", "front", "side"];
  if (type === "facesMc") {
    const dir = pr.dir;
    const correctSil = dir === "front" ? frontSil(sh) : dir === "side" ? sideSil(sh) : topSil(sh);
    // 보기 순서만 보낸다. 정답 인덱스는 answerKeyFor 가 같은 rng 시드로 재생성하므로 보낼 필요가 없다.
    q.dir = dir; q.opts = makeSilOpts(correctSil, gen.rngFrom(seed + ":o" + idx)).opts;
  }
  return q;
}

// 해설용 페이로드 — 제출 후이므로 모양을 밝혀도 된다.
// 클라는 이걸로 모양을 되만들어 기존 해설 렌더러를 그대로 쓴다(격자 크기가 있어야 바닥판이 원본과 같다).
export function explainFor(pr: Sh, type: string) {
  const sh = pr.sh, cs = coreShape(sh);
  const ex: any = { cells: cs.cells, edge: sh.edge, gx: sh.gx, gz: sh.gz, maxH: sh.maxH };
  if (type === "hidden") {
    ex.sub = pr.sub; ex.hiddenCols = pr.hcols || [];     // 숨은 열(위치) 강조
    if (pr.sub === "A-d" && core.reverseShapes) ex.minMax = core.reverseShapes(cs);
  }
  if (type === "manip") {
    const msub = pr.sub || "H-c";
    ex.sub = msub;
    if (msub === "H-d") {
      ex.n = pr.n; ex.k = pr.k; ex.all = mp.paintedCubeAll(pr.n);   // [0면,1면,2면,3면]
    } else if ((msub === "H-a" || msub === "H-b") && pr.resSh) {
      // 해설의 주인공은 '바뀐 뒤' 모양이다 → cells 를 결과로 바꾸고 원본은 따로 담는다.
      const rs = coreShape(pr.resSh);
      ex.beforeCells = ex.cells; ex.cells = rs.cells;
      ex.gx = pr.resSh.gx; ex.gz = pr.resSh.gz; ex.maxH = pr.resSh.maxH;
      ex.target = pr.target; ex.delta = pr.delta;
    } else {
      const cc = mp.completeCube(core.heightMap(cs));
      ex.m = cc.m; ex.total = cc.total; ex.count = cc.count; ex.need = cc.need;
    }
  }
  if (type === "minmax") {
    const gsub = pr.sub || "G-a";
    ex.sub = gsub;
    if (gsub === "G-c") {
      // 어느 칸이 조건을 만족했는지 = 위모양에서 n 이상인 칸
      const hm = core.heightMap(cs);
      ex.n = pr.n;
      ex.hitCells = Object.keys(hm).filter((k) => hm[k] >= pr.n);
      ex.heights = hm;
    } else if (gsub === "G-b") {
      ex.dir = pr.dir;
      ex.rc = mm.minmaxFromTopAndSil(core.heightMap(cs), pr.dir || "front");
      ex.byLine = mm.groupByAxis(core.heightMap(cs), pr.dir || "front");   // 줄별 (실루엣 높이, 칸 수)
    } else if (core.reverseShapes) {
      ex.minMax = core.reverseShapes(cs);
    }
  }
  return ex;
}
