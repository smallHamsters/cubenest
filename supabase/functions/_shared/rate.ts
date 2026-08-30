// CubeNest Edge Functions — rate limit (Postgres 카운터, 무료 전용)
// supabase-js 의존 제거: PostgREST RPC(check_rate)를 순수 fetch로 호출(가볍고 견고).
// 접속: Edge에 자동 주입되는 SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY 사용(추가 secret 불필요).
// 스키마=supabase_rate_schema_260815.sql

export const LIMITS = {
  generate:  { cookie: { perMin: 20, perHour: 300 }, ip: { perMin: 120, perHour: 2000 } },
  grade:     { cookie: { perMin: 60, perHour: 1000 }, ip: { perMin: 120, perHour: 2000 } },
  // 문제지: 정답까지 나가는 경로라 더 조인다. 로그인 사용자가 한 장씩 만드는 용도라 넉넉하다.
  worksheet: { cookie: { perMin: 6, perHour: 60 }, ip: { perMin: 30, perHour: 300 } },
};

// 실패 시 정책: true=fail-open(허용, 서비스 우선) / false=fail-closed(차단)
const FAIL_OPEN = true;

export function identify(req: Request): { anon: string | null; ip: string } {
  const anon = req.headers.get("X-Anon-Id");
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim()
    || req.headers.get("cf-connecting-ip") || "0.0.0.0";
  return { anon: anon && anon.length <= 64 ? anon : null, ip };
}

export type RateResult = { ok: boolean; retryAfter?: number; reason?: string };

/* subject = **위조 불가한 신원**(JWT 로 검증된 user.id). 주면 X-Anon-Id 를 **무시하고**
   그것으로 버킷을 잡는다 — 클라가 만드는 헤더는 매 요청 랜덤화하면 한도가 사라지지만,
   user.id 는 게이트웨이+requireUser 가 검증한 값이라 바꿔치기할 수 없다.
   ⚠ 네임스페이스를 `c:`(쿠키) 가 아니라 `u:` 로 분리한다. 같이 쓰면 공격자가
     `X-Anon-Id: <피해자 uid>` 로 남의 문제지 한도를 대신 태울 수 있다.
   ⚠ subject 가 있으면 anon 버킷을 **추가하지 않는다.** 둘 다 쓰면 헤더를 돌려 가며
     매번 새 버킷을 얻어 결국 우회가 된다.
   ⚠ 이 검사는 checks 배열의 **맨 앞**에 있어야 한다 — check_rate 는 한도를 넘긴
     순간 return 하므로, 앞에 둬야 IP 버킷 행이 더 만들어지지 않는다. */
export async function checkRate(
  req: Request,
  kind: keyof typeof LIMITS,
  subject?: string | null,
): Promise<RateResult> {
  const { anon, ip } = identify(req);
  const L = LIMITS[kind];
  const now = Date.now();
  const wm = Math.floor(now / 60_000), wh = Math.floor(now / 3_600_000);

  const checks: Array<{ bucket: string; limit: number; ttl: number; reason: string }> = [];
  const subj = subject && subject.length <= 64 ? subject : null;
  if (subj) {
    checks.push({ bucket: `u:${kind}:m:${subj}:${wm}`, limit: L.cookie.perMin,  ttl: 60,   reason: "user-min" });
    checks.push({ bucket: `u:${kind}:h:${subj}:${wh}`, limit: L.cookie.perHour, ttl: 3600, reason: "user-hour" });
  } else if (anon) {
    checks.push({ bucket: `c:${kind}:m:${anon}:${wm}`, limit: L.cookie.perMin, ttl: 60,   reason: "cookie-min" });
    checks.push({ bucket: `c:${kind}:h:${anon}:${wh}`, limit: L.cookie.perHour, ttl: 3600, reason: "cookie-hour" });
  }
  checks.push({ bucket: `i:${kind}:m:${ip}:${wm}`, limit: L.ip.perMin, ttl: 60,   reason: "ip-min" });
  checks.push({ bucket: `i:${kind}:h:${ip}:${wh}`, limit: L.ip.perHour, ttl: 3600, reason: "ip-hour" });

  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return { ok: FAIL_OPEN, reason: "no-db" };

  try {
    const res = await fetch(`${url}/rest/v1/rpc/check_rate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": key,
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({ checks }),
    });
    if (!res.ok) return { ok: FAIL_OPEN, reason: "rpc-" + res.status };
    const data = await res.json();
    return data && typeof data.ok === "boolean" ? data as RateResult : { ok: FAIL_OPEN, reason: "bad-rpc" };
  } catch {
    return { ok: FAIL_OPEN, reason: "exception" };
  }
}
