// CubeNest Edge Function — POST /functions/v1/grade
// gsig 검증 → seed+index로 문제 재생성 → 채점 → {correct, answerKey, explain}
import { preflight, json } from "../_shared/cors.ts";
import { paramsHash, verify } from "../_shared/gsig.ts";
import { buildProbs, answerKeyFor, checkAnswer, explainFor } from "../_shared/gen-adapter.ts";
import { checkRate } from "../_shared/rate.ts";

Deno.serve(async (req: Request) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== "POST") return json(req, { error: "method" }, 405);

  let rl: { ok: boolean; retryAfter?: number; reason?: string };
  try { rl = await checkRate(req, "grade"); } catch { rl = { ok: true }; }
  if (!rl.ok) {
    const r = json(req, { error: "rate", reason: rl.reason }, 429);
    r.headers.set("Retry-After", String(rl.retryAfter ?? 60));
    return r;
  }

  let body: any;
  try { body = await req.json(); } catch { return json(req, { error: "bad json" }, 400); }

  const { id, gsig, answer, params } = body;
  if (!id || !gsig) return json(req, { error: "id/gsig 필요" }, 400);
  if (!params || !(params.theme ?? params.type)) return json(req, { error: "params 필요" }, 400);

  const theme = params.theme ?? params.type;
  const levels = Array.isArray(params.levels) ? params.levels : ["중"];
  const n = Math.min(30, Math.max(1, params.n | 0 || 10));
  const edu = params.edu ?? null;

  // 위·변조 검증: id + paramsHash 서명 일치?
  const ph = paramsHash({ theme, levels, n, edu });
  if (!(await verify(id, ph, gsig))) return json(req, { error: "gsig 불일치" }, 403);

  const [seed, idxStr] = String(id).split("#");
  const idx = parseInt(idxStr, 10);

  let pr: any;
  try {
    const probs = buildProbs({ type: theme, levels, seed, n, edu });
    pr = probs[idx];
  } catch (e) {
    return json(req, { error: "재생성 실패", detail: String((e as Error).message) }, 500);
  }
  if (!pr) return json(req, { error: "index 범위 밖" }, 400);

  try {
    const key = answerKeyFor(theme, pr, idx, seed);
    const correct = checkAnswer(theme, answer, key);
    const explain = explainFor(pr, theme);
    return json(req, { correct, answerKey: key, explain });
  } catch (e) {
    return json(req, { error: "grade 실패", detail: String((e as Error).message) }, 500);
  }
});
