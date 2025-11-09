# Guide d'implémentation - Tables et Processus de Login

Ce document décrit toutes les étapes pour mettre en place le système d'authentification avec Supabase et la gestion multi-rôles.

## 📋 Prérequis

- Node.js installé
- Compte Supabase (gratuit ou payant)
- Angular CLI installé globalement (`npm install -g @angular/cli`)

## 🚀 Installation

### 1. Configuration des variables d'environnement

Créez un fichier `.env` à la racine du projet avec vos identifiants Supabase :

```env
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_ANON_KEY=votre_cle_anon
```

**Note** : Pour Angular, vous devrez peut-être utiliser un fichier `environment.ts` directement ou configurer les variables d'environnement selon votre méthode de build.

### 2. Application de la migration SQL

1. Connectez-vous à votre projet Supabase
2. Allez dans l'éditeur SQL
3. Exécutez le contenu du fichier `supabase/migrations/001_initial_schema.sql`

Cette migration crée :
- La table `profiles` avec les colonnes nécessaires
- Les policies RLS (Row-Level Security)
- Le trigger pour création automatique de profil
- Les fonctions RPC : `create_profile_after_signup` et `add_role_to_profile`

### 3. Configuration des variables d'environnement dans Angular

Modifiez `src/environments/environment.ts` avec vos vraies valeurs :

```typescript
export const environment = {
  production: false,
  supabaseUrl: 'https://votre-projet.supabase.co',
  supabaseAnonKey: 'votre_cle_anon'
};
```

## 📁 Structure du projet

```
src/
├── app/
│   ├── components/
│   │   ├── login/              # Composant de connexion
│   │   ├── signup-landing/     # Page de choix parent/prof
│   │   ├── signup-parent/      # Inscription parent
│   │   ├── signup-prof/        # Inscription professeur
│   │   ├── role-selector/       # Sélecteur de rôle (si plusieurs rôles)
│   │   └── dashboard/          # Tableau de bord
│   ├── guards/
│   │   ├── auth-guard.ts       # Guard pour vérifier l'authentification
│   │   └── role-guard.ts       # Guard pour vérifier les rôles
│   ├── services/
│   │   ├── supabase.ts         # Service Supabase
│   │   └── auth.ts             # Service d'authentification
│   └── app.routes.ts           # Configuration des routes
├── environments/
│   ├── environment.ts          # Variables d'environnement dev
│   └── environment.prod.ts     # Variables d'environnement prod
└── supabase/
    └── migrations/
        └── 001_initial_schema.sql  # Migration SQL
```

## 🔐 Fonctionnalités implémentées

### Authentification

1. **Inscription séparée par rôle**
   - Route `/signup` : Page de choix entre parent et professeur
   - Route `/signup/parent` : Inscription pour les parents
   - Route `/signup/prof` : Inscription pour les professeurs

2. **Gestion de l'email existant**
   - Si un utilisateur essaie de s'inscrire avec un email déjà existant
   - Le système propose d'ajouter le nouveau rôle au profil existant
   - L'utilisateur est redirigé vers la page de connexion
   - Après connexion, le rôle est automatiquement ajouté

3. **Connexion**
   - Route `/login` : Page de connexion
   - Après connexion réussie :
     - Si un seul rôle → redirection automatique vers le dashboard
     - Si plusieurs rôles → affichage du sélecteur de rôle

4. **Sélection de rôle**
   - Route `/select-role` : Permet de choisir sous quelle identité agir
   - Accessible depuis le menu si plusieurs rôles disponibles

### Sécurité

- **Row-Level Security (RLS)** activée sur la table `profiles`
- Les utilisateurs ne peuvent voir/modifier que leur propre profil
- Les fonctions RPC sont sécurisées avec `SECURITY DEFINER`

### Routes protégées

- `/dashboard` : Nécessite une authentification (AuthGuard)
- `/select-role` : Nécessite une authentification (AuthGuard)
- Les routes avec rôles spécifiques peuvent utiliser `RoleGuard`

## 🧪 Test du système

### Scénario 1 : Inscription d'un nouveau parent

