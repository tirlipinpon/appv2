# Documentation pour LLMs - Application Éducative Angular

## 📋 Résumé synthétique

Application Angular monorepo avec deux applications distinctes :
- **Frontend** : Interface ludique pour enfants (jeux éducatifs, progression, badges, gamification)
- **Admin** : Interface de gestion pour parents, professeurs et administrateurs

**Stack** : Angular 20, NgRx Signals, Supabase (PostgreSQL + Auth), Material, Konva

**Architecture** : Pattern Smart Component avec séparation Application/Infrastructure, stores NgRx Signals par feature, lazy loading.

## 🎯 À utiliser pour...

### Debug et résolution de problèmes

1. **Comprendre l'architecture** :
   - Lire [docs/architecture.md](docs/architecture.md) pour la structure complète
   - Consulter les README locaux dans `core/`, `features/`, `shared/`
   - Vérifier [docs/database-schema.md](docs/database-schema.md) pour les relations de données

2. **Problèmes d'authentification** :
   - Frontend : [projects/frontend/src/app/core/auth/README.md](projects/frontend/src/app/core/auth/README.md)
   - Admin : [projects/admin/src/app/core/README.md](projects/admin/src/app/core/README.md)
   - Sécurité : [docs/security.md](docs/security.md)

3. **Erreurs API/Supabase** :
   - [docs/api.md](docs/api.md) pour les endpoints
   - [docs/database-schema.md](docs/database-schema.md) pour le schéma
   - Services dans `core/services/supabase/`

### Ajout de fonctionnalités

1. **Nouvelle feature frontend** :
   - Suivre le pattern dans [projects/frontend/src/app/features/README.md](projects/frontend/src/app/features/README.md)
   - Créer Smart Component + Application/Infrastructure
   - Ajouter store NgRx Signals dans `store/index.ts`
   - Route lazy-loaded dans `app.routes.ts`

2. **Nouveau type de jeu** :
   - [docs/game-types.md](docs/game-types.md) pour la structure
   - `projects/frontend/src/app/features/game/` pour l'implémentation
   - `GameEngineService` pour la logique de jeu

3. **Nouveau badge** :
   - [docs/badges-system.md](docs/badges-system.md) pour la logique
   - Migration SQL pour le trigger de déblocage
   - `projects/frontend/src/app/features/badges/` pour l'affichage

4. **Nouvelle table/entité** :
   - Créer migration dans `supabase/migrations/`
   - Documenter dans [docs/database-schema.md](docs/database-schema.md)
   - Ajouter RLS policies
   - Créer service dans `core/services/` ou `features/*/components/infrastructure/`

### Refactoring et amélioration

1. **Optimisation performance** :
   - [docs/performance.md](docs/performance.md) pour les stratégies
   - Vérifier les computed signals dans les stores
   - Optimiser les queries Supabase (indexes)

2. **Amélioration sécurité** :
   - [docs/security.md](docs/security.md) pour les bonnes pratiques
   - Vérifier les guards et RLS policies
   - Audit des permissions par rôle

3. **Refactoring de code** :
   - Respecter le pattern Application/Infrastructure
   - Maintenir la séparation core/features/shared
   - Utiliser les stores NgRx Signals pour l'état

## 📚 Pointeurs vers la documentation

### Documentation principale

- **Architecture** : [docs/architecture.md](docs/architecture.md)
- **Vocabulaire métier** : [docs/domain.md](docs/domain.md)
- **Base de données** : [docs/database-schema.md](docs/database-schema.md)
- **API** : [docs/api.md](docs/api.md)
- **Types de jeux** : [docs/game-types.md](docs/game-types.md)
- **Badges** : [docs/badges-system.md](docs/badges-system.md)
- **Progression** : [docs/progression.md](docs/progression.md)
- **Gamification** : [docs/gamification.md](docs/gamification.md)
- **Sécurité** : [docs/security.md](docs/security.md)
- **Performance** : [docs/performance.md](docs/performance.md)
- **Déploiement** : [docs/deployment.md](docs/deployment.md)

### Documentation locale par application

#### Frontend

- **Core** : [projects/frontend/src/app/core/README.md](projects/frontend/src/app/core/README.md)
- **Auth** : [projects/frontend/src/app/core/auth/README.md](projects/frontend/src/app/core/auth/README.md)
- **Services** : [projects/frontend/src/app/core/services/README.md](projects/frontend/src/app/core/services/README.md)
- **Features** : [projects/frontend/src/app/features/README.md](projects/frontend/src/app/features/README.md)
- **Game** : [projects/frontend/src/app/features/game/README.md](projects/frontend/src/app/features/game/README.md)
- **Badges** : [projects/frontend/src/app/features/badges/README.md](projects/frontend/src/app/features/badges/README.md)
- **Shared** : [projects/frontend/src/app/shared/README.md](projects/frontend/src/app/shared/README.md)

