// Edge Function: Demande de réinitialisation de mot de passe (Version Standalone)
// Génère un token sécurisé et envoie un email via Resend

import { createClient } from "jsr:@supabase/supabase-js@2";

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

function createPasswordResetTemplate(token: string): string {
  const resetUrl = `${FRONTEND_URL}/auth/reset-password?token=${token}`;
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Réinitialisation de votre mot de passe</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2196F3;">Réinitialisation de mot de passe</h1>
        <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le lien ci-dessous :</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Réinitialiser mon mot de passe
          </a>
        </p>
        <p>Ou copiez ce lien dans votre navigateur :</p>
        <p style="word-break: break-all; color: #666;">${resetUrl}</p>
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          Ce lien expire dans 1 heure. Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
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
    const { email } = await req.json();

    // Validation
    if (!email) {
      return createErrorResponse("Email requis", 400, "MISSING_EMAIL");
    }

    if (!isValidEmail(email)) {
      return createErrorResponse("Format d'email invalide", 400, "INVALID_EMAIL");
    }

    // Vérifier le rate limiting
    const { data: rateLimitCheck } = await supabase.rpc("check_reset_rate_limit", {
      user_email: email.toLowerCase(),
    });

    if (rateLimitCheck === false) {
      // Ne pas révéler si l'email existe ou non (sécurité)
      return createSuccessResponse({
        success: true,
        message: "Si cet email existe, un lien de réinitialisation a été envoyé.",
      });
    }

    // Récupérer l'utilisateur
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email")
      .eq("email", email.toLowerCase())
      .single();

    // Ne pas révéler si l'email existe ou non (sécurité)
    // Toujours retourner succès même si l'email n'existe pas
    if (userError || !user) {
      return createSuccessResponse({
        success: true,
        message: "Si cet email existe, un lien de réinitialisation a été envoyé.",
      });
    }

    // Générer token sécurisé
    const resetToken = generateSecureToken();
    const tokenHash = await hashToken(resetToken);

    // Calculer expiration (1 heure)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Invalider les anciens tokens de reset pour cet utilisateur
    await supabase
      .from("password_resets")
      .update({ used_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("used_at", null);

    // Stocker le token de reset
    const { error: tokenError } = await supabase
      .from("password_resets")
      .insert({
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
      });

    if (tokenError) {
      console.error("Error creating reset token:", tokenError);
      // Retourner succès quand même pour ne pas révéler l'existence de l'email
      return createSuccessResponse({
        success: true,
        message: "Si cet email existe, un lien de réinitialisation a été envoyé.",
      });
    }

    // Envoyer l'email de réinitialisation
    const emailResult = await sendEmail(
      email,
      "Réinitialisation de votre mot de passe",
      createPasswordResetTemplate(resetToken)
    );

    if (!emailResult.success) {
      console.error("Error sending reset email:", emailResult.error);
      // Retourner succès quand même pour ne pas révéler l'existence de l'email
    }

    // Toujours retourner succès (même si l'email n'existe pas)
    return createSuccessResponse({
      success: true,
      message: "Si cet email existe, un lien de réinitialisation a été envoyé.",
    });
  } catch (error) {
    console.error("Error in auth-reset-request:", error);
    // Retourner succès même en cas d'erreur pour ne pas révéler l'existence de l'email
    return createSuccessResponse({
      success: true,
      message: "Si cet email existe, un lien de réinitialisation a été envoyé.",
    });
  }
});
