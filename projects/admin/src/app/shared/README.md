# Shared Admin - Composants, Services et Stores Partagés

## Vue d'ensemble

Le dossier `shared/` contient tous les composants, services, stores, interceptors et utilitaires partagés entre les features de l'application admin.

## Structure

```
shared/
├── components/                    # Composants réutilisables
│   ├── app-header/               # Header de l'application
│   ├── action-links/             # Liens d'action
│   ├── confirmation-dialog/      # Dialog de confirmation
│   ├── form-field/               # Champ de formulaire
│   ├── games-stats-display/      # Affichage de statistiques de jeux
│   ├── school-level-select/      # Sélecteur de niveau scolaire
│   ├── scroll-to-top/            # Bouton scroll to top
│   └── toast/                    # Notifications toast
├── services/                      # Services partagés
│   ├── supabase/                 # Service Supabase
│   ├── auth/                     # Service auth (wrapper)
│   ├── error-handler/            # Gestion d'erreurs
│   ├── toast/                    # Notifications toast
│   ├── confirmation-dialog/      # Dialogs de confirmation
│   ├── cache/                    # Cache en mémoire
│   ├── logging/                  # Logging structuré
│   └── ...
├── store/                         # Stores NgRx Signals partagés
│   ├── enrollments.store.ts      # Inscriptions
│   ├── schools.store.ts          # Écoles
│   ├── subjects.store.ts         # Matières
│   └── subject-categories.store.ts # Sous-catégories
├── interceptors/                  # Intercepteurs HTTP
│   └── http-error.interceptor.ts # Gestion erreurs HTTP
├── repositories/                  # Repository pattern
│   └── base-repository.service.ts # Repository de base
├── decorators/                    # Décorateurs
│   └── catch-error.decorator.ts  # Décorateur de gestion d'erreurs
├── tokens/                        # Tokens d'injection
│   ├── environment.token.ts     # Token pour environment
│   └── app-version.token.ts      # Token pour version
└── utils/                         # Utilitaires
    ├── store-error-helper.ts     # Helper pour erreurs de store
    └── track-by.util.ts          # Track by functions
```

## Composants partagés

### AppHeader

**Localisation** : `components/app-header/app-header.component.ts`

**Rôle** : Header de l'application avec navigation et informations utilisateur.

**Fonctionnalités** :
- Navigation principale
- Affichage du profil utilisateur
- Menu déroulant avec actions
- Déconnexion

### ActionLinks

**Localisation** : `components/action-links/action-links.component.ts`

**Rôle** : Liens d'action rapides (créer, modifier, supprimer, etc.).

**Fonctionnalités** :
- Liens stylisés
- Icônes
- Actions contextuelles

### ConfirmationDialog

**Localisation** : `components/confirmation-dialog/confirmation-dialog.component.ts`

**Rôle** : Dialog de confirmation pour actions destructives.

**Fonctionnalités** :
- Message de confirmation
- Boutons Oui/Non
- Style Material

**Service associé** : `ConfirmationDialogService`

### FormField

**Localisation** : `components/form-field/form-field.component.ts`

**Rôle** : Champ de formulaire réutilisable avec validation.

**Fonctionnalités** :
- Label et placeholder
- Validation et messages d'erreur
- Styles cohérents

### GamesStatsDisplay

**Localisation** : `components/games-stats-display/games-stats-display.component.ts`

**Rôle** : Affichage des statistiques de jeux par type.

**Fonctionnalités** :
- Comptage par type de jeu
- Affichage visuel (graphiques, listes)
- Filtrage

### SchoolLevelSelect

**Localisation** : `components/school-level-select/school-level-select.component.ts`

**Rôle** : Sélecteur de niveau scolaire (M1-M3, P1-P6, S1-S6, Autre).

**Fonctionnalités** :
- Liste déroulante avec niveaux
- Validation
- Filtrage par école (optionnel)

### ScrollToTop

**Localisation** : `components/scroll-to-top/scroll-to-top.component.ts`

**Rôle** : Bouton pour remonter en haut de la page.

**Fonctionnalités** :
- Apparition/disparition selon le scroll
- Animation
- Position fixe

### Toast

**Localisation** : `components/toast/toast.component.ts`

**Rôle** : Notification toast (succès, erreur, info).

**Fonctionnalités** :
- Messages temporaires
- Types : success, error, info, warning
- Auto-dismiss
- Animation

**Service associé** : `ToastService`

## Services partagés

### SupabaseService

**Localisation** : `services/supabase/supabase.service.ts`

**Rôle** : Service central pour toutes les interactions avec Supabase.

**Fonctionnalités** :
- Création du client Supabase
- Accès au client via `client`

**Voir** : [docs/api.md](../../../../docs/api.md) pour les détails.

### AuthService

