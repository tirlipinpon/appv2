// Utilitaires JWT pour les Edge Functions
import { create, verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const JWT_SECRET = Deno.env.get("JWT_SECRET") || "";
const JWT_ALG = "HS256";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET must be set");
}

export interface JWTPayload {
  userId: string;
  email: string;
  roles?: string[];
  jti: string; // JWT ID pour invalidation
  iat: number;
  exp: number;
}

export interface JWTResult {
  token: string;
  jti: string;
}

export async function createJWT(
  userId: string,
  email: string,
  roles: string[] = [],
  expiresInHours = 24
): Promise<JWTResult> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + expiresInHours * 60 * 60;
  const jti = crypto.randomUUID();

  const payload: JWTPayload = {
    userId,
    email,
    roles,
    jti,
    iat: now,
    exp,
  };

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const token = await create({ alg: JWT_ALG, typ: "JWT" }, payload, key);
  return { token, jti };
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const payload = await verify(token, key);
    return payload as JWTPayload;
  } catch (error) {
    console.error("JWT verification error:", error);
    return null;
  }
}

