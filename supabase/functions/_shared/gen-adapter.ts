// CubeNest Edge Functions — gen/core 어댑터 (서버 전용 생성기)
// ─────────────────────────────────────────────────────────────────────────
// 역할: gen 출력 → API 페이로드 (answerKey · checkAnswer · question · present · explain).
// core·gen·gen-config 의 서버 이식은 완료됐다. 값은 반드시 gen-modules.ts 한 곳에서만
// 가져온다 — 로드 순서(core→genConfig→hidden→gen)와 번들 포함을 거기서 보장한다.
// ─────────────────────────────────────────────────────────────────────────

import { core, gen, iso, minmax as mm, GEN_CONFIG } from "./gen-modules.ts";

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

// 렌더용 질문 데이터(_gp). **정답은 절대 넣지 않는다.**
//   예전엔 q.correct(facesMc 정답 번호)·q.rc(min/max)·q.kinds(A-f 정답)를 그대로 보내
//   JSON 에서 숫자 하나만 읽으면 답이 나왔다. 지금은 전부 /grade 응답으로만 간다.
// 3D 회전을 쓰는 6종은 형상(sh)을 유지한다 — 돌려서 가려진 나무를 확인하는 것이 풀이 과정이라
// 은닉이 설계상 불가능하다(수용). minmax·hidden 은 3D 뷰어를 안 쓰므로 형상을 뺀다.
export function questionFor(pr: Sh, idx: number, seed: string, type: string) {
  const sh = pr.sh;
  const q: any = { level: pr.level ?? pr.lv, type };

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
  if (type === "hidden") {
    q.sub = pr.sub;
    if (pr.sub === "A-d") q.which = pr.which;
    q.given = hiddenGiven(pr, sh);
    return q;
  }

  q.sh = sh;
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
