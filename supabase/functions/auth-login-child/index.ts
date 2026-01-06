// Supabase Edge Function pour authentification enfant sécurisée
// Génère un JWT manuellement avec jose (sans créer de user fictif dans auth.users)
// Le PIN n'est jamais exposé en frontend, validation 100% backend

/// <reference path="./deno.d.ts" />

import { createClient } from "jsr:@supabase/supabase-js@2";
import * as jose from "npm:jose@5.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400", // 24 heures
  "Access-Control-Allow-Credentials": "true",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    });
  }

  try {
    // Vérifier que les variables d'environnement sont configurées
    // Utilisation du préfixe CHILD_AUTH_ pour éviter les conflits avec d'autres secrets
    const supabaseUrl = Deno.env.get("CHILD_AUTH_URL");
    const serviceRoleKey = Deno.env.get("CHILD_AUTH_SERVICE_ROLE_KEY");
    const jwtSecret = Deno.env.get("CHILD_AUTH_JWT_SECRET");

    if (!supabaseUrl || !serviceRoleKey || !jwtSecret) {
      console.error("Missing environment variables:", {
        hasUrl: !!supabaseUrl,
        hasServiceRole: !!serviceRoleKey,
        hasJwtSecret: !!jwtSecret,
      });
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    // Récupérer les credentials depuis le body
    const { firstname, pin } = await req.json();

    if (!firstname || !pin) {
      return new Response(
        JSON.stringify({ error: "firstname and pin are required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // 1️⃣ Valider le PIN avec SERVICE_ROLE_KEY (accès complet DB)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: child, error } = await supabaseAdmin
      .from("children")
      .select(
        "id, firstname, school_level, parent_id, school_id, avatar_url, avatar_seed, avatar_style"
      )
      .eq("firstname", firstname)
      .eq("login_pin", pin)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("Database error:", error);
      return new Response(
        JSON.stringify({ error: "Database error" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    if (!child) {
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    // 2️⃣ Générer JWT manuellement (sans créer d'user Supabase)
    const secret = new TextEncoder().encode(jwtSecret);

    const token = await new jose.SignJWT({
      sub: child.id, // ← ID du child (sera accessible via auth.uid())
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60, // 8h d'expiration
      aud: "authenticated",
      role: "authenticated",
    })
      .setProtectedHeader({ alg: "HS256" })
      .sign(secret);

    // 3️⃣ Retourner le JWT (PAS de refresh_token - 8h suffisant pour app enfant)
    return new Response(
      JSON.stringify({
        access_token: token,
        token_type: "Bearer",
        expires_in: 8 * 60 * 60, // 8 heures en secondes
        user: {
          id: child.id,
          firstname: child.firstname,
          school_level: child.school_level,
          parent_id: child.parent_id,
          school_id: child.school_id,
          avatar_url: child.avatar_url,
          avatar_seed: child.avatar_seed,
          avatar_style: child.avatar_style,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in auth-login-child:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
