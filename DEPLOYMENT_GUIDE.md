# Guide de déploiement - Authentification personnalisée

Ce guide vous explique comment déployer les Edge Functions et appliquer les migrations SQL pour l'authentification personnalisée.

## Prérequis

1. **Supabase CLI installé** :

   ```bash
   npm install -g supabase
   ```

2. **Projet Supabase créé** sur [supabase.com](https://supabase.com)

## Étape 1 : Lier le projet Supabase

Si vous n'avez pas encore lié votre projet :

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Pour trouver votre `PROJECT_REF` :

- Allez dans votre projet Supabase Dashboard
- Settings > General
- Le Project Reference se trouve dans les détails du projet

## Étape 2 : Appliquer les migrations SQL

### Option A : Via Supabase CLI (recommandé)

```bash
# Appliquer toutes les migrations en attente
supabase db push
```

### Option B : Via le Dashboard Supabase (manuel)

1. Allez dans **Supabase Dashboard > SQL Editor**
2. Exécutez les migrations dans l'ordre :

**Migration 004** :

- Ouvrez `supabase/migrations/004_custom_auth_schema.sql`
- Copiez tout le contenu
- Collez dans l'éditeur SQL
- Cliquez sur "Run"

**Migration 005** :

- Ouvrez `supabase/migrations/005_update_rls_policies_for_custom_auth.sql`
- Copiez tout le contenu
- Collez dans l'éditeur SQL
- Cliquez sur "Run"

## Étape 3 : Configurer les variables d'environnement

Avant de déployer les Edge Functions, configurez les secrets nécessaires :

1. Allez dans **Supabase Dashboard > Settings > Edge Functions > Secrets**
2. Ajoutez les variables suivantes :

| Variable                    | Description                     | Comment l'obtenir                                          |
| --------------------------- | ------------------------------- | ---------------------------------------------------------- |
| `JWT_SECRET`                | Clé secrète pour signer les JWT | Générer avec : `openssl rand -hex 32`                      |
| `RESEND_API_KEY`            | Clé API Resend                  | Créer un compte sur [resend.com](https://resend.com)       |
| `SERVICE_ROLE_KEY`          | Clé service role                | Dashboard > Settings > API > service_role key              |
| `FRONTEND_URL_LOCAL`        | URL de l'application            | Ex: `http://localhost:4200` ou `https://votre-domaine.com` |
| `PROJECT_URL`               | URL de votre projet Supabase    | Dashboard > Settings > API > Project URL                   |

## Étape 4 : Déployer les Edge Functions

### Option A : Via Supabase CLI (recommandé)

```bash
# Déployer toutes les fonctions une par une
supabase functions deploy auth-signup
supabase functions deploy auth-login
supabase functions deploy auth-reset-request
supabase functions deploy auth-reset-confirm
supabase functions deploy auth-verify-email
supabase functions deploy auth-validate
supabase functions deploy auth-migrate-user
```

### Option B : Via le script PowerShell

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-custom-auth.ps1
```

### Option C : Via le Dashboard Supabase (manuel - RECOMMANDÉ)

**IMPORTANT** : Toutes les Edge Functions sont maintenant en version **standalone** (tout le code est inclus dans chaque fichier). Vous pouvez les déployer directement via le Dashboard sans avoir besoin des fichiers `_shared/`.

1. Allez dans **Supabase Dashboard > Edge Functions**
2. Pour chaque fonction (dans l'ordre) :
   - Cliquez sur **"Create a new function"** ou sélectionnez la fonction existante
   - Nommez-la exactement comme indiqué (ex: `auth-signup`)
   - **Copiez TOUT le contenu** du fichier `supabase/functions/[nom-fonction]/index.ts`
   - **Collez dans l'éditeur** du Dashboard
   - Cliquez sur **"Deploy"** ou **"Save"**

**Ordre de déploiement recommandé** :
1. `auth-signup`
2. `auth-login`
3. `auth-reset-request`
4. `auth-reset-confirm`
5. `auth-verify-email`
6. `auth-validate`
7. `auth-migrate-user`

## Étape 5 : Vérifier le déploiement

1. **Vérifier les migrations** :

   - Dashboard > Database > Migrations
   - Vous devriez voir `004_custom_auth_schema` et `005_update_rls_policies_for_custom_auth`

2. **Vérifier les Edge Functions** :

   - Dashboard > Edge Functions
   - Vous devriez voir les 7 fonctions déployées

3. **Tester une fonction** :
   ```bash
   curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/auth-validate \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"token":"test"}'
   ```

## Dépannage

### Erreur : "Cannot find project ref"

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

### Erreur : "Migration failed"

- Vérifiez que les migrations précédentes ont été appliquées
- Vérifiez les logs dans le Dashboard > Database > Migrations

### Erreur : "Function deployment failed"

- Vérifiez que tous les secrets sont configurés
- Vérifiez les logs dans le Dashboard > Edge Functions > Logs

### Les fonctions ne trouvent pas les modules partagés

- **Note** : Toutes les fonctions sont maintenant standalone. Si vous voyez cette erreur, assurez-vous d'utiliser la version standalone du fichier `index.ts` (pas les versions avec imports depuis `_shared/`)

## Prochaines étapes

Une fois le déploiement terminé :

1. **Activer le feature flag** dans `src/environments/environment.ts` :

   ```typescript
   customAuthEnabled: true;
   ```

2. **Tester l'inscription** :

   - Créer un nouveau compte
   - Vérifier l'email de confirmation
   - Se connecter

3. **Migrer les utilisateurs existants** (si nécessaire) :
   - Utiliser l'Edge Function `auth-migrate-user`
   - Ou migrer en batch via SQL

## Support

Pour plus d'aide, consultez :

- [Documentation Supabase CLI](https://supabase.com/docs/reference/cli)
- [Documentation Edge Functions](https://supabase.com/docs/guides/functions)
