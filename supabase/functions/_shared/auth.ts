// CubeNest Edge Functions — 요청자 인증(정답이 나가는 경로 전용)
// supabase-js 의존 제거: GoTrue 의 /auth/v1/user 를 순수 fetch 로 호출(rate.ts 와 같은 방식).
// 접속: Edge에 자동 주입되는 SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY 사용(추가 secret 불필요).
//
// 왜 있는가 — config.toml 의 verify_jwt=true(게이트웨이)가 유일한 방어선이면,
//   그 한 줄이 false 로 뒤집히는 순간 worksheet 의 answerKey 가 익명에게 그대로 나간다.
//   게이트웨이는 '첫 번째' 방어선이고 이 모듈이 '두 번째'다. 둘 중 하나를 중복이라며 지우지 말 것.
//
// ⚠ 실패 정책이 이웃 rate.ts 와 정반대다 — 맞추지 말 것.
//   rate.ts 는 FAIL_OPEN=true(서비스 우선: 카운터가 죽어도 문제는 풀리게).
//   여기는 fail-closed — env 누락·fetch 예외·비200 을 전부 미인증(null)으로 떨어뜨린다.
//   인증에서 fail-open 은 방어선이 아예 없는 것과 같다.

export type AuthUser = { id: string; email?: string; [k: string]: unknown };

export function bearer(req: Request): string | null {
  const h = req.headers.get("Authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : null;
}

// 유효한 로그인 사용자면 user, 아니면 null. 던지지 않는다(호출부가 401 로 변환).
export async function requireUser(req: Request): Promise<AuthUser | null> {
  const tok = bearer(req);
  if (!tok) return null;

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;            // fail-closed (rate.ts 와 다른 지점)

  try {
    // apikey 는 프로젝트 식별용이고, 신원 판정은 요청자 토큰(Authorization)이 한다.
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { "apikey": key, "Authorization": `Bearer ${tok}` },
    });
    if (!res.ok) return null;               // 만료·위조·차단된 사용자 전부 여기로
    const u = await res.json();
    return u && u.id ? u as AuthUser : null;
  } catch {
    return null;                            // fail-closed
  }
}
