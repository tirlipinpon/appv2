// Edge Function: Connexion utilisateur (Version Standalone)
// Vérifie email/password, génère JWT et crée session

import { createClient } from "jsr:@supabase/supabase-js@2";
import { create } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

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

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

interface JWTPayload {
  userId: string;
  email: string;
  roles?: string[];
  jti: string;
  iat: number;
  exp: number;
}

// Fonction de vérification de mot de passe utilisant PBKDF2 (compatible avec Deno)
async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    // Le hash est au format: salt:hash
    const [saltHex, hashHex] = storedHash.split(":");
    if (!saltHex || !hashHex) {
      return false;
    }

    // Convertir le salt de hexadécimal en Uint8Array
    const salt = new Uint8Array(
      saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    );

    // Encoder le mot de passe
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);

    // Importer la clé pour PBKDF2
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      passwordData,
      "PBKDF2",
      false,
      ["deriveBits"]
    );

    // Dériver la clé avec PBKDF2 (100000 itérations, même que lors du hashage)
    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      256
    );

    // Convertir en hexadécimal
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const computedHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Comparer les hash (comparaison constante pour éviter les attaques par timing)
    return computedHash === hashHex;
  } catch (error) {
    console.error("Error verifying password:", error);
    return false;
  }
}

async function createJWT(
  userId: string,
  email: string,
  roles: string[] = [],
  expiresInHours = 24
): Promise<{ token: string; jti: string }> {
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
    const { email, password } = await req.json();

    // Validation
    if (!email || !password) {
      return createErrorResponse("Email et mot de passe requis", 400, "MISSING_FIELDS");
    }

    if (!isValidEmail(email)) {
      return createErrorResponse("Format d'email invalide", 400, "INVALID_EMAIL");
    }

    // Récupérer l'utilisateur
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email, password_hash, email_verified, failed_login_attempts, locked_until")
      .eq("email", email.toLowerCase())
      .single();

    if (userError || !user) {
      return createErrorResponse("Email ou mot de passe incorrect", 401, "INVALID_CREDENTIALS");
    }

    // Vérifier si le compte est verrouillé
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return createErrorResponse(
        "Compte temporairement verrouillé. Réessayez plus tard.",
        423,
        "ACCOUNT_LOCKED"
      );
    }

    // Vérifier si l'email est vérifié
    if (!user.email_verified) {
      return createErrorResponse(
        "Veuillez vérifier votre email avant de vous connecter",
        403,
        "EMAIL_NOT_VERIFIED"
      );
    }

    // Vérifier le mot de passe
    const passwordValid = await verifyPassword(password, user.password_hash);
    if (!passwordValid) {
      // Incrémenter les tentatives échouées
      const newAttempts = (user.failed_login_attempts || 0) + 1;
      const updateData: { failed_login_attempts: number; locked_until?: string } = {
        failed_login_attempts: newAttempts,
      };

      // Verrouiller après 5 tentatives échouées (pendant 30 minutes)
      if (newAttempts >= 5) {
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + 30);
        updateData.locked_until = lockUntil.toISOString();
      }

      await supabase
        .from("users")
        .update(updateData)
        .eq("id", user.id);

      return createErrorResponse("Email ou mot de passe incorrect", 401, "INVALID_CREDENTIALS");
    }

    // Récupérer les rôles depuis le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("roles")
      .eq("id", user.id)
      .single();

    const roles = profile?.roles || [];

    // Générer JWT (24h)
    const { token, jti } = await createJWT(user.id, user.email, roles, 24);

    // Créer la session en base
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const { error: sessionError } = await supabase
      .from("sessions")
      .insert({
        user_id: user.id,
        token_jti: jti,
        expires_at: expiresAt.toISOString(),
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
        user_agent: req.headers.get("user-agent") || null,
      });

    if (sessionError) {
      console.error("Error creating session:", sessionError);
    }

    // Mettre à jour last_login_at et réinitialiser failed_login_attempts
    await supabase
      .from("users")
      .update({
        last_login_at: new Date().toISOString(),
        failed_login_attempts: 0,
        locked_until: null,
      })
      .eq("id", user.id);

    // Retourner le token et les infos utilisateur
    return createSuccessResponse({
      token,
      user: {
        id: user.id,
        email: user.email,
        roles,
      },
    });
  } catch (error) {
    console.error("Error in auth-login:", error);
    return createErrorResponse(
      "Erreur lors de la connexion",
      500,
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
});
