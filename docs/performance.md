# Performance : Indexes, Queries Optimisées et Stratégies de Cache

## Vue d'ensemble

Les optimisations de performance sont appliquées à plusieurs niveaux :
- **Base de données** : Indexes sur les colonnes fréquemment utilisées
- **Requêtes** : Optimisation des queries Supabase
- **Frontend** : Lazy loading, computed signals, cache
- **Réseau** : Parallélisation des appels API

## Indexes de base de données

### Indexes créés

#### Tables principales

**`subject_categories`** :
```sql
CREATE INDEX idx_subject_categories_subject_id ON subject_categories(subject_id);
```

**`games`** :
```sql
CREATE INDEX idx_games_subject_category_id ON games(subject_category_id);
```

**`child_subject_category_enrollments`** :
```sql
CREATE INDEX idx_child_category_enrollments_child_id ON child_subject_category_enrollments(child_id);
CREATE INDEX idx_child_category_enrollments_category_id ON child_subject_category_enrollments(subject_category_id);
```

#### Tables frontend

**`frontend_child_badges`** :
```sql
CREATE INDEX idx_child_badges_child_id ON frontend_child_badges(child_id);
CREATE INDEX idx_child_badges_badge_id ON frontend_child_badges(badge_id);
```

**`frontend_badge_levels`** :
```sql
CREATE INDEX idx_badge_levels_child_id ON frontend_badge_levels(child_id);
CREATE INDEX idx_badge_levels_badge_type ON frontend_badge_levels(badge_type);
```

**`frontend_first_perfect_games`** :
```sql
CREATE INDEX idx_first_perfect_games_child_id ON frontend_first_perfect_games(child_id);
CREATE INDEX idx_first_perfect_games_category_id ON frontend_first_perfect_games(subject_category_id);
```

**`frontend_daily_responses`** :
```sql
CREATE INDEX idx_daily_responses_child_date ON frontend_daily_responses(child_id, response_date);
```

**`frontend_consecutive_responses`** :
```sql
CREATE INDEX idx_consecutive_responses_child_id ON frontend_consecutive_responses(child_id);
```

**`frontend_perfect_games_count`** :
```sql
CREATE INDEX idx_perfect_games_count_child_id ON frontend_perfect_games_count(child_id);
```

### Indexes composites recommandés

**Pour optimiser les requêtes fréquentes** :

```sql
-- Requêtes par enfant et catégorie
CREATE INDEX idx_progress_child_category ON frontend_subject_category_progress(child_id, subject_category_id);

-- Requêtes par enfant et jeu
CREATE INDEX idx_attempts_child_game ON frontend_game_attempts(child_id, game_id);

-- Requêtes par enfant et date
CREATE INDEX idx_attempts_child_date ON frontend_game_attempts(child_id, completed_at);
```

## Requêtes optimisées

### Stratégies d'optimisation

#### 1. Sélection de colonnes spécifiques

**❌ Mauvaise pratique** :
```typescript
const { data } = await supabase
  .from('games')
  .select('*');  // Récupère toutes les colonnes
```

**✅ Bonne pratique** :
```typescript
const { data } = await supabase
  .from('games')
  .select('id, name, game_type_id, subject_category_id');  // Seulement les colonnes nécessaires
```

#### 2. Utilisation de `.limit()`

**Pour limiter les résultats** :
```typescript
const { data } = await supabase
  .from('frontend_child_badges')
  .select('*')
  .eq('child_id', childId)
  .order('unlocked_at', { ascending: false })
  .limit(10);  // Limite à 10 résultats
```

#### 3. Filtrage avec `.eq()`, `.in()`, `.gte()`

**Filtrage efficace** :
```typescript
// Filtrage par ID unique
.eq('child_id', childId)

// Filtrage par liste d'IDs
.in('game_id', gameIds)

// Filtrage par plage
.gte('completion_percentage', 100)
```

#### 4. Jointures optimisées

**Utilisation de `.select()` avec relations** :
```typescript
const { data } = await supabase
  .from('games')
  .select(`
    *,
    game_types!inner(name),
    subjects(name)
  `)
  .eq('subject_category_id', categoryId);
```

**Note** : `!inner` force une jointure interne (plus rapide que `!left`).

#### 5. Agrégations côté serveur

**Compter sans récupérer les données** :
```typescript
const { count } = await supabase
  .from('frontend_game_attempts')
  .select('*', { count: 'exact', head: true })
  .eq('child_id', childId)
  .eq('success', true);
```

### Exemples de requêtes optimisées

#### Charger les matières d'un enfant

**Optimisé** :
```typescript
// 1. Récupérer seulement les IDs des inscriptions
const { data: enrollments } = await supabase
  .from('child_subject_enrollments')
  .select('subject_id')  // Seulement l'ID
  .eq('child_id', childId)
  .eq('selected', true);

// 2. Récupérer les matières correspondantes
const subjectIds = enrollments.map(e => e.subject_id);
const { data: subjects } = await supabase
  .from('subjects')
  .select('id, name, description')  // Colonnes spécifiques
  .in('id', subjectIds)
  .order('name');
```

