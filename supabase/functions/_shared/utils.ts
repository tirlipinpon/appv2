// Utilitaires partagés pour les Edge Functions d'authentification

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Allow-Credentials": "true",
};

export interface ErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
}

export function createErrorResponse(
  error: string,
  status: number,
  code?: string,
  details?: unknown
): Response {
  const response: ErrorResponse = { error };
  if (code) response.code = code;
  if (details) response.details = details;

  return new Response(JSON.stringify(response), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

export function createSuccessResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

// Validation email
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Politique de mot de passe stricte
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: "Le mot de passe doit contenir au moins 8 caractères" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Le mot de passe doit contenir au moins une majuscule" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Le mot de passe doit contenir au moins une minuscule" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Le mot de passe doit contenir au moins un chiffre" };
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { valid: false, error: "Le mot de passe doit contenir au moins un caractère spécial" };
  }
  return { valid: true };
}

// Génération de token sécurisé
export function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Hash d'un token (pour stockage sécurisé)
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Vérification d'un token hashé
export async function verifyTokenHash(token: string, hash: string): Promise<boolean> {
  const tokenHash = await hashToken(token);
  return tokenHash === hash;
}

