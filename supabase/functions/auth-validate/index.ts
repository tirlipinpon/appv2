// Edge Function: Validation JWT (Version Standalone)
// Vérifie la validité du JWT et de la session

import { createClient } from "jsr:@supabase/supabase-js@2";
import { verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

// ============================================================================
// CONFIGURATION
// ============================================================================
const PROJECT_URL = Deno.env.get("PROJECT_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") || "";
const JWT_SECRET = Deno.env.get("JWT_SECRET") || "";

if (!PROJECT_URL || !SERVICE_ROLE_KEY || !JWT_SECRET) {
  throw new Error("PROJECT_URL, SERVICE_ROLE_KEY and JWT_SECRET must be set");
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ============================================================================
// UTILITAIRES
// ============================================================================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Allow-Credentials": "true",
};

function createErrorResponse(error: string, status: number, code?: string, details?: unknown): Response {
  const response: { error: string; code?: string; details?: unknown } = { error };
  if (code) response.code = code;
  if (details) response.details = details;

  return new Response(JSON.stringify(response), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

function createSuccessResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

interface JWTPayload {
  userId: string;
  email: string;
  roles?: string[];
  jti: string;
  iat: number;
  exp: number;
}

async function verifyJWT(token: string): Promise<JWTPayload | null> {
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

// ============================================================================
// FONCTION PRINCIPALE
// ============================================================================
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (req.method !== "POST") {
    return createErrorResponse("Method not allowed", 405);
  }

  try {
    const { token } = await req.json();

    // Validation
    if (!token) {
      return createSuccessResponse({ valid: false, error: "Token manquant" });
    }

    // Vérifier le JWT
    const payload = await verifyJWT(token);
    if (!payload) {
      return createSuccessResponse({ valid: false, error: "Token invalide" });
    }

    // Vérifier que la session existe en base et n'est pas expirée
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, user_id, expires_at")
      .eq("user_id", payload.userId)
      .eq("token_jti", payload.jti)
      .single();

    if (sessionError || !session) {
      return createSuccessResponse({ valid: false, error: "Session introuvable" });
    }

    // Vérifier expiration
    if (new Date(session.expires_at) < new Date()) {
      return createSuccessResponse({ valid: false, error: "Session expirée" });
    }

    // Récupérer les infos utilisateur
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email, email_verified")
      .eq("id", payload.userId)
      .single();

    if (userError || !user) {
      return createSuccessResponse({ valid: false, error: "Utilisateur introuvable" });
    }

    // Récupérer les rôles depuis le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("roles")
      .eq("id", user.id)
      .single();

    return createSuccessResponse({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        email_verified: user.email_verified,
        roles: profile?.roles || [],
      },
    });
  } catch (error) {
    console.error("Error in auth-validate:", error);
    return createSuccessResponse({
      valid: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
