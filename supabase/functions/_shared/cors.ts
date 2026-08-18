// CubeNest Edge Functions — CORS (정적 GitHub Pages ↔ Supabase Edge, 크로스오리진)
// 허용 오리진: 배포(Pages) + 로컬 개발. 환경변수 ALLOWED_ORIGINS(콤마구분)로 덮어쓰기 가능.
const DEFAULT_ORIGINS = [
  "https://smallhamsters.github.io",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
];

function allowed(): string[] {
  const env = Deno.env.get("ALLOWED_ORIGINS");
  return env ? env.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_ORIGINS;
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const list = allowed();
  const ok = origin && list.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin! : list[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",   // GET = /config(UI 메타)
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Anon-Id",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

// 프리플라이트 및 공통 응답 헬퍼
export function preflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("Origin")) });
  }
  return null;
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req.headers.get("Origin")), "Content-Type": "application/json" },
  });
}
