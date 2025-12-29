// Edge Function: Récupérer le profil utilisateur
// Utilise le service role key pour contourner RLS

import { createClient } from "jsr:@supabase/supabase-js@2";
import { verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

// ============================================================================
// CONFIGURATION
// ============================================================================
const PROJECT_URL = Deno.env.get("PROJECT_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") || "";
const JWT_SECRET = Deno.env.get("JWT_SECRET") || "";
const JWT_ALG = "HS256";

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

// ============================================================================
// HANDLER
// ============================================================================
Deno.serve(async (req: Request) => {
  // Gérer les requêtes OPTIONS (CORS preflight)
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    // Vérifier la méthode
    if (req.method !== "GET" && req.method !== "POST") {
      return createErrorResponse("Method not allowed", 405);
    }

    // Récupérer le token depuis les headers
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return createErrorResponse("Token manquant", 401, "MISSING_TOKEN");
    }

    const token = authHeader.substring(7);

    // Vérifier et décoder le token JWT
    let payload: any;
    try {
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(JWT_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );
      payload = await verify(token, key);
    } catch (error) {
      console.error("Token verification error:", error);
      return createErrorResponse("Token invalide", 401, "INVALID_TOKEN");
    }

    const userId = payload.userId || payload.sub as string;
    if (!userId) {
      return createErrorResponse("Token invalide : userId manquant", 401, "INVALID_TOKEN");
    }

    // Récupérer le profil en utilisant le service role key (contourne RLS)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      return createErrorResponse("Erreur lors de la récupération du profil", 500, "PROFILE_FETCH_ERROR", profileError);
    }

    if (!profile) {
      return createErrorResponse("Profil non trouvé", 404, "PROFILE_NOT_FOUND");
    }

    // S'assurer que roles est un tableau
    if (profile.roles && !Array.isArray(profile.roles)) {
      profile.roles = [profile.roles];
    }

    return createSuccessResponse({ profile });
  } catch (error) {
    console.error("Error in auth-get-profile:", error);
    return createErrorResponse(
      "Erreur interne du serveur",
      500,
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
});

