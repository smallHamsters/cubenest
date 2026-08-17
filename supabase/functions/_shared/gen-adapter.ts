// CubeNest Edge Functions — gen/core 어댑터 (서버 전용 생성기)
// ─────────────────────────────────────────────────────────────────────────
// 역할: gen 출력 → API 페이로드 (answerKey · checkAnswer · question · present · explain).
// core·gen·gen-config 의 서버 이식은 완료됐다. 값은 반드시 gen-modules.ts 한 곳에서만
// 가져온다 — 로드 순서(core→genConfig→hidden→gen)와 번들 포함을 거기서 보장한다.
// ─────────────────────────────────────────────────────────────────────────

import { core, gen, GEN_CONFIG } from "./gen-modules.ts";

// deno-lint-ignore no-explicit-any
type Sh = any;

export function coreShape(sh: Sh) {
  return { gx: sh.gx, gy: sh.maxH, gz: sh.gz, edge: sh.edge,
           cells: sh.cells.map((c: any) => [c.x, c.y, c.z]) };
}

// 세션을 seed+params로 결정적으로 재생성 (generate·grade 공통)
export function buildProbs(p: {
  type: string; levels: string[]; seed: string; n: number; edu?: string | null; sub?: string | null;
}): Sh[] {
  return gen.genSession({
    type: p.type, levels: p.levels, seed: p.seed, n: p.n,
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
    q.sub = pr.sub;                       // A-a~f: 클라가 위젯·제시 선택
    if (pr.sub === "A-d") { q.which = pr.which; q.rc = pr.rc; }  // 삼면도 최대/최소
    if (pr.sub === "A-f") { q.kinds = pr.kinds; }                // 종류 수(로컬 즉시피드백용)
    // 주의: hcols·hasHidden·kinds(정답)는 전달하지 않음.
    // A-a/b/f 정답 은닉은 서버 renderIso(4단계)로 완성(현재 sh 전달=솔리드 파생가능, 8유형과 동일 수준).
  }
  return q;
}

export function explainFor(pr: Sh, type: string) {
  const sh = pr.sh, cs = coreShape(sh);
  const ex: any = { cells: cs.cells, edge: sh.edge };
  if (type === "hidden") {
    ex.sub = pr.sub; ex.hiddenCols = pr.hcols || [];     // 숨은 열(위치) 강조
    if (pr.sub === "A-d" && core.reverseShapes) ex.minMax = core.reverseShapes(cs);
  }
  if (type === "minmax" && core.reverseShapes) ex.minMax = core.reverseShapes(cs);
  return ex;
}
