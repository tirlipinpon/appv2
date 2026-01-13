# API et Services Supabase

## Vue d'ensemble

L'application utilise Supabase comme backend (PostgreSQL + Auth + Storage). Toutes les interactions avec la base de données passent par le client Supabase JavaScript.

## Services API principaux

### SupabaseService

**Localisation** :
- Frontend : `projects/frontend/src/app/core/services/supabase/supabase.service.ts`
- Admin : `projects/admin/src/app/shared/services/supabase/supabase.service.ts`

**Rôle** : Service central pour toutes les interactions avec Supabase.

**Fonctionnalités** :

#### Frontend

- Création du client Supabase
- Interception des erreurs d'authentification (401/403)
- Ajout automatique du JWT aux requêtes (via `ChildAuthService`)
- Wrapper `executeWithErrorHandling()` pour gestion d'erreurs standardisée

**Exemple d'utilisation** :

```typescript
// Dans Infrastructure
const { data, error } = await this.supabase.client
  .from('games')
  .select('*')
  .eq('subject_category_id', categoryId);

if (error) throw error;
return data || [];
```

#### Admin

- Création du client Supabase standard
- Pas d'interception automatique (gestion via interceptors HTTP)

## Endpoints Supabase par domaine

### Authentification

#### Frontend (Enfants)

**Connexion enfant** :
```typescript
// Query publique (RLS permet lecture avec firstname + login_pin)
const { data, error } = await supabase
  .from('children')
  .select('*')
  .eq('firstname', firstname)
  .eq('login_pin', pin)
  .eq('is_active', true)
  .single();
```

**Edge Function** : `auth-login-child`
- Localisation : `supabase/functions/auth-login-child/`
- Rôle : Génération de JWT personnalisé pour enfants
- Usage : Authentification simplifiée sans email

#### Admin (Parents/Profs)

**Connexion Supabase Auth** :
```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password
});
```

**Récupération du profil** :
```typescript
const { data, error } = await supabase
  .from('profiles')
  .select('*, parents(*), teachers(*)')
  .eq('id', userId)
  .single();
```

### Matières et Sous-catégories

#### Charger les matières d'un enfant

```typescript
// 1. Récupérer les inscriptions activées
const { data: enrollments } = await supabase
  .from('child_subject_enrollments')
  .select('subject_id')
  .eq('child_id', childId)
  .eq('selected', true);

// 2. Récupérer les matières correspondantes
const { data: subjects } = await supabase
  .from('subjects')
  .select('*')
  .in('id', subjectIds)
  .order('name');
```

#### Charger les sous-catégories d'une matière

```typescript
const { data, error } = await supabase
  .from('subject_categories')
  .select('*')
  .eq('subject_id', subjectId)
  .order('name');
```

#### Charger la progression par sous-catégorie

```typescript
const { data, error } = await supabase
  .from('frontend_subject_category_progress')
  .select('*')
  .eq('child_id', childId)
  .in('subject_category_id', categoryIds);
```

### Jeux

#### Charger les jeux d'une sous-catégorie

```typescript
const { data, error } = await supabase
  .from('games')
  .select(`
    *,
    game_types!inner(name)
  `)
  .eq('subject_category_id', categoryId);
```

#### Charger les jeux d'une matière (sans sous-catégorie)

```typescript
const { data, error } = await supabase
  .from('games')
  .select(`
    *,
    game_types!inner(name)
  `)
  .eq('subject_id', subjectId)
  .is('subject_category_id', null);
```

#### Sauvegarder une tentative de jeu

```typescript
const { data, error } = await supabase
  .from('frontend_game_attempts')
  .insert({
    child_id: childId,
    game_id: gameId,
    success: score === 100,
    score: score,
    duration_ms: duration,
    responses_json: responses,
    difficulty_level: difficulty,
    started_at: startTime,
    completed_at: new Date().toISOString()
  });
```

#### Récupérer les scores des jeux

```typescript
const { data, error } = await supabase
  .from('frontend_game_attempts')
  .select('game_id, score')
  .eq('child_id', childId)
  .in('game_id', gameIds);

// Calculer le meilleur score par jeu
const scoresMap = new Map<string, number>();
data?.forEach(attempt => {
  const currentScore = scoresMap.get(attempt.game_id) || 0;
  if (attempt.score > currentScore) {
    scoresMap.set(attempt.game_id, attempt.score);
  }
});
```

### Badges

#### Charger les badges disponibles

```typescript
const { data, error } = await supabase
  .from('frontend_badges')
  .select('*')
  .eq('is_active', true)
  .order('name');
```

#### Charger les badges débloqués par un enfant

```typescript
const { data, error } = await supabase
  .from('frontend_child_badges')
  .select(`
    *,
    frontend_badges(*)
  `)
  .eq('child_id', childId)
  .order('unlocked_at', { ascending: false });
```

