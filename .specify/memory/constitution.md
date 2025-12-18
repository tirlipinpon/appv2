<!--
  SYNC IMPACT REPORT

  Version Change: Initial → 1.0.0

  New Constitution Created:
  - All placeholders filled with project-specific values
  - 5 core principles defined based on .cursor/rules and Angular/NgRx best practices
  - Technical constraints section added
  - Development workflow section added
  - Governance rules established

  Templates Requiring Updates:
  - ✅ plan-template.md: Constitution Check gate already present
  - ✅ spec-template.md: User story format aligns with testability principle
  - ✅ tasks-template.md: Task categorization supports layered architecture

  Follow-up Actions: None - All placeholders resolved

  Validation Date: 2025-12-18
-->

# appv2 Constitution

## Core Principles

### I. Architecture en Couches (NON-NÉGOCIABLE)

L'application DOIT respecter une séparation stricte en couches : UI → Application → Store → Infrastructure → API Services.

**Règles contraignantes** :

- Chaque couche a une responsabilité unique et ne peut pas être contournée
- Les composants Smart (racine des features) orchestrent via le pattern Facade
- Les composants Dumb se limitent à la présentation
- L'Application Service centralise la logique métier et les workflows
- L'Infrastructure Service applique le pattern Adapter pour isoler les services API
- Les API Services sont les seuls points d'accès aux données externes (Supabase, etc.)

**Rationale** : Cette séparation garantit la testabilité, la maintenabilité et permet de remplacer n'importe quelle couche sans affecter les autres. Elle évite la dette technique et facilite l'onboarding des nouveaux développeurs.

### II. Signal-First & État Réactif

L'état de l'application DOIT être géré via Angular Signals et NgRx Signal Store exclusivement.

**Règles contraignantes** :

- L'état local des composants utilise `signal()` d'Angular
- L'état global des features utilise `signalStore` de NgRx avec `withState`, `withComputed`, `withMethods`
- Les états dérivés utilisent `computed()` pour éviter les recalculs inutiles
- Les réactions automatiques utilisent `effect()` dans l'Application Service
- Les mutations directes sont INTERDITES : utiliser uniquement `set()` ou `update()`
- Les opérations asynchrones utilisent `rxMethod` avec gestion d'erreur obligatoire

**Rationale** : Les Signals offrent une réactivité fine et performante (change detection optimale). NgRx Signal Store fournit une gestion d'état prévisible et debuggable, alignée avec les recommandations officielles Angular/NgRx.

### III. Composants Standalone & Lazy Loading

Tous les composants DOIVENT être standalone et les features DOIVENT être lazy-loaded.

**Règles contraignantes** :

- `standalone: true` par défaut (Angular 20+)
- Injection via `inject()` fonction, pas de constructeur injection
- `changeDetection: ChangeDetectionStrategy.OnPush` obligatoire
- Chaque feature est chargée via route avec `loadComponent` ou `loadChildren`
- Les imports de composants sont explicites dans le décorateur `@Component`
- Les modules NgModule sont INTERDITS pour les nouvelles features

**Rationale** : Les composants standalone réduisent la complexité, améliorent le tree-shaking et permettent un lazy loading granulaire. OnPush garantit des performances optimales en limitant les cycles de détection de changements.

### IV. Testabilité & Type Safety (NON-NÉGOCIABLE)

Le code DOIT être fortement typé et systématiquement testé selon la criticité.

**Règles contraignantes** :

- TypeScript `strict: true` activé dans tsconfig.json
- Le type `any` est INTERDIT sauf justification documentée
- Interfaces typées obligatoires pour toutes les entités métier
- Tests unitaires OBLIGATOIRES pour : services, utils, stores
- Tests E2E Cypress OBLIGATOIRES pour : parcours critiques d'authentification et workflows multi-rôles
- Les guards, repositories et services métier doivent avoir une couverture > 80%
- Chaque test doit avoir un nom explicite décrivant le comportement testé

**Rationale** : Le typage strict prévient les erreurs runtime et améliore l'expérience développeur (autocomplétion, refactoring). Les tests E2E garantissent que les parcours utilisateurs fonctionnent de bout en bout, particulièrement critique pour l'authentification multi-rôles.

### V. Design System & Accessibilité

L'interface DOIT utiliser le design system centralisé et respecter les normes WCAG AA.

**Règles contraignantes** :

- Utilisation OBLIGATOIRE des variables SCSS (`$color-primary`, `$spacing-md`, etc.)
- Utilisation des mixins pour composants réutilisables (`@include button-base`, `@include card-base`)
- Valeurs en dur (couleurs, espacements) INTERDITES dans les composants
- Conformité WCAG AA minimum : contraste, navigation clavier, labels ARIA
- Angular Material utilisé comme base, personnalisé via le design system
- Responsive design avec breakpoints définis (`$breakpoint-md`, `$breakpoint-lg`)
- Tests de contraste automatiques via tooling

**Rationale** : Le design system garantit la cohérence visuelle et accélère le développement. L'accessibilité n'est pas optionnelle : elle élargit l'audience et est une obligation légale dans l'éducation.

