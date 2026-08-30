// CubeNest Edge Function — POST /functions/v1/generate
// 문제 세트 생성(정답 미포함). 무료=익명(rate limit) / 유료=JWT.
import { preflight, json } from "../_shared/cors.ts";
import { paramsHash, sign } from "../_shared/gsig.ts";
import { buildProbs, questionFor } from "../_shared/gen-adapter.ts";
import { checkRate } from "../_shared/rate.ts";

Deno.serve(async (req: Request) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== "POST") return json(req, { error: "method" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json(req, { error: "bad json" }, 400); }

  const theme = body.theme ?? body.type;
  const levels = Array.isArray(body.levels) ? body.levels : ["중"];
  const n = Math.min(30, Math.max(1, body.n | 0 || 10));
  const seed = (body.seed && String(body.seed)) || Math.random().toString(36).slice(2, 9);
  const edu = body.edu ?? null;
  const stage = body.stage ?? null;                 // 연령 스테이지(S2~S5). 없으면 서버 기본 S4(초6)
  // 제시물의 형태 요청. 화이트리스트로만 받는다(그 외는 null = 서버 기본).
  //   ⚠ buildProbs·paramsHash 에는 절대 넣지 않는다 — dim 은 정답을 바꾸지 않으므로
  //     지문에 넣으면 진행 중이던 세션·공유 링크의 gsig 가 전부 403 이 된다(stage 때 겪었다).
  const dim = body.dim === "2d" ? "2d" : body.dim === "3d" ? "3d" : null;
  if (!theme) return json(req, { error: "theme 필요" }, 400);

  // TODO: 매트릭스 검증(theme,given,ask,subtype 존재 조합인지)
  let rl: { ok: boolean; retryAfter?: number; reason?: string };
  try { rl = await checkRate(req, "generate"); } catch { rl = { ok: true }; }
  if (!rl.ok) {
    const r = json(req, { error: "rate", reason: rl.reason }, 429);
    r.headers.set("Retry-After", String(rl.retryAfter ?? 60));
    return r;
  }

  try {
    const probs = buildProbs({ type: theme, levels, seed, n, edu, sub: body.sub ?? null, stage });
    const ph = paramsHash({ theme, levels, n, edu, stage });
    const problems = await Promise.all(probs.map(async (pr: any, i: number) => {
      const id = seed + "#" + i;
      return {
        id, index: i,
        theme, given: body.given ?? null, ask: body.ask ?? null,
        type: pr.type, level: pr.level ?? pr.lv,
        // present(모양 통째 중복)는 폐지 — 클라 소비처가 없는데 모양만 한 번 더 노출시켰다.
        grade: "server", answerKey: null,
        gsig: await sign(id, ph),
        _gp: questionFor(pr, i, seed, theme, dim),   // 렌더용 질문 데이터(현행 run 호환)
      };
    }));
    return json(req, { seed, version: { gen: "1.0.0", config: "1.0.0" }, count: problems.length, problems });
  } catch (e) {
    // 내부 예외 메시지를 응답에 싣지 않는다 — GSIG_SECRET 미설정 같은 환경변수명·내부 구조가
    //   그대로 나갔다. 진단은 함수 로그로 옮긴다(클라는 error 라벨만 받아 분기한다).
    console.error("[generate] 실패:", e);
    return json(req, { error: "generate 실패" }, 500);
  }
});