**Note** : Les badges sont débloqués automatiquement via triggers PostgreSQL. Voir [docs/badges-system.md](badges-system.md).

### Collectibles

#### Charger les collectibles disponibles

```typescript
const { data, error } = await supabase
  .from('frontend_collectibles')
  .select('*')
  .eq('is_active', true)
  .order('display_order');
```

#### Charger les collectibles débloqués

```typescript
const { data, error } = await supabase
  .from('frontend_child_collectibles')
  .select(`
    *,
    frontend_collectibles(*)
  `)
  .eq('child_id', childId)
  .order('unlocked_at', { ascending: false });
```

### Jeux bonus

#### Charger les jeux bonus disponibles

```typescript
const { data, error } = await supabase
  .from('frontend_bonus_games')
  .select('*')
  .eq('is_active', true)
  .order('name');
```

#### Charger les jeux bonus débloqués

```typescript
const { data, error } = await supabase
  .from('frontend_child_bonus_game_unlocks')
  .select(`
    *,
    frontend_bonus_games(*)
  `)
  .eq('child_id', childId)
  .order('unlocked_at', { ascending: false });
```

### Mascotte

#### Charger l'état de la mascotte

```typescript
const { data, error } = await supabase
  .from('frontend_child_mascot_state')
  .select('*')
  .eq('child_id', childId)
  .single();

// Créer un état par défaut si inexistant
if (!data) {
  const { data: newState } = await supabase
    .from('frontend_child_mascot_state')
    .insert({
      child_id: childId,
      level: 1,
      xp: 0,
      evolution_stage: 1
    })
    .select()
    .single();
}
```

#### Mettre à jour l'XP

```typescript
const { data, error } = await supabase
  .from('frontend_child_mascot_state')
  .update({
    xp: supabase.raw('xp + ?', [xpGained]),
    level: supabase.raw('floor(sqrt(xp / 100)) + 1'),
    evolution_stage: supabase.raw(`
      CASE
        WHEN level >= 20 THEN 5
        WHEN level >= 15 THEN 4
        WHEN level >= 10 THEN 3
        WHEN level >= 5 THEN 2
        ELSE 1
      END
    `),
    last_xp_gain_at: new Date().toISOString()
  })
  .eq('child_id', childId);
```

### Statistiques

#### Charger les statistiques d'un enfant

```typescript
// Requête complexe avec agrégations
const { data, error } = await supabase
  .rpc('get_child_statistics', { child_id: childId });
```

**Note** : Cette fonction RPC doit être créée dans Supabase. Sinon, calculer côté client :

```typescript
// Compter les tentatives
const { count: totalAttempts } = await supabase
  .from('frontend_game_attempts')
  .select('*', { count: 'exact', head: true })
  .eq('child_id', childId);

// Compter les tentatives réussies
const { count: successfulAttempts } = await supabase
  .from('frontend_game_attempts')
  .select('*', { count: 'exact', head: true })
  .eq('child_id', childId)
  .eq('success', true);

// Calculer le taux de réussite
const successRate = totalAttempts > 0 
  ? (successfulAttempts / totalAttempts) * 100 
  : 0;
```

### Thèmes

#### Charger les thèmes disponibles

```typescript
const { data, error } = await supabase
  .from('frontend_themes')
  .select('*')
  .or('is_default.eq.true,unlock_condition_json.is.null')
  .order('display_order');
```

#### Charger les thèmes débloqués

```typescript
const { data, error } = await supabase
  .from('frontend_child_themes')
  .select(`
    *,
    frontend_themes(*)
  `)
  .eq('child_id', childId)
  .order('unlocked_at', { ascending: false });
```

#### Sélectionner un thème

```typescript
// Désélectionner tous les autres
await supabase
  .from('frontend_child_themes')
  .update({ is_selected: false })
  .eq('child_id', childId);

// Sélectionner le nouveau
await supabase
  .from('frontend_child_themes')
  .upsert({
    child_id: childId,
    theme_id: themeId,
    is_selected: true,
    unlocked_at: new Date().toISOString()
  });
```

## Storage (Supabase Storage)

### Buckets disponibles

- **`game-images`** : Images de jeux (limite 10MB, types: jpeg, jpg, png, webp, gif)
- **`puzzle-images`** : Images de pièces de puzzle (limite 5MB, types: png, webp)
- **`aides-images`** : Images d'aide pour les jeux (limite 10MB, types: jpeg, jpg, png, webp, gif)

### Upload d'image

```typescript
const { data, error } = await supabase.storage
  .from('game-images')
  .upload(`games/${gameId}/${filename}`, file, {
    contentType: file.type,
    upsert: false
  });

if (error) throw error;

// Récupérer l'URL publique
const { data: { publicUrl } } = supabase.storage
  .from('game-images')
  .getPublicUrl(data.path);
```

