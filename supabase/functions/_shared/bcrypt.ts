// Wrapper pour bcrypt dans Deno
// Note: Deno n'a pas de module bcrypt natif, on utilisera une bibliothèque externe
// ou on peut utiliser Web Crypto API avec PBKDF2 comme alternative

import { hash, verify } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

export async function hashPassword(password: string): Promise<string> {
  return await hash(password);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await verify(password, hash);
}

