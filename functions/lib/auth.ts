const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

interface Jwk extends JsonWebKey {
  kid: string;
}

let cachedKeys: { byKid: Map<string, CryptoKey>; expiresAt: number } | null = null;

function bytes(value: string): Uint8Array {
  const pad = "=".repeat((4 - (value.length % 4)) % 4);
  const b64 = (value + pad).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function jsonPart(part: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(bytes(part))) as Record<string, unknown>;
}

async function keyFor(kid: string): Promise<CryptoKey | null> {
  const now = Date.now();
  if (!cachedKeys || cachedKeys.expiresAt < now) {
    const response = await fetch(JWKS_URL);
    if (!response.ok) return null;
    const body = (await response.json()) as { keys?: Jwk[] };
    const byKid = new Map<string, CryptoKey>();
    for (const jwk of body.keys ?? []) {
      if (!jwk.kid) continue;
      const key = await crypto.subtle.importKey(
        "jwk",
        { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256" },
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"],
      );
      byKid.set(jwk.kid, key);
    }
    cachedKeys = { byKid, expiresAt: now + 60 * 60 * 1000 };
  }
  return cachedKeys.byKid.get(kid) ?? null;
}

export async function verifyFirebaseToken(token: string, projectId: string): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3 || !projectId) return false;
  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = jsonPart(parts[0]);
    payload = jsonPart(parts[1]);
  } catch {
    return false;
  }
  if (header.alg !== "RS256" || typeof header.kid !== "string") return false;
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId) return false;
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) return false;
  if (typeof payload.sub !== "string" || payload.sub.length === 0) return false;
  if (typeof payload.exp !== "number" || payload.exp <= now) return false;
  if (typeof payload.iat !== "number" || payload.iat > now + 60) return false;
  const key = await keyFor(header.kid);
  if (!key) return false;
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = bytes(parts[2]);
  return crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    signature as BufferSource,
    data as BufferSource,
  );
}