### Récupérer une image

```typescript
// URL publique directe
const { data: { publicUrl } } = supabase.storage
  .from('game-images')
  .getPublicUrl('games/123/image.png');
```

## Edge Functions

### auth-login-child

**Localisation** : `supabase/functions/auth-login-child/`

**Rôle** : Génération de JWT personnalisé pour l'authentification enfant.

**Endpoint** : `POST /functions/v1/auth-login-child`

**Body** :
```json
{
  "firstname": "Lucas",
  "login_pin": "1234"
}
```

**Response** :
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "child": {
    "id": "uuid",
    "firstname": "Lucas",
    // ... autres champs
  }
}
```

### deepseek-proxy

**Localisation** : `supabase/functions/deepseek-proxy/`

**Rôle** : Proxy pour l'API DeepSeek (clé API stockée comme secret Supabase).

**Endpoint** : `POST /functions/v1/deepseek-proxy`

**Body** :
```json
{
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "model": "deepseek-chat"
}
```

**Response** : Réponse de l'API DeepSeek

## Gestion des erreurs

### Types d'erreurs Supabase

#### PostgrestError

Erreur standard Supabase pour les requêtes PostgreSQL :

```typescript
interface PostgrestError {
  message: string;
  details: string;
  hint: string;
  code: string;
}
```

#### Erreurs d'authentification

- **401 Unauthorized** : Session expirée ou invalide
- **403 Forbidden** : Permissions insuffisantes (RLS)

### Gestion dans Infrastructure

**Pattern standard** :

```typescript
async loadData(): Promise<Data[]> {
  const { data, error } = await this.supabase.client
    .from('table')
    .select('*');

  if (error) {
    // Logger l'erreur
    console.error('Erreur Supabase:', error);
    throw error;
  }

  return data || [];
}
```

### Gestion dans SupabaseService (Frontend)

**Wrapper avec gestion d'erreurs** :

```typescript
async executeWithErrorHandling<T>(
  operation: () => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any }> {
  const result = await operation();
  
  if (result.error) {
    // Vérifier si c'est une erreur d'authentification
    if (this.errorHandler.isAuthError(result.error)) {
      await this.errorHandler.handleError(result.error);
    }
  }
  
  return result;
}
```

### Gestion dans Interceptor (Admin)

**httpErrorInterceptor** intercepte toutes les erreurs HTTP et les affiche via ErrorSnackbarService :

```typescript
export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Normaliser l'erreur
      const normalized = errorHandler.normalize(error);
      
      // Afficher dans snackbar
      errorSnackbar.showError(normalized.message);
      
      // Propager l'erreur
      return throwError(() => normalized);
    })
  );
};
```

## RLS (Row-Level Security)

Les permissions sont gérées au niveau base de données via RLS. Voir [docs/security.md](security.md) pour les détails.

**Important** : Les requêtes Supabase respectent automatiquement les politiques RLS selon l'utilisateur connecté.

### Exemples de filtrage RLS

- **Enfants** : Accès uniquement à leurs propres données (`child_id = auth.uid()`)
- **Parents** : Accès aux données de leurs enfants (via relation `parent_id`)
- **Professeurs** : Accès aux jeux de leurs matières (via `teacher_assignments`)
- **Public** : Lecture seule des tables frontend actives

## Cache

### CacheService (Frontend)

**Localisation** : `projects/frontend/src/app/core/services/cache/cache.service.ts`

**Usage** : Cache en mémoire avec expiration (TTL).

```typescript
// Dans Infrastructure
const cacheKey = 'subjects:child:123';
const cached = this.cache.get<Subject[]>(cacheKey);
if (cached) return cached;

// ... fetch data ...
this.cache.set(cacheKey, data, 10 * 60 * 1000); // 10 minutes
```

**Stratégie** : Cache les données fréquemment accédées (matières, sous-catégories) avec TTL de 10 minutes.

## Bonnes pratiques

1. **Toujours vérifier les erreurs** :
   ```typescript
   const { data, error } = await supabase.from('table').select();
   if (error) throw error;
   ```

2. **Utiliser les types TypeScript** :
   ```typescript
   const { data } = await supabase
     .from('games')
     .select('*')
     .returns<Game[]>();
   ```

3. **Optimiser les requêtes** :
   - Utiliser `.select()` avec des champs spécifiques
   - Utiliser `.limit()` pour limiter les résultats
   - Utiliser des index (définis dans les migrations)

4. **Gérer les relations** :
   ```typescript
   .select(`
     *,
     game_types!inner(name),
     subjects(name)
   `)
   ```

5. **Utiliser le cache** pour les données statiques ou peu changeantes

6. **Respecter RLS** : Ne pas essayer de contourner les politiques de sécurité
