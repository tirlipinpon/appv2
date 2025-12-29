// Edge Function: Vérification d'email (Version Standalone)
// Valide le token de confirmation et marque l'email comme vérifié

import { createClient } from "jsr:@supabase/supabase-js@2";

// ============================================================================
// CONFIGURATION
// ============================================================================
const PROJECT_URL = Deno.env.get("PROJECT_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") || "";

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  throw new Error("PROJECT_URL and SERVICE_ROLE_KEY must be set");
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

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
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
      return createErrorResponse("Token requis", 400, "MISSING_TOKEN");
    }

    // Hash du token pour recherche
    const tokenHashStr = await hashToken(token);

    // Récupérer le token de vérification
    const { data: verificationToken, error: tokenError } = await supabase
      .from("email_verifications")
      .select("id, user_id, expires_at, used_at")
      .eq("token_hash", tokenHashStr)
      .single();

    if (tokenError || !verificationToken) {
      return createErrorResponse("Token invalide ou expiré", 400, "INVALID_TOKEN");
    }

    // Vérifier expiration
    if (new Date(verificationToken.expires_at) < new Date()) {
      return createErrorResponse("Token expiré", 400, "TOKEN_EXPIRED");
    }

    // Vérifier si déjà utilisé
    if (verificationToken.used_at) {
      return createErrorResponse("Token déjà utilisé", 400, "TOKEN_USED");
    }

    // Marquer l'email comme vérifié
    const { error: updateError } = await supabase
      .from("users")
      .update({ email_verified: true })
      .eq("id", verificationToken.user_id);

    if (updateError) {
      console.error("Error updating email verification:", updateError);
      return createErrorResponse("Erreur lors de la vérification", 500, "UPDATE_ERROR");
    }

    // Marquer le token comme utilisé
    await supabase
      .from("email_verifications")
      .update({ used_at: new Date().toISOString() })
      .eq("id", verificationToken.id);

    return createSuccessResponse({
      success: true,
      message: "Email vérifié avec succès",
    });
  } catch (error) {
    console.error("Error in auth-verify-email:", error);
    return createErrorResponse(
      "Erreur lors de la vérification",
      500,
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
});