#### Admin

- **Core** : [projects/admin/src/app/core/README.md](projects/admin/src/app/core/README.md)
- **Features** : [projects/admin/src/app/features/README.md](projects/admin/src/app/features/README.md)
- **Shared** : [projects/admin/src/app/shared/README.md](projects/admin/src/app/shared/README.md)

## 🗣️ Vocabulaire métier clé

- **Enfant (Child)** : Utilisateur principal de l'application frontend, authentifié via prénom + PIN
- **Parent** : Utilisateur admin qui gère les profils enfants
- **Professeur (Teacher)** : Utilisateur admin qui crée des jeux et gère les matières
- **Matière (Subject)** : Domaine d'apprentissage (Mathématiques, Français, etc.)
- **Sous-catégorie (Subject Category)** : Subdivision d'une matière (ex: Addition, Soustraction)
- **Jeu (Game)** : Jeu éducatif lié à une matière ou sous-catégorie
- **Type de jeu (Game Type)** : Catégorie de jeu (QCM, Memory, Puzzle, Chronologie, etc.)
- **Tentative (Game Attempt)** : Essai d'un jeu par un enfant avec score et réponses
- **Progression (Progress)** : Suivi de la progression par sous-catégorie (étoiles, pourcentage)
- **Badge** : Récompense débloquée selon des conditions (première catégorie complétée, jeux parfaits, etc.)
- **Collectible** : Objet collectionnable débloqué en complétant des sous-catégories
- **Jeu bonus (Bonus Game)** : Mini-jeu récompense débloqué en complétant une matière entière
- **Mascotte** : Avatar qui évolue selon les performances (niveau, XP, stades d'évolution)
- **Affectation (Teacher Assignment)** : Lien professeur ↔ matière/classe/niveau scolaire
- **Inscription (Enrollment)** : Lien enfant ↔ matière/sous-catégorie (selected=true pour activation)

## 🏗️ Structure des deux applications

### Frontend (`projects/frontend/`)

**Port** : 54262

**Structure** :
```
src/app/
├── core/              # Services globaux, auth enfant, types
├── features/          # Dashboard, Subjects, Game, Collection, Settings, Bonus Games
└── shared/            # Composants réutilisables, animations, utilitaires
```

**Authentification** : `firstname` + `login_pin` (4 chiffres) via `ChildAuthService`

**Stores NgRx Signals** : Un par feature (DashboardStore, GameStore, SubjectsStore, etc.)

### Admin (`projects/admin/`)

**Port** : 4200

**Structure** :
```
src/app/
├── core/              # Services globaux, auth Supabase, version
├── features/          # Login, Dashboard, Parent, Teacher, Child
└── shared/            # Composants partagés, services, stores, interceptors
```

**Authentification** : Supabase Auth (email/password) avec gestion multi-rôles

**Stores NgRx Signals** : Stores partagés (enrollments, schools, subjects, subject-categories)

## 🔑 Concepts techniques importants

### Pattern Application/Infrastructure

Chaque feature utilise ce pattern :
- **Application** : Orchestration métier, logique applicative (Facade Pattern)
- **Infrastructure** : Wrapper API, appels Supabase (Adapter Pattern)
- **Smart Component** : Point d'entrée qui utilise Application

### NgRx Signals

- Stores réactifs avec `signalStore()`
- `withState()` : État initial
- `withComputed()` : Valeurs calculées
- `withMethods()` : Actions et méthodes
- `rxMethod()` : Intégration RxJS pour async

### Lazy Loading

Tous les composants sont chargés à la demande :
```typescript
loadComponent: () => import('./features/game/game.component').then(m => m.GameComponent)
```

### Guards

- `childAuthGuard` : Frontend (vérifie session enfant)
- `authGuard` : Admin (vérifie authentification Supabase)
- `childParentGuard` : Admin (vérifie que l'enfant appartient au parent)

## 📝 Notes importantes

- **Toujours lire la documentation locale** avant de modifier une feature
- **Respecter le pattern** Application/Infrastructure pour les nouvelles features
- **Vérifier les RLS policies** avant d'ajouter des queries Supabase
- **Utiliser les stores NgRx Signals** pour l'état partagé entre composants
- **Documenter les changements** dans les fichiers README correspondants
