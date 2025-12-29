// Edge Function: Inscription utilisateur (Version Standalone - tout inclus)
// Valide email/password, hash le mot de passe, crée l'utilisateur et envoie email de confirmation

import { createClient } from "jsr:@supabase/supabase-js@2";
import { hash } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

// ============================================================================
// CONFIGURATION
// ============================================================================
const PROJECT_URL = Deno.env.get("PROJECT_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FRONTEND_URL = Deno.env.get("FRONTEND_URL_LOCAL") || "http://localhost:4200";

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

function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sendEmail(to: string, subject: string, html: string): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "noreply@yourdomain.com", // TODO: Configurer votre domaine
        to: to,
        subject: subject,
        html: html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Resend API error:", error);
      return { success: false, error: `Resend API error: ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

function createEmailVerificationTemplate(token: string): string {
  const verificationUrl = `${FRONTEND_URL}/auth/verify-email?token=${token}`;
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Vérification de votre email</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #4CAF50;">Vérifiez votre adresse email</h1>
        <p>Merci de vous être inscrit ! Veuillez cliquer sur le lien ci-dessous pour vérifier votre adresse email :</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Vérifier mon email
          </a>
        </p>
        <p>Ou copiez ce lien dans votre navigateur :</p>
        <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          Ce lien expire dans 24 heures. Si vous n'avez pas créé de compte, ignorez cet email.
        </p>
      </div>
    </body>
    </html>
  `;
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
    const { email, password, roles } = await req.json();

    // Validation
    if (!email || !password) {
      return createErrorResponse("Email et mot de passe requis", 400, "MISSING_FIELDS");
    }

    if (!isValidEmail(email)) {
      return createErrorResponse("Format d'email invalide", 400, "INVALID_EMAIL");
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return createErrorResponse(passwordValidation.error || "Mot de passe invalide", 400, "INVALID_PASSWORD");
    }

    // Vérifier si l'email existe déjà
    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("id")
      .eq("email", email.toLowerCase())
      .single();

    if (existingUser) {
      return createErrorResponse("Cet email est déjà utilisé", 409, "EMAIL_EXISTS");
    }

    // Hash du mot de passe
    const passwordHash = await hash(password);

    // Créer l'utilisateur
    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        email_verified: false,
      })
      .select("id, email, created_at")
      .single();

    if (insertError || !newUser) {
      console.error("Error creating user:", insertError);
      return createErrorResponse("Erreur lors de la création du compte", 500, "CREATE_ERROR");
    }

    // Générer token de confirmation email
    const verificationToken = generateSecureToken();
    const tokenHash = await hashToken(verificationToken);

    // Calculer expiration (24 heures)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Stocker le token de vérification
    const { error: tokenError } = await supabase
      .from("email_verifications")
      .insert({
        user_id: newUser.id,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
      });

    if (tokenError) {
      console.error("Error creating verification token:", tokenError);
      // On continue quand même, l'utilisateur peut demander un nouveau token
    }

    // Créer le profil avec les rôles (si la table profiles existe)
    if (roles && Array.isArray(roles) && roles.length > 0) {
      // Vérifier si le profil existe déjà
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id, roles")
        .eq("id", newUser.id)
        .single();

      if (existingProfile) {
        // Ajouter les rôles au profil existant
        const { error: profileError } = await supabase.rpc("add_role_to_profile", {
          user_id: newUser.id,
          new_role: roles[0], // Pour l'instant, on prend le premier rôle
        });
        if (profileError) {
          console.error("Error adding role to profile:", profileError);
        }
      } else {
        // Créer le profil avec les rôles
        const { error: profileError } = await supabase.rpc("create_profile_after_signup", {
          user_id: newUser.id,
          roles_array: roles,
          metadata_json: null,
        });
        if (profileError) {
          console.error("Error creating profile:", profileError);
        }
      }
    }

    // Envoyer l'email de confirmation
    const emailResult = await sendEmail(
      email,
      "Vérifiez votre adresse email",
      createEmailVerificationTemplate(verificationToken)
    );

    if (!emailResult.success) {
      console.error("Error sending verification email:", emailResult.error);
      // On continue quand même, l'utilisateur peut demander un nouveau token
    }

    // Retourner succès (sans créer de session immédiate)
    return createSuccessResponse({
      success: true,
      userId: newUser.id,
      email: newUser.email,
      message: "Compte créé avec succès. Veuillez vérifier votre email.",
    });
  } catch (error) {
    console.error("Error in auth-signup:", error);
    return createErrorResponse(
      "Erreur lors de l'inscription",
      500,
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
});

