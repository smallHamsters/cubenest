// CubeNest Edge Function — POST /functions/v1/grade
// gsig 검증 → seed+index로 문제 재생성 → 채점 → {correct, answerKey, explain}
import { preflight, json } from "../_shared/cors.ts";
import { paramsHash, verify } from "../_shared/gsig.ts";
import { buildProbs, answerKeyFor, checkAnswer, explainFor } from "../_shared/gen-adapter.ts";
import { checkRate } from "../_shared/rate.ts";

Deno.serve(async (req: Request) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== "POST") return json(req, { error: "method" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json(req, { error: "bad json" }, 400); }

  const { id, gsig, answer, params } = body;
  if (!id || !gsig) return json(req, { error: "id/gsig 필요" }, 400);
  if (!params || !(params.theme ?? params.type)) return json(req, { error: "params 필요" }, 400);

  const theme = params.theme ?? params.type;
  const levels = Array.isArray(params.levels) ? params.levels : ["중"];
  const n = Math.min(30, Math.max(1, params.n | 0 || 10));
  const edu = params.edu ?? null;
  const stage = params.stage ?? null;               // /generate 와 같은 값이어야 재생성이 일치한다

  /* rate limit — 260831 활성화. 종전엔 "유효 gsig 는 rate 걸린 /generate 에서만 나온다"는
     전제로 생략했는데(DB 왕복 지연 회피), **그 전제가 깨져 있었다** — X-Anon-Id 는 클라가
     만드는 헤더라 매 요청 랜덤화하면 generate 의 쿠키 버킷을 빠져나간다.
     게다가 이 함수는 answer:null 이어도 answerKey 와 explain(형상 전체)을 무조건 주는
     **정답 오라클**이라, 한 번 받은 gsig 30개로 무제한 열람이 가능했다.
     ⚠ 위치: 400 검증 **뒤**, verify() **앞**.
       앞에 두면 형식이 틀린 요청까지 버킷을 만들어 rate_counter 를 오염시킨다(260830 청소와 상충).
       뒤에 두면 gsig 위조 시도가 무제한이 된다. 그 사이가 맞다.
     지연: 제출마다 DB 왕복 1회가 는다. FAIL_OPEN=true 라 DB 장애 시엔 통과시켜 채점이 막히지 않고,
       클라는 250ms 지연 로더(run.js Loader.showDelayed('grade',250))를 이미 갖고 있다. */
  let rl: { ok: boolean; retryAfter?: number; reason?: string };
  try { rl = await checkRate(req, "grade"); } catch { rl = { ok: true }; }
  if (!rl.ok) {
    const r = json(req, { error: "rate", reason: rl.reason }, 429);
    r.headers.set("Retry-After", String(rl.retryAfter ?? 60));
    return r;
  }

  // 위·변조 검증: id + paramsHash 서명 일치?
  //   ⚠ sub 는 **아래 buildProbs 에 넘기는 값과 같은 표현식**이어야 한다(:36 부근).
  const ph = paramsHash({ theme, levels, n, edu, stage, sub: params.sub ?? null });
  if (!(await verify(id, ph, gsig))) return json(req, { error: "gsig 불일치" }, 403);

  const [seed, idxStr] = String(id).split("#");
  const idx = parseInt(idxStr, 10);

  let pr: any;
  try {
    const probs = buildProbs({ type: theme, levels, seed, n, edu, sub: params.sub ?? null, stage });
    pr = probs[idx];
  } catch (e) {
    console.error("[grade] 재생성 실패:", e);
    return json(req, { error: "재생성 실패" }, 500);
  }
  if (!pr) return json(req, { error: "index 범위 밖" }, 400);

  try {
    const key = answerKeyFor(theme, pr, idx, seed);
    const correct = checkAnswer(theme, answer, key);
    const explain = explainFor(pr, theme);
    return json(req, { correct, answerKey: key, explain });
  } catch (e) {
    console.error("[grade] 실패:", e);
    return json(req, { error: "grade 실패" }, 500);
  }
});
