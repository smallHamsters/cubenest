/* ============================================================================
 * CubeNest api-client — 실 Edge Function(Supabase) 연동
 *   window.CubeNest.api.generate(req) / .grade(req)  (mock과 동일 인터페이스)
 *   - 실 fetch: https://<proj>.supabase.co/functions/v1/{generate,grade}
 *   - X-Anon-Id: 랜덤 UUID(localStorage 저장) → rate limit 공정성(교실 공유 IP)
 *   - USE_MOCK=true 면 window.CubeNest._mockApi 로 폴백(개발/오프라인)
 *   - 429: Error(rate=true, retryAfter) 던짐 → run이 재시도 안내
 * 로드 순서: core → (개발 시 gen+mock) → api-client → viewer → run
 * ==========================================================================*/
(function () {
  var NS = window.CubeNest || (window.CubeNest = {});

  // ── 설정 ─────────────────────────────────────────────
  var BASE = "https://jtniutmexokswdpxkjof.supabase.co/functions/v1";
  var USE_MOCK = false;   // true면 mock으로 폴백(개발/오프라인). 배포=false.
  // ────────────────────────────────────────────────────

  function anonId() {
    try {
      var k = "cubenest_anon", id = localStorage.getItem(k);
      if (!id) {
        id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
           : "a-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(k, id);
      }
      return id;
    } catch (e) { return "anon-nostore"; }
  }

  async function call(path, body) {
    if (USE_MOCK && NS._mockApi && NS._mockApi[path]) return NS._mockApi[path](body);
    var res;
    try {
      res = await fetch(BASE + "/" + path, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Anon-Id": anonId() },
        body: JSON.stringify(body),
      });
    } catch (netErr) {
      // 네트워크 실패 → mock 있으면 폴백
      if (NS._mockApi && NS._mockApi[path]) return NS._mockApi[path](body);
      var e0 = new Error("network"); e0.network = true; throw e0;
    }
    if (res.status === 429) {
      var ra = parseInt(res.headers.get("Retry-After") || "60", 10);
      var e1 = new Error("rate"); e1.rate = true; e1.retryAfter = ra; throw e1;
    }
    if (!res.ok) {
      var detail = "";
      try { detail = (await res.json()).detail || ""; } catch (e) {}
      var e2 = new Error("server " + res.status + (detail ? " " + detail : "")); e2.status = res.status; throw e2;
    }
    return await res.json();
  }

  NS.api = {
    generate: function (req) { return call("generate", req); },
    grade: function (req) { return call("grade", req); },
    _base: BASE, _useMock: USE_MOCK,
  };
})();
