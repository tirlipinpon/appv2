# Features Admin - Liste et Guards

## Vue d'ensemble

Le dossier `features/` contient toutes les features autonomes de l'application admin. Chaque feature peut suivre le pattern Smart Component (comme frontend) ou une structure plus simple selon les besoins.

## Liste des features

### Login

**Localisation** : `features/login/`

**Rôle** : Authentification Supabase et gestion des comptes.

**Composants** :
- `LoginComponent` : Connexion principale
- `AuthConfirmComponent` : Confirmation d'email
- `PasswordResetComponent` : Réinitialisation de mot de passe
- `SignupLandingComponent` : Page d'atterrissage inscription
- `SignupRoleComponent` : Inscription par rôle (parent/prof)
- `RoleSelectorComponent` : Sélecteur de rôle pour utilisateurs multi-rôles

**Services** :
- `EmailConfirmationService` : Gestion de la confirmation d'email
- `PasswordService` : Gestion des mots de passe

**Guards** :
- `authGuard` : Vérifie l'authentification Supabase
- `roleGuard` : Vérifie les rôles spécifiques

**Routes** :
- `/login` : Connexion
- `/auth/confirm` : Confirmation d'email
- `/auth/reset` : Réinitialisation de mot de passe
- `/signup` : Page d'atterrissage
- `/signup/parent` : Inscription parent
- `/signup/prof` : Inscription professeur
- `/select-role` : Sélecteur de rôle (protégé par `authGuard`)

### Dashboard

**Localisation** : `features/dashboard/`

**Rôle** : Tableau de bord selon le rôle (parent, prof, admin).

**Fonctionnalités** :
- Vue d'ensemble selon le rôle
- Statistiques rapides
- Accès rapide aux fonctionnalités principales

**Route** : `/dashboard` (protégé par `authGuard`)

### Parent

**Localisation** : `features/parent/`

**Rôle** : Gestion du profil parent et des enfants.

**Structure** :
- `parent.component.ts` : Smart Component
- `components/application/` : Orchestration métier
- `components/infrastructure/` : Wrapper API
- `repositories/` : Repository pattern
- `services/` : Services métier
- `store/` : Store NgRx Signals

**Fonctionnalités** :
- Affichage et modification du profil parent
- Liste des enfants
- Gestion des enfants (création, modification, activation/désactivation)

**Route** : `/parent-profile` (protégé par `authGuard`)

### Child

**Localisation** : `features/child/`

**Rôle** : Gestion détaillée d'un enfant.

**Structure** :
- `child.component.ts` : Smart Component
- `components/application/` : Orchestration métier
- `components/infrastructure/` : Wrapper API
- `components/subjects/` : Gestion des matières de l'enfant
- `components/avatar-pin-generator/` : Générateur d'avatar et PIN
- `repositories/` : Repository pattern
- `services/` : Services métier (child, child-copy, child-form, school, subject)
- `store/` : Store NgRx Signals
- `guards/` : Guards spécifiques
- `types/` : Types TypeScript

**Fonctionnalités** :
- Affichage et modification du profil enfant
- Gestion des matières et sous-catégories activées
- Statistiques de progression
- Génération d'avatar et PIN
- Gestion de l'école et du niveau scolaire

**Routes** :
- `/child-profile` : Profil enfant (protégé par `authGuard`)
- `/child-profile/:id` : Profil enfant spécifique (protégé par `authGuard` + `childParentGuard`)
- `/child-subjects/:childId` : Matières de l'enfant (protégé par `authGuard` + `childParentGuard`)

**Guards** :
- `childParentGuard` : Vérifie que l'enfant appartient au parent connecté

### Teacher

**Localisation** : `features/teacher/`

**Rôle** : Gestion du profil professeur et création de contenu pédagogique.

**Structure** :
- `teacher.component.ts` : Smart Component
- `components/assignments/` : Gestion des affectations
- `components/subjects/` : Gestion des matières
- `components/games/` : Création et gestion de jeux
- `services/` : Services métier (game-creation, etc.)

**Fonctionnalités** :
- Affichage et modification du profil professeur
- Gestion des affectations (matière, classe, niveau)
- Création et gestion de matières
- Création et gestion de sous-catégories
- Création et gestion de jeux éducatifs
- Statistiques des classes

**Routes** :
- `/teacher-profile` : Profil professeur (protégé par `authGuard`)
- `/teacher-assignments` : Affectations (protégé par `authGuard`)
- `/teacher-subjects` : Matières (protégé par `authGuard`)
- `/teacher-subjects/:id` : Détail d'une matière (protégé par `authGuard`)
- `/teacher-subjects/:id/games` : Jeux d'une matière (protégé par `authGuard`)

