# Logique de progression

## Vue d'ensemble

La progression est suivie par **sous-catégorie** (subject category) pour chaque enfant. Elle comprend :
- **Étoiles** (0-3) : Selon les performances
- **Pourcentage de complétion** (0-100%) : Basé sur les jeux réussis
- **Statut de complétion** : `completed=true` si complétée

## Table de progression

### `frontend_subject_category_progress`

**Structure** :
```typescript
interface SubjectCategoryProgress {
  id: string;
  child_id: string;
  subject_category_id: string;
  completed: boolean;              // Catégorie complétée
  stars_count: number;             // Nombre d'étoiles (0-3)
  completion_percentage: number;   // Pourcentage de complétion (0-100)
  last_played_at?: string;         // Dernière date de jeu
  created_at: string;
  updated_at: string;
}
```

**Contrainte** : `stars_count` entre 0 et 3, `completion_percentage` entre 0 et 100.

## Calcul du pourcentage de complétion

### Formule

```typescript
completion_percentage = (jeux réussis / total jeux) × 100
```

**Définitions** :
- **Jeu réussi** : Jeu avec meilleur score = 100%
- **Total jeux** : Nombre total de jeux dans la sous-catégorie

### Algorithme

1. **Récupérer tous les jeux** de la sous-catégorie
2. **Récupérer toutes les tentatives** de l'enfant pour ces jeux
3. **Calculer le meilleur score** pour chaque jeu
4. **Compter les jeux réussis** (meilleur score = 100%)
5. **Calculer le pourcentage** : `(jeux réussis / total jeux) × 100`

### Exemple d'implémentation

```typescript
async calculateCategoryCompletionPercentage(
  childId: string,
  subjectCategoryId: string
): Promise<number> {
  // 1. Récupérer tous les jeux de la catégorie
  const { data: games } = await supabase
    .from('games')
    .select('id')
    .eq('subject_category_id', subjectCategoryId);

  const totalGames = games?.length || 0;
  if (totalGames === 0) return 0;

  // 2. Récupérer les scores de tous les jeux pour cet enfant
  const gameIds = games.map(g => g.id);
  const { data: attempts } = await supabase
    .from('frontend_game_attempts')
    .select('game_id, score')
    .eq('child_id', childId)
    .in('game_id', gameIds);

  // 3. Calculer le meilleur score pour chaque jeu
  const gameBestScores = new Map<string, number>();
  attempts?.forEach(attempt => {
    const currentBest = gameBestScores.get(attempt.game_id) || 0;
    if (attempt.score > currentBest) {
      gameBestScores.set(attempt.game_id, attempt.score);
    }
  });

  // 4. Compter les jeux réussis (meilleur score = 100%)
  const completedGames = Array.from(gameBestScores.values())
    .filter(score => score === 100).length;
  
  // 5. Calculer le pourcentage
  return Math.round((completedGames / totalGames) * 100);
}
```

## Calcul des étoiles

### Système d'étoiles (0-3)

Les étoiles sont calculées selon le **score** et le **taux de réussite** :

```typescript
calculateStars(score: number, maxScore: number, successRate: number): number {
  if (successRate === 1.0 && score === maxScore) {
    return 3; // Parfait : 100% de réussite et score maximum
  } else if (successRate >= 0.8) {
    return 2; // Bien : 80%+ de réussite
  } else if (successRate >= 0.5) {
    return 1; // Passable : 50%+ de réussite
  }
  return 0; // À refaire : moins de 50% de réussite
}
```

**Critères** :
- **3 étoiles** : Taux de réussite = 100% ET score = score maximum
- **2 étoiles** : Taux de réussite ≥ 80%
- **1 étoile** : Taux de réussite ≥ 50%
- **0 étoile** : Taux de réussite < 50%

### Calcul du taux de réussite

Le taux de réussite peut être calculé de différentes manières selon le contexte :

1. **Par tentative** : `(réponses correctes / total réponses)`
2. **Par jeu** : `(meilleur score / 100)`
3. **Par catégorie** : `(jeux réussis / total jeux)`

## Mise à jour de la progression

### Après chaque tentative

La progression est mise à jour automatiquement après chaque tentative de jeu :

