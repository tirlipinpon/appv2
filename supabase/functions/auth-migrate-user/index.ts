// Edge Function: Migration d'utilisateur depuis Supabase Auth (Version Standalone)
// Migre un utilisateur depuis auth.users vers la nouvelle table users

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

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
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
    const { userId, email } = await req.json();

    // Validation
    if (!userId && !email) {
      return createErrorResponse("userId ou email requis", 400, "MISSING_IDENTIFIER");
    }

    // Récupérer l'utilisateur depuis auth.users (via service role)
    let supabaseUser;
    if (userId) {
      const { data, error } = await supabase.auth.admin.getUserById(userId);
      if (error || !data.user) {
        return createErrorResponse("Utilisateur non trouvé dans auth.users", 404, "USER_NOT_FOUND");
      }
      supabaseUser = data.user;
    } else if (email) {
      if (!isValidEmail(email)) {
        return createErrorResponse("Format d'email invalide", 400, "INVALID_EMAIL");
      }
      const { data, error } = await supabase.auth.admin.listUsers();
      if (error) {
        return createErrorResponse("Erreur lors de la récupération des utilisateurs", 500, "FETCH_ERROR");
      }
      supabaseUser = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (!supabaseUser) {
        return createErrorResponse("Utilisateur non trouvé dans auth.users", 404, "USER_NOT_FOUND");
      }
    }

    if (!supabaseUser || !supabaseUser.email) {
      return createErrorResponse("Utilisateur invalide", 400, "INVALID_USER");
    }

    // Vérifier si l'utilisateur existe déjà dans la nouvelle table
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", supabaseUser.email.toLowerCase())
      .single();

    if (existingUser) {
      return createErrorResponse("Utilisateur déjà migré", 409, "ALREADY_MIGRATED");
    }

    // Note: On ne peut pas récupérer le mot de passe hashé depuis Supabase Auth
    // Il faut soit:
    // 1. Demander à l'utilisateur de réinitialiser son mot de passe
    // 2. Utiliser un hash temporaire et forcer la réinitialisation
    // Pour cette migration, on va créer l'utilisateur avec un hash temporaire
    // et marquer qu'il doit réinitialiser son mot de passe

    // Générer un hash temporaire (l'utilisateur devra réinitialiser)
    const tempPassword = crypto.randomUUID();
    const tempPasswordHash = await hash(tempPassword);

    // Créer l'utilisateur dans la nouvelle table
    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert({
        id: supabaseUser.id, // Utiliser le même ID pour la compatibilité
        email: supabaseUser.email.toLowerCase(),
        password_hash: tempPasswordHash,
        email_verified: supabaseUser.email_confirmed_at ? true : false,
        created_at: supabaseUser.created_at,
      })
      .select("id, email, email_verified, created_at")
      .single();

    if (insertError || !newUser) {
      console.error("Error creating user:", insertError);
      return createErrorResponse("Erreur lors de la création de l'utilisateur", 500, "CREATE_ERROR");
    }

    // Récupérer le profil existant (si existe)
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("roles, display_name, avatar_url, metadata")
      .eq("id", supabaseUser.id)
      .single();

    // Le profil devrait déjà exister, on ne fait que vérifier
    // Si le profil n'existe pas, il sera créé lors de la prochaine connexion

    return createSuccessResponse({
      success: true,
      userId: newUser.id,
      email: newUser.email,
      email_verified: newUser.email_verified,
      message: "Utilisateur migré avec succès. L'utilisateur devra réinitialiser son mot de passe.",
      requiresPasswordReset: true,
      profileExists: !!existingProfile,
    });
  } catch (error) {
    console.error("Error in auth-migrate-user:", error);
    return createErrorResponse(
      "Erreur lors de la migration",
      500,
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
});
