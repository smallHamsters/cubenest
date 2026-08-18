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
//   ⚠ stage 는 '있을 때만' 덧붙인다. 무조건 붙이면 필드가 하나 늘어 기존 gsig 가 전부 어긋나
//     배포 순간 진행 중이던 세션이 403 을 맞는다. 안 보내는 클라는 지문이 예전과 똑같다.
//   stage 를 지문에 넣는 이유: 스테이지가 다르면 재생성 모양이 달라 정답이 어긋난다.
//     sub 처럼 지문 밖에 두면 조용히 오채점되지만, 안에 두면 403 으로 즉시 드러난다.
export function paramsHash(p: {
  type?: string; theme?: string; levels?: string[]; n?: number; edu?: string | null; stage?: string | null;
}): string {
  const norm = [
    p.theme ?? p.type ?? "",
    (p.levels ?? []).join(""),
    String(p.n ?? ""),
    p.edu ?? "",
  ].join("|");
  return p.stage ? norm + "|" + p.stage : norm;
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
