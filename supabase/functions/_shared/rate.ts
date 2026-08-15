// CubeNest Edge Functions — rate limit (Postgres 카운터, 무료 전용)
// supabase-js 의존 제거: PostgREST RPC(check_rate)를 순수 fetch로 호출(가볍고 견고).
// 접속: Edge에 자동 주입되는 SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY 사용(추가 secret 불필요).
// 스키마=supabase_rate_schema_260815.sql

export const LIMITS = {
  generate: { cookie: { perMin: 20, perHour: 300 }, ip: { perMin: 120, perHour: 2000 } },
  grade:    { cookie: { perMin: 60, perHour: 1000 }, ip: { perMin: 120, perHour: 2000 } },
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

export async function checkRate(req: Request, kind: "generate" | "grade"): Promise<RateResult> {
  const { anon, ip } = identify(req);
  const L = LIMITS[kind];
  const now = Date.now();
  const wm = Math.floor(now / 60_000), wh = Math.floor(now / 3_600_000);

  const checks: Array<{ bucket: string; limit: number; ttl: number; reason: string }> = [];
  if (anon) {
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