**Localisation** : `services/auth/auth.service.ts`

**Rôle** : Wrapper autour de `AuthCoreService` et `ProfileService`.

**Fonctionnalités** :
- Connexion/déconnexion
- Récupération du profil
- Vérification des rôles

### ErrorHandlerService

**Localisation** : `services/error/error-handler.service.ts`

**Rôle** : Normalisation et gestion centralisée des erreurs.

**Fonctionnalités** :
- Normalisation des erreurs (Supabase, HTTP, custom)
- Mapping des codes d'erreur vers messages conviviaux
- Format standardisé

**Types d'erreurs gérées** :
- Erreurs d'authentification (invalid_credentials, email_not_confirmed, etc.)
- Erreurs de base de données (PGRST116, 23505, 23503, etc.)
- Erreurs métier (profile_incomplete, no_children_enrolled, etc.)

**Utilisation** :
```typescript
const normalized = errorHandler.normalize(error, 'Message par défaut');
// Retourne un NormalizedError avec message convivial
```

### ErrorSnackbarService

**Localisation** : `services/snackbar/error-snackbar.service.ts`

**Rôle** : Affichage des erreurs dans des snackbars Material.

**Fonctionnalités** :
- Affichage de messages d'erreur
- Style Material Snackbar
- Auto-dismiss

### ToastService

**Localisation** : `services/toast/toast.service.ts`

**Rôle** : Gestion des notifications toast.

**Fonctionnalités** :
- Affichage de toasts (succès, erreur, info, warning)
- Gestion de la file d'attente
- Auto-dismiss configurable

### ConfirmationDialogService

**Localisation** : `services/confirmation-dialog/confirmation-dialog.service.ts`

**Rôle** : Ouverture de dialogs de confirmation.

**Fonctionnalités** :
- Dialog Material
- Message personnalisable
- Retour de la réponse (Oui/Non)

**Utilisation** :
```typescript
const confirmed = await this.confirmationDialog.open({
  title: 'Supprimer',
  message: 'Êtes-vous sûr de vouloir supprimer ?'
});
if (confirmed) {
  // Action de suppression
}
```

### CacheService

**Localisation** : `services/cache/cache.service.ts`

**Rôle** : Cache en mémoire avec expiration (TTL).

**Fonctionnalités** : Identique au CacheService frontend.

### CategoriesCacheService

**Localisation** : `services/categories-cache/categories-cache.service.ts`

**Rôle** : Cache spécialisé pour les catégories de matières.

**Fonctionnalités** :
- Cache des catégories par matière
- Invalidation après modification
- TTL configurable

### LoggerService

**Localisation** : `services/logging/logger.service.ts`

**Rôle** : Logging structuré pour le debugging.

**Fonctionnalités** :
- Logs avec contexte
- Niveaux de log (debug, info, warn, error)
- Format structuré

### GameTypeStyleService

**Localisation** : `services/game-type-style/game-type-style.service.ts`

**Rôle** : Styles et icônes selon le type de jeu.

**Fonctionnalités** :
- Récupération des styles (couleur, icône)
- Normalisation des types de jeux
- Fallback pour types inconnus

### GamesStatsService

**Localisation** : `services/games-stats/games-stats.service.ts`

**Rôle** : Calcul des statistiques de jeux.

**Fonctionnalités** :
- Comptage par type de jeu
- Statistiques par matière/catégorie
- Agrégations

### ProfileSyncService

**Localisation** : `services/synchronization/profile-sync.service.ts`

**Rôle** : Synchronisation du profil avec Supabase.

**Fonctionnalités** :
- Mise à jour du profil
- Synchronisation des rôles
- Gestion des conflits

## Stores NgRx Signals partagés

### EnrollmentsStore

**Localisation** : `store/enrollments.store.ts`

**Rôle** : Gestion des inscriptions enfants ↔ matières.

**État** :
- `enrollments: Enrollment[]`
- `loading: boolean`
- `error: string[]`

**Méthodes** :
- `loadEnrollments(childId)`
- `createEnrollment(enrollment)`
- `updateEnrollment(id, updates)`
- `deleteEnrollment(id)`

### SchoolsStore

**Localisation** : `store/schools.store.ts`

**Rôle** : Gestion des écoles et années scolaires.

**État** :
- `schools: School[]`
- `schoolYears: SchoolYear[]`
- `loading: boolean`
- `error: string[]`

**Méthodes** :
- `loadSchools()`
- `loadSchoolYears(schoolId)`
- `createSchool(school)`
- `updateSchool(id, updates)`

### SubjectsStore

**Localisation** : `store/subjects.store.ts`

**Rôle** : Gestion des matières.

**État** :
- `allSubjects: Subject[]`
- `subjectsBySchoolLevel: Record<string, Subject[]>`
- `subjectsByIds: Record<string, Subject>`
- `searchResults: Subject[]`
- `loading: boolean`
- `error: string[]`