#### Charger la progression avec scores

**Optimisé** :
```typescript
// 1. Récupérer la progression
const { data: progress } = await supabase
  .from('frontend_subject_category_progress')
  .select('subject_category_id, completion_percentage, stars_count')
  .eq('child_id', childId)
  .in('subject_category_id', categoryIds);

// 2. Récupérer les scores des jeux en une seule requête
const { data: attempts } = await supabase
  .from('frontend_game_attempts')
  .select('game_id, score')
  .eq('child_id', childId)
  .in('game_id', gameIds);

// 3. Calculer le meilleur score par jeu côté client
const gameBestScores = new Map<string, number>();
attempts?.forEach(attempt => {
  const currentBest = gameBestScores.get(attempt.game_id) || 0;
  if (attempt.score > currentBest) {
    gameBestScores.set(attempt.game_id, attempt.score);
  }
});
```

## Lazy Loading

### Composants

**Tous les composants sont chargés à la demande** :

```typescript
// app.routes.ts
{
  path: 'game/:id',
  loadComponent: () => 
    import('./features/game/game.component')
      .then(m => m.GameComponent)
}
```

**Avantages** :
- Réduction de la taille du bundle initial
- Chargement à la demande
- Meilleure performance au démarrage

### Routes

**Lazy loading des routes** :
```typescript
export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  {
    path: 'subjects',
    loadComponent: () => import('./features/subjects/subjects.component').then(m => m.SubjectsComponent),
  },
  // ...
];
```

## Computed Signals

### Optimisation avec `computed()`

**Les computed signals évitent les recalculs inutiles** :

```typescript
// Dans un store NgRx Signals
export const GameStore = signalStore(
  withState(initialState),
  withComputed((state) => ({
    // Calculé uniquement quand currentGame ou gameState change
    currentQuestion: () => {
      const gameState = state.gameState();
      if (!gameState || gameState.questions.length === 0) return null;
      return gameState.questions[gameState.currentQuestionIndex];
    },
    // Calculé uniquement quand gameState change
    progress: () => {
      const gameState = state.gameState();
      if (!gameState || gameState.questions.length === 0) return 0;
      return Math.round(((gameState.currentQuestionIndex + 1) / gameState.questions.length) * 100);
    },
  }))
);
```

**Avantages** :
- Recalcul uniquement quand les dépendances changent
- Mise en cache automatique
- Performance optimale

### Exemple dans un composant

```typescript
export class SubjectsComponent {
  private store = inject(SubjectsStore);

  // Computed signal - recalculé uniquement quand store.subjects() change
  readonly subjectsCount = computed(() => this.store.subjects().length);
  
  // Computed signal - recalculé uniquement quand store.selectedSubject() change
  readonly hasSelectedSubject = computed(() => this.store.selectedSubject() !== null);
}
```

## Cache

### CacheService

**Localisation** : `projects/frontend/src/app/core/services/cache/cache.service.ts`

**Fonctionnalités** :
- Cache en mémoire avec expiration (TTL)
- Nettoyage automatique des entrées expirées
- Clés personnalisables

**Utilisation** :
```typescript
// Dans Infrastructure
const cacheKey = 'subjects:child:123';
const cached = this.cache.get<Subject[]>(cacheKey);
if (cached) return cached;

// ... fetch data ...
this.cache.set(cacheKey, data, 10 * 60 * 1000); // Cache 10 minutes
```

### Stratégies de cache

#### Données statiques (long TTL)

**Exemples** :
- Types de jeux : Cache 1 heure
- Matières : Cache 10 minutes
- Sous-catégories : Cache 10 minutes

```typescript
// Types de jeux (rarement modifiés)
this.cache.set('game-types:all', gameTypes, 60 * 60 * 1000); // 1 heure
```

#### Données dynamiques (court TTL)

**Exemples** :
- Progression : Cache 1 minute
- Statistiques : Cache 5 minutes
- Badges débloqués : Cache 5 minutes

```typescript
// Progression (change fréquemment)
this.cache.set(`progress:child:${childId}`, progress, 1 * 60 * 1000); // 1 minute
```

#### Invalidation du cache

**Stratégies** :
- **TTL** : Expiration automatique
- **Invalidation manuelle** : Après modification
- **Nettoyage périodique** : Via `cleanup()`

```typescript
// Invalidation après mise à jour
async updateProgress(...) {
  // Mise à jour dans la base de données
  await supabase.from('frontend_subject_category_progress').update(...);
  
  // Invalidation du cache
  this.cache.delete(`progress:child:${childId}:category:${categoryId}`);
}
```

## Parallélisation des appels API

### Utilisation de `forkJoin`

**Paralléliser les appels indépendants** :

