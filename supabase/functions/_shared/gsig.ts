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
export function paramsHash(p: {
  type?: string; theme?: string; levels?: string[]; n?: number; edu?: string | null;
}): string {
  const norm = [
    p.theme ?? p.type ?? "",
    (p.levels ?? []).join(""),
    String(p.n ?? ""),
    p.edu ?? "",
  ].join("|");
  return norm;
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
