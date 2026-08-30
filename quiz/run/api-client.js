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

  /* 응답이 오지도 않고 끊기지도 않는 상태(모바일 전환·프록시 지연)를 끊어 준다.
     타임아웃이 없으면 호출부의 실패 처리가 아무리 좋아도 화면이 몇 분간 매달린다.
     ⚠ abort 는 **network 로 정규화**한다 — 새 플래그를 만들면 run.js·quiz/index.html 의
       기존 3분기가 전부 "그 외"로 떨어져 안내가 나빠진다. */
  var TIMEOUT_MS = { generate: 20000, grade: 12000 };

  async function call(path, body, extraHeaders) {
    if (USE_MOCK && NS._mockApi && NS._mockApi[path]) return NS._mockApi[path](body);
    var res;
    var headers = { "Content-Type": "application/json", "X-Anon-Id": anonId() };
    if (extraHeaders) for (var h in extraHeaders) headers[h] = extraHeaders[h];
    var ac = (typeof AbortController === "function") ? new AbortController() : null;
    var t = ac ? setTimeout(function () { ac.abort(); }, TIMEOUT_MS[path] || 20000) : null;
    try {
      res = await fetch(BASE + "/" + path, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(body),
        signal: ac ? ac.signal : undefined,
      });
    } catch (netErr) {
      // 네트워크 실패 → mock 있으면 폴백
      if (NS._mockApi && NS._mockApi[path]) return NS._mockApi[path](body);
      var e0 = new Error("network"); e0.network = true;
      e0.timeout = !!(netErr && netErr.name === "AbortError");   // 진단용(화면 분기는 안 함)
      throw e0;
    } finally {
      if (t) clearTimeout(t);
    }
    if (res.status === 429) {
      var ra = parseInt(res.headers.get("Retry-After") || "60", 10);
      var e1 = new Error("rate"); e1.rate = true; e1.retryAfter = ra; throw e1;
    }
    if (!res.ok) {
      // 서버가 주는 error·detail 을 둘 다 실어 보낸다. detail 만 보면 400 의 사유(error)가 사라져
      // 클라에서 "알 수 없는 오류"로만 보인다(실제로 mix 도입 때 진단이 늦어졌다).
      var info = {};
      try { info = await res.json(); } catch (e) {}
      var msg = [info.error, info.detail].filter(Boolean).join(" — ");
      var e2 = new Error("server " + res.status + (msg ? " " + msg : ""));
      e2.status = res.status; e2.serverError = info.error || null; e2.detail = info.detail || null;
      throw e2;
    }
    return await res.json();
  }

  NS.api = {
    generate: function (req) { return call("generate", req); },
    grade: function (req) { return call("grade", req); },
    // UI 메타데이터(스테이지·유형·지원 등급). 랜딩이 levels 를 하드코딩하지 않도록 서버가 준다.
    //   실패해도 화면이 죽지 않게 호출부가 폴백을 갖는다 — 이건 문제 생성이 아니라 표시용이다.
    config: async function () {
      try {
        var res = await fetch(BASE + "/config", { method: "GET", headers: { "X-Anon-Id": anonId() } });
        if (!res.ok) return null;
        return await res.json();
      } catch (e) { return null; }
    },
    // 문제지: 정답까지 오는 경로라 로그인 필수 — Supabase 게이트웨이가 JWT 를 검증한다.
    // 액세스 토큰은 CubeNest.auth 가 단일 진실(§6.2). 없으면 서버가 401 을 준다.
    worksheet: async function (req) {
      var tok = null;
      try { tok = NS.auth && NS.auth.getAccessToken ? await NS.auth.getAccessToken() : null; } catch (e) {}
      return call("worksheet", req, tok ? { Authorization: "Bearer " + tok } : null);
    },
    _base: BASE, _useMock: USE_MOCK,
  };
})();