1. Aller sur `/signup`
2. Cliquer sur "Je suis parent"
3. Remplir le formulaire avec email et mot de passe
4. Cliquer sur "S'inscrire"
5. Vérifier l'email de confirmation
6. Se connecter avec les identifiants
7. Vérifier que le dashboard s'affiche avec le rôle "parent"

### Scénario 2 : Ajout d'un rôle à un compte existant

1. S'inscrire en tant que parent (scénario 1)
2. Se déconnecter
3. Aller sur `/signup/prof`
4. Essayer de s'inscrire avec le même email
5. Le système propose d'ajouter le rôle "prof"
6. Cliquer sur "Oui, ajouter le rôle"
7. Se connecter avec les identifiants
8. Le rôle "prof" est ajouté automatiquement
9. Le sélecteur de rôle s'affiche pour choisir entre "parent" et "prof"

### Scénario 3 : Connexion avec plusieurs rôles

1. Avoir un compte avec plusieurs rôles (parent + prof)
2. Se connecter sur `/login`
3. Le sélecteur de rôle s'affiche automatiquement
4. Choisir un rôle
5. Le dashboard s'affiche avec le rôle sélectionné

## 🔧 Fonctions RPC disponibles

### `create_profile_after_signup(user_id, roles_array, metadata_json)`

Crée ou met à jour un profil avec les rôles spécifiés.

**Paramètres :**
- `user_id` (UUID) : ID de l'utilisateur
- `roles_array` (TEXT[]) : Tableau de rôles ('parent', 'prof', 'admin')
- `metadata_json` (JSONB, optionnel) : Métadonnées supplémentaires

**Exemple d'utilisation :**
```typescript
await supabase.rpc('create_profile_after_signup', {
  user_id: 'uuid-de-l-utilisateur',
  roles_array: ['parent'],
  metadata_json: null
});
```

### `add_role_to_profile(user_id, new_role)`

Ajoute un rôle à un profil existant.

**Paramètres :**
- `user_id` (UUID) : ID de l'utilisateur
- `new_role` (TEXT) : Rôle à ajouter ('parent', 'prof', 'admin')

**Exemple d'utilisation :**
```typescript
await supabase.rpc('add_role_to_profile', {
  user_id: 'uuid-de-l-utilisateur',
  new_role: 'prof'
});
```

## 📝 Notes importantes

1. **Variables d'environnement** : Assurez-vous que les variables d'environnement sont correctement configurées avant de démarrer l'application.

2. **Migration SQL** : La migration doit être exécutée dans Supabase avant de pouvoir utiliser l'application.

3. **Confirmation d'email** : Par défaut, Supabase envoie un email de confirmation. Vous pouvez désactiver cette fonctionnalité dans les paramètres Supabase pour le développement.

4. **Rôles multiples** : Un utilisateur peut avoir plusieurs rôles. Le système gère automatiquement la sélection du rôle actif.

5. **Sécurité** : Les policies RLS garantissent que les utilisateurs ne peuvent accéder qu'à leur propre profil.

## 🐛 Dépannage

### L'application ne se connecte pas à Supabase

- Vérifiez que les variables d'environnement sont correctement définies
- Vérifiez que l'URL et la clé API sont correctes
- Vérifiez la console du navigateur pour les erreurs

### Erreur lors de l'inscription

- Vérifiez que la migration SQL a été exécutée
- Vérifiez que le trigger `on_auth_user_created` existe
- Vérifiez les logs Supabase pour plus de détails

### Le sélecteur de rôle ne s'affiche pas

- Vérifiez que l'utilisateur a bien plusieurs rôles dans la table `profiles`
- Vérifiez que le profil a été correctement chargé après la connexion

## 📚 Prochaines étapes

Une fois le système d'authentification en place, vous pouvez :

1. Créer les tables pour les enfants (`children`, `parents_children`)
2. Créer les tables pour les écoles et matières
3. Créer le système de questions
4. Implémenter les fonctionnalités spécifiques à chaque rôle

---

**Note** : Ce guide couvre uniquement la partie authentification et gestion des rôles. Les autres fonctionnalités (enfants, écoles, questions) seront implémentées dans les phases suivantes.

