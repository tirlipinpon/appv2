# Script de deploiement pour l'authentification personnalisee
# Deploie les Edge Functions et applique les migrations SQL

Write-Host "Deploiement de l'authentification personnalisee" -ForegroundColor Cyan
Write-Host ""

# Verifier si Supabase CLI est installe
$supabaseVersion = supabase --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR: Supabase CLI n'est pas installe. Installez-le avec: npm install -g supabase" -ForegroundColor Red
    exit 1
}

Write-Host "OK: Supabase CLI trouve" -ForegroundColor Green
Write-Host ""

# Verifier si le projet est lie
Write-Host "Verification de la configuration du projet..." -ForegroundColor Yellow
$status = supabase status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ATTENTION: Le projet n'est pas lie. Vous devez d'abord lier votre projet Supabase." -ForegroundColor Yellow
    Write-Host "   Executez: supabase link --project-ref YOUR_PROJECT_REF" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Ou appliquez les migrations manuellement via le dashboard Supabase:" -ForegroundColor Yellow
    Write-Host "   1. Allez dans Supabase Dashboard > SQL Editor" -ForegroundColor Yellow
    Write-Host "   2. Executez: supabase/migrations/004_custom_auth_schema.sql" -ForegroundColor Yellow
    Write-Host "   3. Executez: supabase/migrations/005_update_rls_policies_for_custom_auth.sql" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "OK: Projet Supabase lie" -ForegroundColor Green
Write-Host ""

# Appliquer les migrations SQL
Write-Host "Application des migrations SQL..." -ForegroundColor Yellow
Write-Host ""

Write-Host "  -> Migration 004: Schema d'authentification personnalisee" -ForegroundColor Cyan
supabase db push
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR: Probleme lors de l'application des migrations" -ForegroundColor Red
    Write-Host "Vous pouvez appliquer les migrations manuellement via le dashboard Supabase" -ForegroundColor Yellow
    exit 1
}

Write-Host "OK: Migrations SQL appliquees avec succes" -ForegroundColor Green
Write-Host ""

# Deployer les Edge Functions
Write-Host "Deploiement des Edge Functions..." -ForegroundColor Yellow
Write-Host ""

$functions = @(
    "auth-signup",
    "auth-login",
    "auth-reset-request",
    "auth-reset-confirm",
    "auth-verify-email",
    "auth-validate",
    "auth-migrate-user",
    "auth-get-profile"
)

foreach ($func in $functions) {
    Write-Host "  -> Deploiement de $func..." -ForegroundColor Cyan
    supabase functions deploy $func
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERREUR: Probleme lors du deploiement de $func" -ForegroundColor Red
        exit 1
    }
    Write-Host "    OK: $func deploye" -ForegroundColor Green
}

Write-Host ""
Write-Host "OK: Toutes les Edge Functions ont ete deployees avec succes" -ForegroundColor Green
Write-Host ""

# Rappel des variables d'environnement necessaires
Write-Host "N'oubliez pas de configurer les variables d'environnement suivantes dans Supabase:" -ForegroundColor Yellow
Write-Host "   - JWT_SECRET (generer avec: openssl rand -hex 32)" -ForegroundColor White
Write-Host "   - RESEND_API_KEY" -ForegroundColor White
Write-Host "   - SUPABASE_SERVICE_ROLE_KEY" -ForegroundColor White
Write-Host "   - FRONTEND_URL" -ForegroundColor White
Write-Host ""
Write-Host "   Allez dans: Supabase Dashboard > Settings > Edge Functions > Secrets" -ForegroundColor Yellow
Write-Host ""

Write-Host "Deploiement termine avec succes!" -ForegroundColor Green
