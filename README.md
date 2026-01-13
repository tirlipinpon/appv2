# Application Éducative - Parent/Enfant/Prof/Admin

Application Angular complète pour la gestion éducative avec deux interfaces distinctes : une application **frontend** pour les enfants et une application **admin** pour les parents, professeurs et administrateurs.

## 📖 Description fonctionnelle

### Pour qui ?

- **Enfants** : Interface ludique et colorée pour jouer à des jeux éducatifs, suivre leur progression, collectionner des badges et personnaliser leur expérience
- **Parents** : Gestion des profils enfants, suivi de la progression, sélection des matières et sous-catégories
- **Professeurs** : Création et gestion de jeux éducatifs, matières, sous-catégories, affectations aux classes
- **Administrateurs** : Gestion complète de la plateforme

### Principaux écrans

#### Application Frontend (Enfants)
- **Login** : Connexion simplifiée via prénom + PIN à 4 chiffres
- **Dashboard** : Vue d'ensemble avec statistiques, récents collectibles, mascotte
- **Subjects** : Liste des matières et sous-catégories avec progression (étoiles, pourcentage)
- **Game** : Interface de jeu interactive avec différents types (QCM, Memory, Puzzle, Chronologie, etc.)
- **Collection** : Badges débloqués, collectibles, thèmes personnalisables
- **Settings** : Paramètres de l'enfant, sélection de thème, tutoriel
- **Bonus Games** : Jeux bonus débloqués en complétant des matières

#### Application Admin (Parents/Profs/Admins)
- **Login/Signup** : Authentification Supabase avec gestion multi-rôles
- **Dashboard** : Vue d'ensemble selon le rôle
- **Parent Profile** : Gestion du profil parent et des enfants
- **Child Profile** : Gestion détaillée d'un enfant (matières, progression, statistiques)
- **Teacher Profile** : Gestion du profil professeur et affectations
- **Teacher Subjects** : Création et gestion des matières, sous-catégories, jeux
- **Teacher Assignments** : Gestion des affectations (matière, classe, niveau scolaire)

## 🛠️ Stack technique

### Framework et outils principaux

