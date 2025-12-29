// Edge Function: Confirmation de réinitialisation de mot de passe (Version Standalone)
// Valide le token, met à jour le mot de passe et invalide les sessions

import { createClient } from "jsr:@supabase/supabase-js@2";
import { hash } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

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

function validatePassword(password: string): { valid: boolean; error?: string } {
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
    const { token, newPassword } = await req.json();

    // Validation
    if (!token || !newPassword) {
      return createErrorResponse("Token et nouveau mot de passe requis", 400, "MISSING_FIELDS");
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return createErrorResponse(passwordValidation.error || "Mot de passe invalide", 400, "INVALID_PASSWORD");
    }

    // Hash du token pour recherche
    const tokenHashStr = await hashToken(token);

    // Récupérer le token de reset
    const { data: resetToken, error: tokenError } = await supabase
      .from("password_resets")
      .select("id, user_id, expires_at, used_at")
      .eq("token_hash", tokenHashStr)
      .single();

    if (tokenError || !resetToken) {
      return createErrorResponse("Token invalide ou expiré", 400, "INVALID_TOKEN");
    }

    // Vérifier expiration
    if (new Date(resetToken.expires_at) < new Date()) {
      return createErrorResponse("Token expiré", 400, "TOKEN_EXPIRED");
    }

    // Vérifier si déjà utilisé
    if (resetToken.used_at) {
      return createErrorResponse("Token déjà utilisé", 400, "TOKEN_USED");
    }

    // Hash du nouveau mot de passe
    const passwordHash = await hash(newPassword);

    // Mettre à jour le mot de passe
    const { error: updateError } = await supabase
      .from("users")
      .update({ password_hash: passwordHash })
      .eq("id", resetToken.user_id);

    if (updateError) {
      console.error("Error updating password:", updateError);
      return createErrorResponse("Erreur lors de la mise à jour du mot de passe", 500, "UPDATE_ERROR");
    }

    // Marquer le token comme utilisé
    await supabase
      .from("password_resets")
      .update({ used_at: new Date().toISOString() })
      .eq("id", resetToken.id);

    // Invalider toutes les sessions existantes de l'utilisateur
    await supabase
      .from("sessions")
      .delete()
      .eq("user_id", resetToken.user_id);

    // Réinitialiser les tentatives de connexion échouées
    await supabase
      .from("users")
      .update({
        failed_login_attempts: 0,
        locked_until: null,
      })
      .eq("id", resetToken.user_id);

    return createSuccessResponse({
      success: true,
      message: "Mot de passe réinitialisé avec succès",
    });
  } catch (error) {
    console.error("Error in auth-reset-confirm:", error);
    return createErrorResponse(
      "Erreur lors de la réinitialisation",
      500,
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
});
