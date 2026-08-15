// CubeNest Edge Functions — gen/core 어댑터 (서버 전용 생성기)
// ─────────────────────────────────────────────────────────────────────────
// 이 파일은 "이식 자리"다. 실제 배포 시:
//   1) cubenest-core.js  → core.ts (또는 .js ESM): export const core = {...}
//   2) cubenest-gen.js   → gen.ts  (또는 .js ESM): export const gen  = {...}
//      - window.CubeNest 의존 제거, import { core } from "./core.ts"
//      - makeSilOpts·silSig·perturbSil·frontSil·sideSil·topSil·drawCorrect 도 서버로 이전
//   3) gen-config        → config.ts: export const GEN_CONFIG = {...}(정적 json 폐지)
// 아래 import 두 줄을 실제 모듈로 교체하면, 이 파일의 로직은 그대로 동작한다.
//   PoC의 mock 서버(cubenest-mock-server_260814_0003.js)의 answerKeyFor/check/헬퍼가 정본.
// ─────────────────────────────────────────────────────────────────────────

// TODO(이식): 실제 모듈로 교체
// import { core } from "./core.ts";
// import { gen } from "./gen.ts";
// import { GEN_CONFIG } from "./config.ts";
import { core, gen, GEN_CONFIG } from "./gen-modules.ts"; // ← 이식 산출물(아래 gen-modules.ts 참고)

// deno-lint-ignore no-explicit-any
type Sh = any;

export function coreShape(sh: Sh) {
  return { gx: sh.gx, gy: sh.maxH, gz: sh.gz, edge: sh.edge,
           cells: sh.cells.map((c: any) => [c.x, c.y, c.z]) };
}

// 세션을 seed+params로 결정적으로 재생성 (generate·grade 공통)
export function buildProbs(p: {
  type: string; levels: string[]; seed: string; n: number; edu?: string | null;
}): Sh[] {
  return gen.genSession({
    type: p.type, levels: p.levels, seed: p.seed, n: p.n,
    config: GEN_CONFIG, edu: p.edu ?? null, core,
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
function drawCorrectCells(sh: Sh){const d:any=drawDims(sh),out:string[]=[];
  ["top","front","side"].forEach((view)=>{const dd=d[view];for(let r=0;r<dd.rows;r++)for(let c=0;c<dd.cols;c++)if(drawCorrect(sh,view,c,r))out.push(view+","+c+","+r);});
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
      const rc = core.reverseCounts(cs), which = pr.which || "min";
      const val = which === "min" ? rc.minCount : which === "max" ? rc.maxCount : (rc.maxCount - rc.minCount);
      return { type: "num", value: val, min: rc.minCount, max: rc.maxCount, which };
    }
    case "hidden": {
      const hc = gen.hiddenCells ? gen.hiddenCells(sh, pr.hmode || "occ") : (pr.hcells || []);
      return { type: "num", value: (hc && hc.length) || 0 };
    }
    case "heightmap": {
      const hm = core.heightMap(cs), grid: Record<string, number> = {};
      for (let z = 0; z < sh.gz; z++) for (let x = 0; x < sh.gx; x++) {
        const h = (hm[z] && hm[z][x]) || 0; if (h > 0) grid[x + "," + z] = h;
      }
      return { type: "markCount", grid };
    }
    case "facesMc": {
      const dir = pr.dir, correctSil = dir === "front" ? frontSil(sh) : dir === "side" ? sideSil(sh) : topSil(sh);
      const built = makeSilOpts(correctSil, gen.rngFrom(seed + ":o" + idx));
      return { type: "mc", correct: built.correct };
    }
    case "facesDraw": return { type: "drawSil", cells: drawCorrectCells(sh) };
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

// present (현행: shape). 신규 은닉유형은 isoImage(서버 renderIso)로 확장 예정.
export function presentFor(pr: Sh) {
  const cs = coreShape(pr.sh);
  return { parts: [{ kind: "shape", cells: cs.cells, gx: pr.sh.gx, gz: pr.sh.gz, maxH: pr.sh.maxH, edge: pr.sh.edge }] };
}

// 렌더용 질문 데이터(_gp): 현행 클라 run이 문제를 그리는 데 필요한 필드.
// sh(hmap 포함)는 JSON 왕복되어 그대로 사용. facesMc 보기(opts)는 서버가 생성(같은 rng 스트림).
// ※ 현행 8유형은 솔리드가 보이므로 답 파생 가능(수용). 은닉유형(isoImage) 도입 시 이 페이로드를 축소한다.
export function questionFor(pr: Sh, idx: number, seed: string, type: string) {
  const q: any = { sh: pr.sh, level: pr.level ?? pr.lv, type };
  if (type === "facesMc") {
    const dir = pr.dir;
    const correctSil = dir === "front" ? frontSil(pr.sh) : dir === "side" ? sideSil(pr.sh) : topSil(pr.sh);
    const built = makeSilOpts(correctSil, gen.rngFrom(seed + ":o" + idx));
    q.dir = dir; q.opts = built.opts; q.correct = built.correct;
  } else if (type === "minmax") {
    q.which = pr.which; q.rc = pr.rc;
  } else if (type === "hidden") {
    q.hmode = pr.hmode; q.hcells = pr.hcells;
  }
  return q;
}

export function explainFor(pr: Sh, type: string) {
  const sh = pr.sh, cs = coreShape(sh);
  const ex: any = { cells: cs.cells, edge: sh.edge };
  if (type === "hidden" && gen.hiddenCells) ex.hiddenCells = gen.hiddenCells(sh, pr.hmode || "occ");
  if (type === "minmax" && core.reverseShapes) ex.minMax = core.reverseShapes(cs);
  return ex;
}