```mermaid
sequenceDiagram
    participant G as GameComponent
    participant P as ProgressionService
    participant DB as Database
    participant T as Trigger

    G->>DB: Sauvegarde tentative (score, success)
    DB->>T: Trigger après insertion
    T->>T: Calcule nouveau pourcentage
    T->>T: Calcule nouvelles étoiles
    T->>DB: Met à jour frontend_subject_category_progress
    DB-->>G: Progression mise à jour
    G->>P: Récupère progression mise à jour
    P-->>G: Affiche étoiles et pourcentage
```

### Service : ProgressionService

**Localisation** : `projects/frontend/src/app/core/services/progression/progression.service.ts`

**Méthodes principales** :

#### `updateProgress()`

Met à jour la progression d'une sous-catégorie :

```typescript
async updateProgress(
  childId: string,
  subjectCategoryId: string,
  updates: {
    completed?: boolean;
    starsCount?: number;
    completionPercentage?: number;
  }
): Promise<SubjectCategoryProgress>
```

**Logique** :
- Si progression existe → mise à jour
- Si progression n'existe pas → création
- Met à jour `last_played_at` automatiquement

#### `calculateCategoryCompletionPercentage()`

Calcule le pourcentage de complétion d'une sous-catégorie.

#### `calculateStars()`

Calcule les étoiles selon le score et le taux de réussite.

#### `isSubjectCategoryCompleted()`

Détermine si une sous-catégorie est complétée :

```typescript
isSubjectCategoryCompleted(progress: SubjectCategoryProgress): boolean {
  return progress.completed || progress.completion_percentage >= 100;
}
```

## Conditions de complétion

### Sous-catégorie complétée

Une sous-catégorie est considérée **complétée** si :
- `completed = true` OU
- `completion_percentage >= 100`

**Déblocage automatique** :
- Lorsque `completion_percentage` atteint 100%, `completed` peut être mis à `true` automatiquement
- Débloque les collectibles liés à la sous-catégorie
- Débloque le badge "Première catégorie complétée" (si première)

### Matière complétée

Une matière est considérée **complétée** si :
- Toutes les sous-catégories de la matière sont complétées (100%)
- La matière doit avoir au moins une sous-catégorie

**Déblocage automatique** :
- Débloque le badge "Première matière complétée" (si première)
- Débloque les jeux bonus liés à la matière

## Déblocage des collectibles

### Condition principale

Les collectibles sont débloqués automatiquement quand :
- Une sous-catégorie est complétée (`completion_percentage >= 100`)

### Structure de condition

Les collectibles ont un champ `unlock_condition_json` (JSONB) :

```json
{
  "type": "complete_subject_category",
  "subject_category_id": "uuid"
}
```

**Types de conditions** :
- `complete_subject_category` : Compléter une sous-catégorie spécifique
- `complete_subject` : Compléter une matière entière
- `earn_stars` : Obtenir un nombre d'étoiles total
- `play_games` : Jouer un nombre de jeux

## Déblocage des jeux bonus

### Condition principale

Les jeux bonus sont débloqués automatiquement quand :
- Toutes les sous-catégories d'une matière sont complétées

### Structure de condition

```json
{
  "type": "complete_subject",
  "subject_id": "uuid"
}
```

**Vérification** :
1. Récupérer toutes les sous-catégories de la matière
2. Vérifier que toutes ont `completion_percentage >= 100`
3. Si oui → débloquer le jeu bonus

## Affichage de la progression

### Composant : SubjectProgress

**Localisation** : `projects/frontend/src/app/shared/components/subject-progress/subject-progress.component.ts`

**Fonctionnalités** :
- Affichage des étoiles (0-3)
- Affichage du pourcentage de complétion
- Barre de progression visuelle
- Indicateur de complétion

### Composant : ProgressBar

**Localisation** : `projects/frontend/src/app/shared/components/progress-bar/progress-bar.component.ts`

**Fonctionnalités** :
- Barre de progression animée
- Affichage du pourcentage
- Couleurs selon le pourcentage (rouge < 50%, orange 50-80%, vert > 80%)

## Statistiques de progression

### Score total

Le score total est le nombre de jeux uniques réussis (meilleur score = 100%) :

