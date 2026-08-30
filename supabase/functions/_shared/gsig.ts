// CubeNest Edge Functions — gsig: HMAC-SHA256 서명 토큰(무상태 채점 위·변조 방지)
// 서명 대상 = id + "|" + paramsHash. 클라는 gsig를 그대로 되돌려주고, 서버가 재검증.
// 키: 환경변수 GSIG_SECRET (Edge Function secret). 절대 클라 미노출.

const enc = new TextEncoder();

async function key(): Promise<CryptoKey> {
  const secret = Deno.env.get("GSIG_SECRET");
  if (!secret) throw new Error("GSIG_SECRET 미설정");
  return await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"],
  );
}

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = ""; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// 결정적 params 지문(seed 재현에 필요한 필드만, 순서 고정)
//
//   ★ 불변식 — **지문은 buildProbs 의 모든 입력을 덮어야 한다.**
//     buildProbs({type, levels, seed, n, edu, sub, stage}) 중 seed 는 id("seed#i")에 들어 있고
//     그 id 가 서명 대상이므로, 나머지 여섯이 여기 있으면 재생성 결과가 서명에 묶인다.
//     ⚠ 앞으로 buildProbs 에 인자를 추가하면 **여기에도 반드시 함께 넣을 것.**
//       빠뜨리면 같은 gsig 로 다른 문제를 재생성시켜 채점할 수 있다(아래 sub 사례).
//
//   ⚠ 새 필드는 '있을 때만' 덧붙인다. 무조건 붙이면 필드가 하나 늘어 기존 gsig 가 전부 어긋나
//     배포 순간 진행 중이던 세션이 403 을 맞는다. 안 보내는 클라는 지문이 예전과 똑같다.
//
//   stage·sub 를 넣는 이유: 둘 다 재생성 모양을 바꾼다. 지문 밖에 두면 **조용히 오채점**되고,
//     안에 두면 403 으로 즉시 드러난다.
//     260831 에 sub 가 실제로 밖에 있었다 — 같은 id·gsig 로 sub 만 A-c→A-f 로 바꿔 보내면
//     서명이 통과하고 서버가 다른 문제(정답 8→2, 나무 8개→9개)로 채점했다(라이브에서 실측).
//     영향 유형은 서브가 있는 hidden·minmax·manip 셋이고, 나머지 6유형은 지문이 그대로다.
//
//   ⚠ sub 에는 "sub=" 마커를 붙인다. 없으면 stage 없이 sub 만 온 요청이 `…|A-c` 가 되어
//     **stage 를 붙인 지문과 구조가 같아진다**(지금 값끼리는 안 겹치지만 나중에 겹치면
//     서로 다른 문제가 같은 지문을 갖는다). 마커는 그 가능성을 없애면서
//     **stage 만 있는 기존 지문은 바이트 단위로 그대로** 둔다.
export function paramsHash(p: {
  type?: string; theme?: string; levels?: string[]; n?: number;
  edu?: string | null; stage?: string | null; sub?: string | null;
}): string {
  const norm = [
    p.theme ?? p.type ?? "",
    (p.levels ?? []).join(""),
    String(p.n ?? ""),
    p.edu ?? "",
  ].join("|");
  let out = norm;
  if (p.stage) out += "|" + p.stage;
  if (p.sub)   out += "|sub=" + String(p.sub);
  return out;
}

export async function sign(id: string, ph: string): Promise<string> {
  const mac = await crypto.subtle.sign("HMAC", await key(), enc.encode(id + "|" + ph));
  return "v1." + b64url(mac);
}

export async function verify(id: string, ph: string, gsig: string): Promise<boolean> {
  try {
    const expect = await sign(id, ph);
    // 상수시간 비교
    if (expect.length !== gsig.length) return false;
    let diff = 0; for (let i = 0; i < expect.length; i++) diff |= expect.charCodeAt(i) ^ gsig.charCodeAt(i);
    return diff === 0;
  } catch { return false; }
}
