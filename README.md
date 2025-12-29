# Application Éducative - Parent/Enfant/Prof/Admin

Application Angular avec authentification personnalisée sécurisée et gestion multi-rôles.

## 🔐 Authentification

L'application utilise une **authentification personnalisée sécurisée** implémentée via Supabase Edge Functions, remplaçant l'authentification Supabase standard. Cette solution offre :

- ✅ Contrôle total sur la logique d'authentification
- ✅ JWT long (24h) pour les sessions
- ✅ Hash bcrypt pour les mots de passe
- ✅ Envoi d'emails via Resend
- ✅ Rate limiting pour la sécurité
- ✅ Migration graduelle des utilisateurs existants

## 🚀 Démarrage rapide

### Prérequis

- Node.js (v18 ou supérieur)
- npm ou yarn
- Compte Supabase

### Installation

1. Cloner le repository :
```bash
git clone https://github.com/tirlipinpon/appv2.git
cd appv2
```

2. Installer les dépendances :
```bash
npm install
```

3. Configurer les variables d'environnement :
   - Copier `src/environments/environment.example.ts` vers `src/environments/environment.ts`
   - Remplir avec vos identifiants Supabase

4. Appliquer la migration SQL :
   - Se connecter à votre projet Supabase
   - Aller dans l'éditeur SQL
   - Exécuter le contenu du fichier `supabase/migrations/001_initial_schema.sql`

5. Démarrer l'application :
```bash
npm start
```

L'application sera accessible sur `http://localhost:4200`

## 📋 Fonctionnalités

- ✅ Authentification personnalisée sécurisée (Edge Functions + JWT)
- ✅ Inscription séparée pour parents et professeurs
- ✅ Gestion multi-rôles (parent, prof, admin)
- ✅ Ajout de rôle à un compte existant
- ✅ Sélecteur de rôle pour utilisateurs multi-rôles
- ✅ Protection des routes avec guards
- ✅ Row-Level Security (RLS) sur la base de données
- ✅ Réinitialisation de mot de passe sécurisée
- ✅ Vérification d'email

## 📁 Structure du projet

```
src/
├── app/
│   ├── components/        # Composants Angular
│   ├── guards/           # Guards de protection des routes
│   ├── services/         # Services (Auth, Supabase)
│   └── app.routes.ts     # Configuration des routes
├── environments/         # Variables d'environnement
└── supabase/
    └── migrations/       # Migrations SQL
```

## 🔐 Configuration

### Variables d'environnement

Créez `src/environments/environment.ts` avec :

```typescript
export const environment = {
  production: false,
  supabaseUrl: 'VOTRE_URL_SUPABASE',
  supabaseAnonKey: 'VOTRE_CLE_ANON',
  customAuthEnabled: false // Mettre à true pour activer l'authentification personnalisée
};
```

### Configuration Supabase Edge Functions

Les Edge Functions d'authentification nécessitent les variables d'environnement suivantes (à configurer dans Supabase Dashboard > Settings > Edge Functions):

- `JWT_SECRET` : Clé secrète pour signer les JWT (générer avec `openssl rand -hex 32`)
- `RESEND_API_KEY` : Clé API Resend pour l'envoi d'emails
- `SUPABASE_SERVICE_ROLE_KEY` : Clé service role pour accès direct à la DB
- `FRONTEND_URL` : URL de l'application Angular (pour les liens email)

### Migrations SQL

Exécutez les migrations dans l'ordre suivant :

1. `supabase/migrations/001_initial_schema.sql` (si pas déjà fait)
   - Crée la table `profiles`
   - Les policies RLS initiales
   - Les triggers pour création automatique de profil
   - Les fonctions RPC : `create_profile_after_signup` et `add_role_to_profile`

2. `supabase/migrations/004_custom_auth_schema.sql` (nouveau)
   - Crée les tables `users`, `sessions`, `password_resets`, `email_verifications`
   - Crée la fonction `get_current_user_id()` pour RLS
   - Crée les fonctions de nettoyage et rate limiting

3. `supabase/migrations/005_update_rls_policies_for_custom_auth.sql` (nouveau)
   - Met à jour les policies RLS pour utiliser `get_current_user_id()` au lieu de `auth.uid()`

### Déploiement des Edge Functions

Déployez les Edge Functions suivantes dans Supabase :

```bash
supabase functions deploy auth-signup
supabase functions deploy auth-login
supabase functions deploy auth-reset-request
supabase functions deploy auth-reset-confirm
supabase functions deploy auth-verify-email
supabase functions deploy auth-validate
supabase functions deploy auth-migrate-user
```

Ou utilisez le dashboard Supabase pour déployer chaque fonction depuis le dossier `supabase/functions/`.

## 🧪 Tests

Pour tester l'application :

1. **Inscription d'un nouveau parent** :
   - Aller sur `/signup`
   - Cliquer sur "Je suis parent"
   - Remplir le formulaire
   - Vérifier l'email de confirmation
   - Se connecter

2. **Ajout d'un rôle à un compte existant** :
   - S'inscrire en tant que parent
   - Se déconnecter
   - Essayer de s'inscrire en tant que prof avec le même email
   - Le système propose d'ajouter le rôle
   - Se connecter et le rôle est ajouté automatiquement

## 📚 Documentation

Voir `GUIDE_IMPLEMENTATION.md` pour la documentation complète.

## 🔒 Sécurité

- Les fichiers `environment.ts` et `environment.prod.ts` sont exclus du repository Git
- Utilisez les fichiers `.example.ts` comme modèles
- Ne commitez jamais vos clés API Supabase
- **JWT_SECRET** : Stockez de manière sécurisée, jamais en code
- **Rate limiting** : Implémenté pour éviter les attaques brute force
- **Politique de mot de passe stricte** : Minimum 8 caractères avec majuscule, minuscule, chiffre et caractère spécial
- **Hash bcrypt** : Mots de passe hashés avec bcrypt
- **Tokens sécurisés** : Tokens de reset et vérification hashés avant stockage

## 🔄 Migration depuis Supabase Auth

Pour migrer les utilisateurs existants depuis Supabase Auth vers l'authentification personnalisée :

1. Activer le feature flag `customAuthEnabled: true` dans `environment.ts`
2. Migrer les utilisateurs via l'Edge Function `auth-migrate-user`
3. Les nouveaux utilisateurs utiliseront automatiquement le nouveau système
4. Les anciens utilisateurs devront réinitialiser leur mot de passe lors de la première connexion

**Note** : La migration est graduelle - vous pouvez garder les deux systèmes en parallèle pendant la transition.

## 📝 License

Ce projet est privé.