- **Angular** : v20.1.0 (standalone components, signals)
- **TypeScript** : v5.8.2
- **NgRx Signals** : v20.1.0 (gestion d'état réactive)
- **Supabase** : v2.80.0 (backend, authentification, base de données PostgreSQL)
- **Angular Material** : v20.2.13 (composants UI)
- **Konva** : v10.0.12 (graphiques 2D pour les jeux)
- **RxJS** : v7.8.0 (programmation réactive)

### Architecture

- **Monorepo Angular** : Deux applications dans `projects/`
  - `frontend/` : Application enfants (port 54262)
  - `admin/` : Application parents/profs/admins (port 4200)
- **Pattern Smart Component** : Composants intelligents avec séparation Application/Infrastructure
- **NgRx Signals Stores** : Gestion d'état réactive par feature
- **Lazy Loading** : Chargement à la demande des composants et routes
- **Standalone Components** : Architecture moderne sans modules

### Bibliothèques principales

- `@angular-architects/ngrx-toolkit` : Outils NgRx avec DevTools
- `@dicebear/collection` : Génération d'avatars pour les enfants
- `@supabase/supabase-js` : Client Supabase
- `openai` : Intégration IA (via proxy Supabase)

## 🚀 Démarrage rapide

### Prérequis

- **Node.js** : v18 ou supérieur
- **npm** : v9 ou supérieur
- **Compte Supabase** : Projet configuré avec base de données

### Installation

1. **Cloner le repository** :
```bash
git clone https://github.com/tirlipinpon/appv2.git
cd appv2
```

2. **Installer les dépendances** :
```bash
npm install
```

3. **Configurer les variables d'environnement** :

   Pour **frontend** :
   - Copier `projects/frontend/src/environments/environment.example.ts` vers `projects/frontend/src/environments/environment.ts`
   - Remplir avec vos identifiants Supabase

   Pour **admin** :
   - Copier `projects/admin/src/environments/environment.example.ts` vers `projects/admin/src/environments/environment.ts`
   - Remplir avec vos identifiants Supabase

4. **Appliquer les migrations SQL** :
   - Se connecter à votre projet Supabase
   - Aller dans l'éditeur SQL
   - Exécuter les migrations dans l'ordre depuis `supabase/migrations/`

5. **Démarrer les applications** :

   **Application Admin** (port 4200) :
   ```bash
   npm run start:admin
   ```
   Accessible sur `http://localhost:4200`

   **Application Frontend** (port 54262) :
   ```bash
   npm run start:frontend
   ```
   Accessible sur `http://localhost:54262`

## 📁 Structure du projet

```
appv2/
├── projects/
│   ├── frontend/              # Application enfants
│   │   └── src/app/
│   │       ├── core/          # Services globaux, auth, types
│   │       ├── features/      # Features (dashboard, subjects, game, etc.)
│   │       └── shared/         # Composants réutilisables
│   └── admin/                  # Application parents/profs/admins
│       └── src/app/
│           ├── core/          # Services globaux, auth
│           ├── features/     # Features (parent, teacher, child, etc.)
│           └── shared/        # Composants partagés
├── supabase/
│   ├── migrations/            # Migrations SQL
│   └── functions/             # Edge Functions (auth-login-child, deepseek-proxy)
├── docs/                      # Documentation détaillée
│   ├── architecture.md        # Architecture de l'application
│   ├── domain.md              # Vocabulaire métier
│   ├── database-schema.md     # Schéma complet de la base de données
│   └── ...
└── README.md                   # Ce fichier
```

## 🏗️ Architecture globale

### Structure des applications

Les deux applications suivent la même architecture :

- **`core/`** : Services globaux, authentification, types partagés, tokens d'injection
- **`features/`** : Features autonomes avec pattern Smart Component
  - Chaque feature contient :
    - Composant Smart principal
    - `components/application/` : Orchestration métier (Facade Pattern)
    - `components/infrastructure/` : Wrapper API (Adapter Pattern)
    - `store/` : Store NgRx Signals
    - `types/` : Types TypeScript spécifiques
    - `services/` : Services métier de la feature
- **`shared/`** : Composants, directives, pipes, utilitaires réutilisables

### Gestion d'état

- **NgRx Signals** : Stores réactifs par feature
- **Computed Signals** : Valeurs calculées optimisées
- **RxMethod** : Intégration RxJS pour les appels asynchrones
- **DevTools** : Support Redux DevTools via `@angular-architects/ngrx-toolkit`

### Routing

- **Lazy Loading** : Tous les composants sont chargés à la demande
- **Guards** : Protection des routes selon les rôles
  - `childAuthGuard` : Frontend (authentification enfant)
  - `authGuard` : Admin (authentification Supabase)
  - `childParentGuard` : Admin (vérification parent/enfant)

### Authentification

- **Frontend** : Authentification simplifiée via `firstname` + `login_pin` (4 chiffres)
- **Admin** : Authentification Supabase complète (email/password) avec gestion multi-rôles

## 📋 Scripts npm disponibles

### Développement

- `npm run start:admin` : Démarrer l'application admin (port 4200)
- `npm run start:frontend` : Démarrer l'application frontend (port 54262)

### Build

- `npm run build:admin` : Build production admin
- `npm run build:frontend` : Build production frontend
- `npm run build` : Build admin (par défaut)

### Watch

- `npm run watch:admin` : Build watch admin
- `npm run watch:frontend` : Build watch frontend

### Déploiement

- `npm run deploy:admin` : Build + déploiement FTP admin
- `npm run deploy:frontend` : Build + déploiement FTP frontend

### Tests

- `npm run test:admin` : Tests unitaires admin
- `npm run test:frontend` : Tests unitaires frontend
- `npm run test` : Tests globaux

### Linting

- `npm run lint:admin` : Lint admin
- `npm run lint:frontend` : Lint frontend
- `npm run lint` : Lint global

### E2E

- `npm run cypress:open` : Ouvrir Cypress
- `npm run cypress:run` : Exécuter les tests Cypress

## 🔐 Configuration Supabase

### Variables d'environnement

#### Frontend (`projects/frontend/src/environments/environment.ts`)

```typescript
export const environment = {
  production: false,
  supabaseUrl: 'VOTRE_URL_SUPABASE',
  supabaseAnonKey: 'VOTRE_CLE_ANON',
};
```

#### Admin (`projects/admin/src/environments/environment.ts`)

```typescript
export const environment = {
  production: false,
  supabaseUrl: 'VOTRE_URL_SUPABASE',
  supabaseAnonKey: 'VOTRE_CLE_ANON',
  customAuthEnabled: true, // Feature flag pour auth personnalisée
  deepseek: {
    model: 'deepseek-chat',
  },
  deepseekProxy: {
    url: 'VOTRE_URL_SUPABASE/functions/v1/deepseek-proxy'
  }
};
```

### Migrations SQL

Les migrations se trouvent dans `supabase/migrations/` et doivent être exécutées dans l'ordre :

1. Schéma initial (tables, relations, contraintes)
2. Catégories de matières
3. Storage buckets (game-images, puzzle-images, aides-images)
4. RLS (Row-Level Security) pour enfants
5. RLS pour tables frontend
6. Système de badges
7. Etc.

Voir [docs/database-schema.md](docs/database-schema.md) pour le schéma complet.

## 📚 Documentation

### Documentation principale

- **[docs/architecture.md](docs/architecture.md)** : Architecture détaillée des applications
- **[docs/domain.md](docs/domain.md)** : Vocabulaire métier et entités
- **[docs/database-schema.md](docs/database-schema.md)** : Schéma complet de la base de données
- **[docs/api.md](docs/api.md)** : Endpoints Supabase et services API
- **[docs/game-types.md](docs/game-types.md)** : Types de jeux et structures de données
- **[docs/badges-system.md](docs/badges-system.md)** : Système de badges et progression
- **[docs/progression.md](docs/progression.md)** : Calcul de progression et complétion
- **[docs/gamification.md](docs/gamification.md)** : Gamification (streaks, XP, mascotte)
- **[docs/security.md](docs/security.md)** : Sécurité, RLS, guards, RGPD
- **[docs/performance.md](docs/performance.md)** : Optimisations et stratégies de cache
- **[docs/deployment.md](docs/deployment.md)** : Déploiement et configuration production

### Documentation locale

Chaque dossier important contient un `README.md` avec :
- Rôle du dossier
- Composants/services principaux
- Interactions et flux

Voir les README dans :
- `projects/frontend/src/app/core/README.md`
- `projects/frontend/src/app/features/README.md`
- `projects/admin/src/app/core/README.md`
- Etc.

## 🧪 Tests

### Tests unitaires

```bash
npm run test:admin      # Tests admin
npm run test:frontend  # Tests frontend
```

### Tests E2E (Cypress)

```bash
npm run cypress:open   # Interface Cypress
npm run cypress:run    # Exécution en ligne de commande
```

Les tests E2E se trouvent dans `cypress/e2e/`.

## 🔒 Sécurité

- **Row-Level Security (RLS)** : Politiques de sécurité au niveau base de données
- **Guards Angular** : Protection des routes côté client
- **Authentification** : Supabase Auth pour admin, PIN pour enfants
- **Variables d'environnement** : Fichiers `environment.ts` exclus du Git
- **Secrets** : Clés API stockées comme secrets Supabase (Edge Functions)

⚠️ **Important** : Ne commitez jamais vos clés API Supabase. Utilisez les fichiers `.example.ts` comme modèles.

## 📝 License

Ce projet est privé.
