# Application Éducative - Parent/Enfant/Prof/Admin

Application Angular avec authentification Supabase et gestion multi-rôles.

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

- ✅ Authentification avec Supabase
- ✅ Inscription séparée pour parents et professeurs
- ✅ Gestion multi-rôles (parent, prof, admin)
- ✅ Ajout de rôle à un compte existant
- ✅ Sélecteur de rôle pour utilisateurs multi-rôles
- ✅ Protection des routes avec guards
- ✅ Row-Level Security (RLS) sur la base de données

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

## 🔐 Configuration Supabase

### Variables d'environnement

Créez `src/environments/environment.ts` avec :

```typescript
export const environment = {
  production: false,
  supabaseUrl: 'VOTRE_URL_SUPABASE',
  supabaseAnonKey: 'VOTRE_CLE_ANON'
};
```

### Migration SQL

Exécutez la migration `supabase/migrations/001_initial_schema.sql` dans l'éditeur SQL de Supabase.

Cette migration crée :
- La table `profiles`
- Les policies RLS
- Les triggers pour création automatique de profil
- Les fonctions RPC : `create_profile_after_signup` et `add_role_to_profile`

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

## 📝 License

Ce projet est privé.
