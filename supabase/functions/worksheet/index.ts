// CubeNest Edge Function — POST /functions/v1/worksheet
// 문제지용: 문제 + **정답**을 함께 준다. /generate 와 달리 정답이 들어가므로 로그인 필수.
//   마스터 §6.7 "유료·고가치(워크시트 정답지·대량 문항)는 로그인·이용권 후 서버 생성".
//   config.toml 에서 verify_jwt=true → Supabase 게이트웨이가 JWT 를 먼저 검증한다
//   (generate·grade 는 무료 익명 플레이라 false 를 유지 — 여기만 다르다).
import { preflight, json } from "../_shared/cors.ts";
import { buildProbs, answerKeyFor, questionFor } from "../_shared/gen-adapter.ts";
import { checkRate } from "../_shared/rate.ts";

const MAX_N = 30;

Deno.serve(async (req: Request) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== "POST") return json(req, { error: "method" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json(req, { error: "bad json" }, 400); }

  const theme = body.theme ?? body.type;
  const levels = Array.isArray(body.levels) && body.levels.length ? body.levels : ["중"];
  const n = Math.min(MAX_N, Math.max(1, body.n | 0 || 10));
  const seed = (body.seed && String(body.seed)) || Math.random().toString(36).slice(2, 9);
  const edu = body.edu ?? null;
  const sub = body.sub ?? null;
  if (!theme) return json(req, { error: "theme 필요" }, 400);

  // 정답까지 나가는 경로라 대량 수집을 막는다(익명 쿠키 + IP).
  let rl: { ok: boolean; retryAfter?: number; reason?: string };
  try { rl = await checkRate(req, "worksheet"); } catch { rl = { ok: true }; }
  if (!rl.ok) {
    const r = json(req, { error: "rate", reason: rl.reason }, 429);
    r.headers.set("Retry-After", String(rl.retryAfter ?? 60));
    return r;
  }

  try {
    const probs = buildProbs({ type: theme, levels, seed, n, edu, sub });
    const problems = probs.map((pr: any, i: number) => {
      const q = questionFor(pr, i, seed, theme);          // 발문·폼·단위·제시물(given/sh)
      const key = answerKeyFor(theme, pr, i, seed);       // ← /generate 와 다른 점: 정답 포함
      return {
        index: i, type: theme, sub: pr.sub ?? null, level: pr.level ?? pr.lv,
        ask: q.ask, form: q.form, unit: q.unit,
        given: q.given ?? null, sh: q.sh ?? null,
        opts: q.opts ?? null,                             // facesMc 보기
        answerKey: key,
      };
    });
    return json(req, { seed, count: problems.length, problems });
  } catch (e) {
    return json(req, { error: "worksheet 생성 실패", detail: String((e as Error).message) }, 500);
  }
});
