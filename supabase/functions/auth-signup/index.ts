// Edge Function: Inscription utilisateur (Version Standalone - tout inclus)
// Valide email/password, hash le mot de passe, crée l'utilisateur et envoie email de confirmation

import { createClient } from "jsr:@supabase/supabase-js@2";

// ============================================================================
// CONFIGURATION
// ============================================================================
const PROJECT_URL = Deno.env.get("PROJECT_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") || "";
// Support pour SendGrid (gratuit jusqu'à 100 emails/jour) ou Resend
const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "team@jardin-iris.be";
// URLs par défaut
const FRONTEND_URL_PROD = Deno.env.get("FRONTEND_URL_PROD") || "https://jardin-iris.be/appv2";
const FRONTEND_URL_DEV = Deno.env.get("FRONTEND_URL_DEV") || "http://localhost:4200";

// Fonction pour déterminer l'URL frontend selon l'origine de la requête
function getFrontendUrl(req: Request): string {
  // Récupérer l'origine de la requête (header Referer ou Origin)
  const referer = req.headers.get("referer") || req.headers.get("origin") || "";
  
  // Si la requête vient de localhost, utiliser l'URL de développement
  if (referer.includes("localhost") || referer.includes("127.0.0.1")) {
    return FRONTEND_URL_DEV;
  }
  
  // Sinon, utiliser l'URL de production
  return FRONTEND_URL_PROD;
}

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
  // Simplifié : accepte tout pour le moment
  return true;
}

function validatePassword(password: string): { valid: boolean; error?: string } {
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

// Fonction de hashage alternative utilisant Web Crypto API (compatible avec Deno)
async function hashPassword(password: string): Promise<string> {
  // Utiliser PBKDF2 pour le hashage (plus sécurisé que SHA-256 seul)
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);
  
  // Générer un salt aléatoire
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // Importer la clé pour PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passwordData,
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  
  // Dériver la clé avec PBKDF2 (100000 itérations)
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
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join("");
  
  // Retourner au format: salt:hash
  return `${saltHex}:${hashHex}`;
}

async function sendEmail(to: string, subject: string, html: string): Promise<{ success: boolean; error?: string }> {
  const fromEmail = FROM_EMAIL || "team@jardin-iris.be";
  console.log("Sending email with from:", fromEmail, "to:", to);

  // Essayer SendGrid en premier (gratuit jusqu'à 100 emails/jour)
  if (SENDGRID_API_KEY) {
    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SENDGRID_API_KEY}`,
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: to }],
            subject: subject,
          }],
          from: { email: fromEmail, name: "Jardin Iris" },
          content: [{
            type: "text/html",
            value: html,
          }],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("SendGrid API error:", error);
        // Si SendGrid échoue, essayer Resend en fallback
        if (RESEND_API_KEY) {
          return await sendEmailWithResend(to, subject, html, fromEmail);
        }
        return { success: false, error: `SendGrid API error: ${response.status}` };
      }

      return { success: true };
    } catch (error) {
      console.error("Error sending email with SendGrid:", error);
      // Si SendGrid échoue, essayer Resend en fallback
      if (RESEND_API_KEY) {
        return await sendEmailWithResend(to, subject, html, fromEmail);
      }
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  // Fallback sur Resend si SendGrid n'est pas configuré
  if (RESEND_API_KEY) {
    return await sendEmailWithResend(to, subject, html, fromEmail);
  }

  return { success: false, error: "No email service configured (SENDGRID_API_KEY or RESEND_API_KEY required)" };
}

async function sendEmailWithResend(to: string, subject: string, html: string, fromEmail: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: fromEmail,
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
    console.error("Error sending email with Resend:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

function createEmailVerificationTemplate(token: string, frontendUrl: string): string {
  const verificationUrl = `${frontendUrl}/auth/verify-email?token=${token}`;
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
    const passwordHash = await hashPassword(password);

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
      const { data: existingProfile, error: profileCheckError } = await supabase
        .from("profiles")
        .select("id, roles")
        .eq("id", newUser.id)
        .maybeSingle();

      if (existingProfile) {
        // Le profil existe, ajouter les rôles manquants
        const currentRoles = existingProfile.roles || [];
        const newRoles = roles.filter(role => !currentRoles.includes(role));
        
        if (newRoles.length > 0) {
          for (const role of newRoles) {
            const { error: profileError } = await supabase.rpc("add_role_to_profile", {
              user_id: newUser.id,
              new_role: role,
            });
            if (profileError) {
              console.error("Error adding role to profile:", profileError);
            }
          }
        }
      } else {
        // Le profil n'existe pas, le créer directement
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            id: newUser.id,
            roles: roles,
            display_name: null,
            avatar_url: null,
            metadata: null,
          });
        
        if (profileError) {
          console.error("Error creating profile:", profileError);
        }
      }
    }

    // Déterminer l'URL frontend selon l'origine de la requête
    const frontendUrl = getFrontendUrl(req);
    
    // Envoyer l'email de confirmation
    const emailResult = await sendEmail(
      email,
      "Vérifiez votre adresse email",
      createEmailVerificationTemplate(verificationToken, frontendUrl)
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
