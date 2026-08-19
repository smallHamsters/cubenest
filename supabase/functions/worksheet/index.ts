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
  const stage = body.stage ?? null;                 // 연령 스테이지(quiz 위임분과 같은 값이어야 같은 문제)
  const sub = body.sub ?? null;
  // theme 은 단일 유형일 때만 필수다. mix(혼합 문제지)로 오면 각 항목이 theme 을 갖는다.
  const hasMix = Array.isArray(body.mix) && body.mix.length > 0;
  if (!theme && !hasMix) return json(req, { error: "theme 또는 mix 필요" }, 400);
  if (hasMix && body.mix.some((e: any) => !(e && (e.theme ?? e.type)))) {
    return json(req, { error: "mix 항목마다 theme 필요" }, 400);
  }

  // 정답까지 나가는 경로라 대량 수집을 막는다(익명 쿠키 + IP).
  let rl: { ok: boolean; retryAfter?: number; reason?: string };
  try { rl = await checkRate(req, "worksheet"); } catch { rl = { ok: true }; }
  if (!rl.ok) {
    const r = json(req, { error: "rate", reason: rl.reason }, 429);
    r.headers.set("Retry-After", String(rl.retryAfter ?? 60));
    return r;
  }

  // 혼합 문제지: mix=[{theme,sub?,n}] 를 주면 여러 유형을 한 장에 담는다.
  //   각 항목은 seed#i 로 **독립 스트림**을 쓴다 — 같은 seed 로 언제나 같은 문제지가 나온다(재현·공유).
  const mix: any[] | null = hasMix ? body.mix : null;
  const entries = mix ? mix : [{ theme, sub, n }];
  const total = entries.reduce((a: number, e: any) => a + Math.max(1, (e.n | 0) || 1), 0);
  if (total > MAX_N) return json(req, { error: "문항이 너무 많아요", max: MAX_N }, 400);

  try {
    const problems: any[] = [];
    entries.forEach((en: any, e: number) => {
      const th = en.theme ?? en.type ?? theme;
      const esub = en.sub ?? null;
      const cnt = Math.max(1, (en.n | 0) || 1);
      const s = mix ? seed + "#" + e : seed;
      buildProbs({ type: th, levels, seed: s, n: cnt, edu, sub: esub, stage }).forEach((pr: any, i: number) => {
        const q = questionFor(pr, i, s, th);              // 발문·폼·단위·제시물(given/sh)
        const key = answerKeyFor(th, pr, i, s);           // ← /generate 와 다른 점: 정답 포함
        problems.push({
          index: problems.length, type: th, sub: pr.sub ?? null, level: pr.level ?? pr.lv,
          ask: q.ask, form: q.form, unit: q.unit,
          given: q.given ?? null, sh: q.sh ?? null,
          opts: q.opts ?? null,                           // facesMc 보기
          views: q.views ?? null,                         // facesDraw 그릴 방향(§4.8) — 답란이 이것만 낸다
          top: q.top ?? null,                             // 위에서 본 모양(겨냥도 6종) — 지면 결정성의 핵심
          box: q.box ?? null,                             // manip H-d 상자 치수
          stage: q.stage ?? null, dim: q.dim ?? null,
          answerKey: key,
        });
      });
    });
    return json(req, { seed, count: problems.length, problems });
  } catch (e) {
    return json(req, { error: "worksheet 생성 실패", detail: String((e as Error).message) }, 500);
  }
});