```typescript
async calculateTotalScore(childId: string): Promise<number> {
  // Récupérer toutes les tentatives
  const { data: attempts } = await supabase
    .from('frontend_game_attempts')
    .select('game_id, score')
    .eq('child_id', childId);

  // Calculer le meilleur score pour chaque jeu
  const gameBestScores = new Map<string, number>();
  attempts?.forEach(attempt => {
    const currentBest = gameBestScores.get(attempt.game_id) || 0;
    if (attempt.score > currentBest) {
      gameBestScores.set(attempt.game_id, attempt.score);
    }
  });

  // Compter les jeux réussis (meilleur score = 100%)
  return Array.from(gameBestScores.values())
    .filter(score => score === 100).length;
}
```

### Jeux non réussis

Récupère les jeux échoués pour répétition intelligente :

```typescript
async getFailedGames(
  childId: string,
  subjectCategoryId: string
): Promise<string[]> {
  // Récupérer les tentatives échouées
  const { data: attempts } = await supabase
    .from('frontend_game_attempts')
    .select('game_id')
    .eq('child_id', childId)
    .eq('success', false)
    .order('completed_at', { ascending: false });

  // Filtrer par sous-catégorie
  const gameIds = attempts?.map(a => a.game_id) || [];
  const { data: games } = await supabase
    .from('games')
    .select('id')
    .eq('subject_category_id', subjectCategoryId);

  const categoryGameIds = games?.map(g => g.id) || [];
  return gameIds.filter(id => categoryGameIds.includes(id));
}
```

## Mise à jour automatique

### Triggers PostgreSQL

Les triggers PostgreSQL peuvent mettre à jour automatiquement la progression après chaque tentative :

```sql
-- Exemple de trigger (simplifié)
CREATE OR REPLACE FUNCTION update_progress_after_attempt()
RETURNS TRIGGER AS $$
DECLARE
  v_category_id UUID;
  v_completion_percentage INT;
BEGIN
  -- Récupérer la catégorie du jeu
  SELECT subject_category_id INTO v_category_id
  FROM games WHERE id = NEW.game_id;

  IF v_category_id IS NOT NULL THEN
    -- Calculer le nouveau pourcentage
    v_completion_percentage := calculate_completion_percentage(
      NEW.child_id,
      v_category_id
    );

    -- Mettre à jour la progression
    INSERT INTO frontend_subject_category_progress (
      child_id,
      subject_category_id,
      completion_percentage,
      last_played_at
    )
    VALUES (
      NEW.child_id,
      v_category_id,
      v_completion_percentage,
      NOW()
    )
    ON CONFLICT (child_id, subject_category_id)
    DO UPDATE SET
      completion_percentage = v_completion_percentage,
      last_played_at = NOW(),
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_progress
AFTER INSERT ON frontend_game_attempts
FOR EACH ROW
EXECUTE FUNCTION update_progress_after_attempt();
```

## Bonnes pratiques

1. **Calculer après chaque tentative** : Mettre à jour la progression immédiatement
2. **Utiliser le meilleur score** : Un jeu est "réussi" si son meilleur score = 100%
3. **Arrondir le pourcentage** : Utiliser `Math.round()` pour éviter les décimales
4. **Gérer les cas limites** : Si `totalGames = 0`, retourner 0%
5. **Optimiser les requêtes** : Utiliser des index sur `child_id` et `subject_category_id`
6. **Cache** : Mettre en cache la progression pour éviter les recalculs fréquents

## Exemples de calcul

### Exemple 1 : Sous-catégorie avec 5 jeux

- Jeu 1 : Meilleur score = 100% ✅
- Jeu 2 : Meilleur score = 80% ❌
- Jeu 3 : Meilleur score = 100% ✅
- Jeu 4 : Meilleur score = 100% ✅
- Jeu 5 : Pas encore joué ❌

**Résultat** :
- Jeux réussis : 3
- Total jeux : 5
- Pourcentage : `(3 / 5) × 100 = 60%`
- Étoiles : 1 (passable, 60% ≥ 50%)

### Exemple 2 : Sous-catégorie complétée

- Jeu 1 : Meilleur score = 100% ✅
- Jeu 2 : Meilleur score = 100% ✅
- Jeu 3 : Meilleur score = 100% ✅

**Résultat** :
- Jeux réussis : 3
- Total jeux : 3
- Pourcentage : `(3 / 3) × 100 = 100%`
- Étoiles : 3 (parfait)
- Complétion : `completed = true` OU `completion_percentage >= 100`
- Déblocage : Collectibles et badges associés