## Contraintes Techniques

### Stack Technologique

**Framework & Versions** :

- Angular 20.x avec TypeScript 5.8+
- NgRx Signals 20.x pour la gestion d'état
- Angular Material 20.x pour les composants UI
- Supabase JS 2.80+ pour l'authentification et base de données
- Cypress 15.x pour les tests E2E
- Jasmine/Karma pour les tests unitaires

**Authentification & Sécurité** :

- Authentification via Supabase Auth
- Row-Level Security (RLS) activé sur toutes les tables
- Gestion multi-rôles : parent, enfant, professeur, admin
- Tokens JWT gérés automatiquement par Supabase
- Guards Angular pour protéger les routes selon les rôles

**Déploiement & Versioning** :

- Déploiement FTP automatisé via script Node.js (`scripts/deploy-ftp.js`)
- Versioning sémantique (MAJOR.MINOR.PATCH)
- Incrémentation automatique via `scripts/increment-version.js` au build
- Version injectée dans l'application via `src/app/core/version.ts`

**Performance & Contraintes** :

- Build Angular avec optimisations activées (tree-shaking, minification)
- Lazy loading obligatoire pour features > 100KB
- Images via `NgOptimizedImage` pour optimisation automatique
- Base-href configurable pour déploiement en sous-répertoire

## Workflow de Développement

### Structure des Features

Chaque feature DOIT suivre la structure standardisée définie dans `.cursor/rules` :

```
features/[feature-name]/
├── [feature-name].component.ts      # Smart Component (point d'entrée)
├── components/
│   ├── application/                 # Orchestration métier (Facade Pattern)
│   ├── infrastructure/              # Wrapper API (Adapter Pattern)
│   └── [ui-components]/             # Composants de présentation
├── services/                        # Services métier de la feature
├── store/                           # NgRx Signal Store
├── types/                           # Interfaces TypeScript
├── guards/                          # Guards de protection (si nécessaire)
├── repositories/                    # Repositories pour accès données
└── utils/                           # Utilitaires purs
```

### Processus de Développement

**Avant le code** :

1. Spécification feature validée (`.specify/specs/[feature]/spec.md`)
2. Plan d'implémentation approuvé (`.specify/specs/[feature]/plan.md`)
3. Constitution Check passé (vérification des principes)

**Pendant le développement** :

1. Créer une branche feature depuis `main` : `[issue-number]-[feature-name]`
2. Implémenter selon l'ordre des tasks (`.specify/specs/[feature]/tasks.md`)
3. Tests unitaires pour services/stores/utils
4. Tests E2E Cypress pour parcours critiques
5. Vérifier lints : `npm run lint`
6. Commit avec messages explicites référençant l'issue : `feat: [description] (#123)`

**Code Review** :

1. Pull Request avec description détaillée
2. Revue obligatoire par au moins 1 développeur
3. Vérification : tests passent, lints OK, design system respecté
4. Validation de la conformité aux principes constitutionnels
5. Merge après approbation

**Tests obligatoires** :

- Tests unitaires : services, stores, utils, guards
- Tests E2E : authentification, workflows multi-rôles, parcours critiques
- Tests manuels : responsive, accessibilité, navigation clavier

### Gestion des Erreurs

**Logging structuré** :

- Service `LoggingService` centralisé dans `shared/services/logging/`
- Logs avec contexte : composant, action, données pertinentes
- Erreurs Supabase normalisées via Infrastructure Service

**Gestion d'erreurs** :

- Service `ErrorService` centralisé dans `shared/services/error/`
- Toast notifications pour erreurs utilisateur via `ToastService`
- Store : liste d'erreurs typées (`PostgrestError[]`)

## Gouvernance

### Amendements à la Constitution

**Processus d'amendement** :

1. Proposition documentée avec justification et impact analysé
2. Discussion avec l'équipe de développement
3. Validation par le lead technique
4. Mise à jour du numéro de version selon les règles de versioning
5. Propagation des changements aux templates dépendants
6. Communication à toute l'équipe

**Versioning de la Constitution** :

- **MAJOR** : Changement incompatible (suppression/redéfinition de principe)
- **MINOR** : Ajout de principe ou expansion significative
- **PATCH** : Clarifications, corrections, ajustements mineurs

### Conformité & Révision

**Conformité obligatoire** :

- Toutes les Pull Requests DOIVENT vérifier la conformité aux principes
- Les violations nécessitent une justification dans `plan.md` (section Complexity Tracking)
- Les justifications doivent démontrer qu'aucune alternative plus simple n'existe

**Révision régulière** :

- Constitution révisée à chaque sprint ou milestone majeur
- Identification des patterns émergents pouvant devenir des principes
- Suppression des principes non applicables ou obsolètes
- Mise à jour selon les évolutions Angular/NgRx officielles

**Référence pour développement** :

- Ce fichier constitution est la référence ultime pour l'architecture
- En cas de conflit avec autre documentation, la constitution prime
- `.cursor/rules` fournit les détails d'implémentation alignés avec cette constitution

**Version**: 1.0.0 | **Ratified**: 2025-12-18 | **Last Amended**: 2025-12-18