**Computed** :
- `hasError: boolean`
- `hasSubjects: boolean`
- `hasSearchResults: boolean`

**Méthodes** :
- `loadAllSubjects()`
- `loadSubjectsBySchoolLevel(schoolId, schoolLevel)`
- `searchSubjects(query)`
- `getSubjectById(id)`

### SubjectCategoriesStore

**Localisation** : `store/subject-categories.store.ts`

**Rôle** : Gestion des sous-catégories de matières.

**État** :
- `categories: SubjectCategory[]`
- `categoriesBySubject: Record<string, SubjectCategory[]>`
- `loading: boolean`
- `error: string[]`

**Méthodes** :
- `loadCategories(subjectId)`
- `createCategory(category)`
- `updateCategory(id, updates)`
- `deleteCategory(id)`
- `transferCategory(id, newSubjectId)`

**Voir** : [shared/store/README.md](store/README.md) pour les détails.

## Intercepteurs

### httpErrorInterceptor

**Localisation** : `interceptors/http-error.interceptor.ts`

**Rôle** : Intercepte toutes les erreurs HTTP et les affiche via ErrorSnackbarService.

**Fonctionnalités** :
- Normalisation des erreurs HTTP
- Messages conviviaux selon le code HTTP
- Affichage dans snackbar
- Logging pour debugging

**Codes HTTP gérés** :
- `0` : Connexion impossible
- `400` : Requête invalide
- `401` : Non authentifié
- `403` : Permissions insuffisantes
- `404` : Ressource non trouvée
- `500` : Erreur serveur
- `503` : Service indisponible

**Configuration** :
```typescript
// app.config.ts
provideHttpClient(
  withInterceptors([httpErrorInterceptor])
)
```

## Repositories

### BaseRepositoryService

**Localisation** : `repositories/base-repository.service.ts`

**Rôle** : Repository de base avec méthodes CRUD communes.

**Fonctionnalités** :
- Méthodes génériques (create, read, update, delete)
- Gestion d'erreurs standardisée
- Cache optionnel

**Pattern** : Repository Pattern pour abstraction de l'accès aux données.

## Décorateurs

### catchError

**Localisation** : `decorators/catch-error.decorator.ts`

**Rôle** : Décorateur pour gestion automatique des erreurs.

**Fonctionnalités** :
- Interception des erreurs dans les méthodes
- Normalisation automatique
- Logging

**Utilisation** :
```typescript
@CatchError('Erreur lors du chargement')
async loadData() {
  // ...
}
```

## Tokens d'injection

### ENVIRONMENT

**Token** : `ENVIRONMENT`  
**Localisation** : `tokens/environment.token.ts`

**Rôle** : Injection de l'environment sans dépendance circulaire.

### APP_VERSION

**Token** : `APP_VERSION`  
**Localisation** : `tokens/app-version.token.ts`

**Rôle** : Injection de la version de l'application.

## Utilitaires

### store-error-helper.ts

**Localisation** : `utils/store-error-helper.ts`

**Rôle** : Helper pour gérer les erreurs dans les stores.

**Fonction** : `setStoreError(store, errorSnackbar, message)`

**Utilisation** :
```typescript
if (error) {
  setStoreError(store, errorSnackbar, error.message);
}
```

### track-by.util.ts

**Localisation** : `utils/track-by.util.ts`

**Rôle** : Track by functions pour optimiser les listes.

**Fonctions** :
- `trackById<T>(index: number, item: T & { id: string })`
- `trackByIndex(index: number)`

**Utilisation** :
```typescript
@for (item of items(); track trackById($index, item)) {
  <!-- ... -->
}
```

## Bonnes pratiques

### Services

1. **Utiliser `providedIn: 'root'`** pour les services partagés
2. **Gérer les erreurs** via `ErrorHandlerService`
3. **Afficher les notifications** via `ToastService` ou `ErrorSnackbarService`
4. **Utiliser le cache** pour les données fréquemment accédées

### Stores

1. **Stores partagés** : Utiliser les stores dans `shared/store/` pour les données partagées
2. **Computed signals** : Pour les valeurs calculées
3. **Gestion d'erreurs** : Utiliser `setStoreError()` helper

### Intercepteurs

1. **Toujours configurer** l'intercepteur dans `app.config.ts`
2. **Normaliser les erreurs** avant affichage
3. **Logger les erreurs** pour le debugging

## Voir aussi

- [docs/architecture.md](../../../../docs/architecture.md) : Architecture complète
- [docs/api.md](../../../../docs/api.md) : API et services Supabase
- [shared/store/README.md](store/README.md) : Détails des stores
- [core/README.md](../core/README.md) : Services d'authentification