## Guards

### authGuard

**Localisation** : `features/login/guards/auth.guard.ts`

**Rôle** : Vérifie l'authentification Supabase.

**Logique** :
1. Vérifie la session Supabase via `AuthCoreService`
2. Redirige vers `/login` si non authentifié
3. Autorise l'accès si authentifié

**Utilisation** :
```typescript
{
  path: 'dashboard',
  canActivate: [authGuard],
  loadComponent: () => import('./features/dashboard/dashboard.component')
}
```

**Protection** : Toutes les routes sauf `/login`, `/signup`, `/auth/confirm`, `/auth/reset`

### childParentGuard

**Localisation** : `features/child/guards/child-parent.guard.ts`

**Rôle** : Vérifie que l'enfant appartient au parent connecté.

**Logique** :
1. Récupère l'enfant depuis la route (`:id` ou `:childId`)
2. Vérifie la relation parent/enfant via RLS
3. Redirige vers `/dashboard` si pas de relation

**Utilisation** :
```typescript
{
  path: 'child-profile/:id',
  canActivate: [authGuard, childParentGuard],
  loadComponent: () => import('./features/child/child.component')
}
```

**Vérification** :
```typescript
// Vérifie que child.parent_id === currentUser.id
const { data: child } = await supabase
  .from('children')
  .select('id, parent_id')
  .eq('id', childId)
  .maybeSingle();

if (child.parent_id !== user.id) {
  // Accès refusé
  return false;
}
```

### roleGuard

**Localisation** : `features/login/guards/role.guard.ts`

**Rôle** : Vérifie les rôles spécifiques de l'utilisateur.

**Logique** :
1. Vérifie que l'utilisateur a au moins un des rôles requis
2. Redirige si pas de rôle approprié

**Utilisation** :
```typescript
{
  path: 'teacher-profile',
  canActivate: [authGuard, roleGuard(['prof'])],
  loadComponent: () => import('./features/teacher/teacher.component')
}
```

## Routing

### Routes principales

```typescript
// app.routes.ts
export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component')
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard.component')
  },
  {
    path: 'parent-profile',
    canActivate: [authGuard],
    loadComponent: () => import('./features/parent/parent.component')
  },
  {
    path: 'child-profile/:id',
    canActivate: [authGuard, childParentGuard],
    loadComponent: () => import('./features/child/child.component')
  },
  {
    path: 'teacher-profile',
    canActivate: [authGuard],
    loadComponent: () => import('./features/teacher/teacher.component')
  },
  // ...
];
```

### Lazy Loading

Tous les composants sont chargés à la demande :

```typescript
loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
```

**Avantages** :
- Réduction de la taille du bundle initial
- Chargement à la demande
- Meilleure performance

## Stores NgRx Signals partagés

### Stores dans `shared/store/`

Les stores suivants sont partagés entre plusieurs features :

- **EnrollmentsStore** : Inscriptions enfants ↔ matières
- **SchoolsStore** : Écoles et années scolaires
- **SubjectsStore** : Matières disponibles
- **SubjectCategoriesStore** : Sous-catégories de matières

**Localisation** : `shared/store/`

**Utilisation** :
```typescript
// Dans n'importe quelle feature
private readonly enrollmentsStore = inject(EnrollmentsStore);
```

## Bonnes pratiques

### Création d'une nouvelle feature

1. **Créer la structure** :
   ```
   features/[feature-name]/
   ├── [feature].component.ts
   ├── components/ (optionnel)
   ├── services/ (optionnel)
   ├── store/ (optionnel)
   └── types/ (optionnel)
   ```

2. **Protéger les routes** :
   - Utiliser `authGuard` pour toutes les routes protégées
   - Utiliser `childParentGuard` si accès à un enfant spécifique
   - Utiliser `roleGuard` si accès réservé à un rôle

3. **Lazy loading** : Tous les composants doivent être lazy-loaded

4. **Gestion d'erreurs** : Toujours gérer les erreurs dans les services

### Guards

1. **Toujours utiliser `authGuard`** pour les routes protégées
2. **Vérifier les permissions** avant d'afficher les données
3. **Rediriger vers login** si non authentifié
4. **Logger les tentatives d'accès non autorisées**

## Voir aussi

- [docs/architecture.md](../../../../docs/architecture.md) : Architecture complète
- [docs/security.md](../../../../docs/security.md) : Sécurité et guards
- [core/README.md](../core/README.md) : Services d'authentification
- [shared/README.md](../shared/README.md) : Services et stores partagés