```typescript
// Dans un store
loadDashboard: rxMethod<{ childId: string }>(
  pipe(
    switchMap(({ childId }) =>
      // Parallélisation avec Promise.all ou forkJoin
      Promise.all([
        statisticsService.loadChildStatistics(childId),
        infrastructure.loadRecentCollectibles(childId, 5),
        infrastructure.loadRecentBadges(childId, 5),
      ]).then(
        ([statistics, collectibles, badges]) => {
          patchState(store, {
            statistics,
            collectibles,
            badges,
            loading: false,
          });
        }
      )
    )
  )
)
```

**Avantages** :
- Réduction du temps total d'attente
- Appels simultanés au lieu de séquentiels
- Meilleure expérience utilisateur

### Exemple avec RxJS

```typescript
import { forkJoin } from 'rxjs';

forkJoin({
  subjects: this.infrastructure.loadSubjects(childId),
  progress: this.infrastructure.loadProgress(childId, categoryIds),
  badges: this.infrastructure.loadBadges(childId),
}).subscribe({
  next: ({ subjects, progress, badges }) => {
    // Toutes les données sont disponibles
    patchState(store, { subjects, progress, badges });
  },
  error: (error) => {
    patchState(store, { error: error.message });
  }
});
```

## Optimisations Angular

### Change Detection

**Utiliser `OnPush` pour réduire les vérifications** :

```typescript
@Component({
  selector: 'app-subject-card',
  changeDetection: ChangeDetectionStrategy.OnPush,  // Optimisation
  // ...
})
export class SubjectCardComponent {
  // Les changements sont détectés uniquement quand les inputs changent
  readonly subject = input.required<Subject>();
  readonly progress = input<SubjectCategoryProgress>();
}
```

### Track By Functions

**Optimiser les listes avec `@for`** :

```typescript
// Dans le composant
readonly trackBySubjectId = (index: number, subject: Subject) => subject.id;
readonly trackByCategoryId = (index: number, category: SubjectCategory) => category.id;

// Dans le template
@for (subject of subjects(); track trackBySubjectId($index, subject)) {
  <!-- ... -->
}
```

**Avantages** :
- Angular réutilise les composants existants
- Réduction des re-renders inutiles
- Meilleure performance avec de grandes listes

### Images optimisées

**Utiliser `NgOptimizedImage`** :

```typescript
import { NgOptimizedImage } from '@angular/common';

@Component({
  imports: [NgOptimizedImage],
  // ...
})
```

```html
<img 
  [ngSrc]="game.image_url" 
  [alt]="game.name"
  width="200"
  height="200"
  priority
/>
```

**Avantages** :
- Chargement lazy automatique
- Optimisation des images
- Meilleure performance

## Stratégies de synchronisation

### SyncService

**Localisation** : `projects/frontend/src/app/core/services/sync/sync.service.ts`

**Fonctionnalités** :
- Synchronisation périodique avec Supabase
- Gestion des conflits
- Mise à jour incrémentale

### AutoSaveService

**Localisation** : `projects/frontend/src/app/core/services/save/auto-save.service.ts`

**Fonctionnalités** :
- Sauvegarde automatique périodique
- Sauvegarde avant fermeture
- Gestion des états non sauvegardés

### CheckpointService

**Localisation** : `projects/frontend/src/app/core/services/save/checkpoint.service.ts`

**Fonctionnalités** :
- Points de sauvegarde à des moments clés
- Reprise de session après fermeture
- Nettoyage des anciens checkpoints

## Monitoring et métriques

### Métriques à surveiller

**Performance frontend** :
- Temps de chargement initial
- Temps de chargement des routes
- Temps de réponse des requêtes API
- Taille des bundles

**Performance base de données** :
- Temps d'exécution des requêtes
- Utilisation des index
- Nombre de requêtes par page
- Taille des résultats

### Outils de monitoring

**Angular DevTools** :
- Profiling des composants
- Détection des changements
- Performance des signals

**Redux DevTools** :
- Inspection des stores NgRx Signals
- Time travel debugging
- État de l'application

**Supabase Dashboard** :
- Logs des requêtes
- Métriques de performance
- Utilisation des ressources

## Bonnes pratiques

### Requêtes

1. **Sélectionner seulement les colonnes nécessaires**
2. **Utiliser `.limit()` pour limiter les résultats**
3. **Utiliser des index sur les colonnes filtrées**
4. **Éviter les requêtes N+1** (utiliser des jointures)
5. **Paralléliser les appels indépendants**

### Cache

1. **Utiliser le cache pour les données statiques**
2. **Invalidation après modification**
3. **TTL approprié selon la fréquence de changement**
4. **Nettoyage périodique des entrées expirées**

### Angular

1. **Lazy loading pour tous les composants**
2. **Computed signals pour les valeurs calculées**
3. **OnPush change detection quand possible**
4. **Track by functions pour les listes**
5. **NgOptimizedImage pour les images**

### Base de données

1. **Créer des index sur les colonnes filtrées**
2. **Utiliser des index composites pour les requêtes fréquentes**
3. **Analyser les requêtes lentes** (EXPLAIN)
4. **Optimiser les jointures**
5. **Éviter les SELECT * sur de grandes tables**
