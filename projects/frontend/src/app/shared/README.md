# Shared - Composants et Utilitaires Réutilisables

## Vue d'ensemble

Le dossier `shared/` contient tous les composants, animations et utilitaires réutilisables dans toute l'application frontend. Ces éléments peuvent être utilisés par n'importe quelle feature.

## Structure

```
shared/
├── components/                    # Composants réutilisables
│   ├── app-layout/               # Layout principal
│   ├── badge-visual/             # Affichage de badges
│   ├── badge-notification-modal/ # Modal de notification
│   ├── badge-level-indicator/    # Indicateur de niveau
│   ├── mascot/                   # Composant mascotte
│   ├── progress-bar/             # Barre de progression
│   ├── star-rating/              # Affichage d'étoiles
│   ├── subject-progress/         # Progression par matière
│   ├── child-button/             # Bouton style enfant
│   ├── breadcrumb/               # Fil d'Ariane
│   ├── completion-modal/         # Modal de complétion
│   └── game-error-modal/         # Modal d'erreur de jeu
├── animations/                    # Animations Angular
│   └── child-animations.ts       # Animations pour enfants
└── utils/                        # Utilitaires
    ├── array.util.ts             # Opérations sur tableaux
    └── game-normalization.util.ts # Normalisation des jeux
```

## Composants réutilisables

### AppLayout

**Localisation** : `components/app-layout/app-layout.component.ts`

**Rôle** : Layout principal de l'application avec navigation.

**Fonctionnalités** :
- Header avec navigation
- Sidebar (optionnel)
- Zone de contenu principal
- Footer (optionnel)

**Utilisation** :
```typescript
// Dans app.routes.ts
{
  path: '',
  loadComponent: () => import('./shared/components/app-layout/app-layout.component'),
  canActivate: [childAuthGuard],
  children: [/* routes */]
}
```

### BadgeVisual

**Localisation** : `components/badge-visual/badge-visual.component.ts`

**Rôle** : Affichage visuel d'un badge.

**Inputs** :
- `badgeType: BadgeType` : Type de badge
- `isUnlocked: boolean` : Badge débloqué ou verrouillé
- `level?: number` : Niveau du badge
- `value?: number` : Valeur obtenue
- `size?: 'small' | 'medium' | 'large'` : Taille d'affichage
- `showIcon?: boolean` : Afficher l'icône

**Fonctionnalités** :
- Icône selon le type de badge
- Couleur selon le type
- Affichage du niveau et de la valeur
- Style verrouillé/débloqué

### BadgeNotificationModal

**Localisation** : `components/badge-notification-modal/badge-notification-modal.component.ts`

**Rôle** : Modal avec animation pour afficher les nouveaux badges débloqués.

**Inputs** :
- `badge: BadgeNotificationData` : Données du badge
- `visible: boolean` : Visibilité de la modal

**Outputs** :
- `close: EventEmitter<void>` : Événement de fermeture

**Fonctionnalités** :
- Animation de célébration (confettis)
- Affichage du badge avec icône et couleur
- Message de félicitations
- Son de notification (optionnel)
- Bouton de fermeture

### BadgeLevelIndicator

**Localisation** : `components/badge-level-indicator/badge-level-indicator.component.ts`

**Rôle** : Indicateur visuel du niveau d'un badge.

**Fonctionnalités** :
- Affichage du niveau actuel
- Barre de progression vers le prochain niveau
- Seuil suivant affiché

### Mascot

**Localisation** : `components/mascot/mascot.component.ts`

**Rôle** : Affichage de la mascotte avec niveau et XP.

**Inputs** :
- `mascotState: MascotState` : État de la mascotte
- `showDetails?: boolean` : Afficher les détails (niveau, XP)

**Fonctionnalités** :
- Affichage selon le stade d'évolution
- Animation lors du gain d'XP
- Barre de progression vers le prochain niveau
- Affichage du niveau et de l'XP

### ProgressBar

**Localisation** : `components/progress-bar/progress-bar.component.ts`

**Rôle** : Barre de progression animée.

**Inputs** :
- `percentage: number` : Pourcentage (0-100)
- `showLabel?: boolean` : Afficher le label
- `color?: string` : Couleur personnalisée

**Fonctionnalités** :
- Animation de progression
- Couleurs selon le pourcentage (rouge < 50%, orange 50-80%, vert > 80%)
- Affichage du pourcentage

### StarRating

**Localisation** : `components/star-rating/star-rating.component.ts`

**Rôle** : Affichage d'étoiles (0-3).

**Inputs** :
- `stars: number` : Nombre d'étoiles (0-3)
- `size?: 'small' | 'medium' | 'large'` : Taille des étoiles

**Fonctionnalités** :
- Affichage des étoiles pleines/vides
- Animation lors du changement
- Couleurs selon le nombre d'étoiles

### SubjectProgress

**Localisation** : `components/subject-progress/subject-progress.component.ts`

**Rôle** : Affichage de la progression par sous-catégorie.

**Inputs** :
- `progress: SubjectCategoryProgress` : Progression
- `categoryName?: string` : Nom de la sous-catégorie

**Fonctionnalités** :
- Affichage des étoiles
- Affichage du pourcentage
- Barre de progression
- Indicateur de complétion

### ChildButton

**Localisation** : `components/child-button/child-button.component.ts`

**Rôle** : Bouton avec style adapté aux enfants.

**Fonctionnalités** :
- Style coloré et ludique
- Animations au survol
- Tailles variées
- États (disabled, loading)

### Breadcrumb

**Localisation** : `components/breadcrumb/breadcrumb.component.ts`

**Rôle** : Fil d'Ariane pour la navigation.

**Fonctionnalités** :
- Affichage du chemin de navigation
- Liens cliquables
- Style adapté

### CompletionModal

**Localisation** : `components/completion-modal/completion-modal.component.ts`

**Rôle** : Modal affichée lors de la complétion d'une sous-catégorie.

**Fonctionnalités** :
- Message de félicitations
- Affichage des étoiles obtenues
- Animation de célébration
- Bouton pour continuer

### GameErrorModal

**Localisation** : `components/game-error-modal/game-error-modal.component.ts`

**Rôle** : Modal affichée en cas d'erreur lors du chargement d'un jeu.

**Fonctionnalités** :
- Message d'erreur convivial
- Bouton pour réessayer
- Bouton pour retourner

## Animations

### child-animations.ts

**Localisation** : `animations/child-animations.ts`

**Rôle** : Animations Angular réutilisables pour l'interface enfant.

**Animations disponibles** :
- `fadeIn` : Apparition en fondu
- `slideIn` : Glissement depuis le bas
- `bounce` : Rebond
- `pulse` : Pulsation
- `shake` : Secousse (pour erreurs)

**Utilisation** :
```typescript
import { fadeIn, slideIn } from '@shared/animations/child-animations';

@Component({
  animations: [fadeIn, slideIn],
  // ...
})
```

## Utilitaires

### array.util.ts

**Localisation** : `utils/array.util.ts`

**Fonctions** :

#### `shuffleArray<T>()`

Mélange aléatoirement un tableau (algorithme de Fisher-Yates) :

```typescript
const shuffled = shuffleArray([1, 2, 3, 4, 5]);
// Retourne une nouvelle copie mélangée
```

**Utilisation** : Mélanger les jeux, les questions, les réponses.

### game-normalization.util.ts

**Localisation** : `utils/game-normalization.util.ts`

**Rôle** : Normalisation des jeux depuis la structure de la base de données vers l'interface Game standardisée.

**Fonctions** :

#### `normalizeGameType()`

Normalise un type de jeu pour la comparaison :

```typescript
normalizeGameType('QCM') // → 'qcm'
normalizeGameType('Image Interactive') // → 'image_interactive'
normalizeGameType('Vrai/Faux') // → 'vrai_faux'
```

**Normalisation** :
- Convertit en minuscules
- Remplace les espaces par des underscores
- Remplace les slashes par des underscores
- Normalise les accents (é → e, è → e, etc.)

#### `normalizeGame()`

Normalise un jeu depuis la structure de la base de données :

```typescript
const normalizedGame = normalizeGame(rawGameFromDb);
// Retourne un Game avec game_data_json normalisé
```

**Migration automatique** :
- Si `game_data_json` existe → l'utilise
- Sinon → convertit depuis `metadata` ou `reponses` selon le type

**Types supportés** :
- QCM, Memory, Chronologie, Vrai/Faux, Liens, Case vide, Simon, Puzzle, Image interactive, Réponse libre

**Voir** : [docs/game-types.md](../../../../docs/game-types.md) pour les détails.

## Bonnes pratiques

### Composants

1. **Standalone** : Tous les composants sont standalone
2. **Réutilisables** : Conçus pour être utilisés dans plusieurs features
3. **Inputs/Outputs** : Utiliser `input()` et `output()` (Angular 20)
4. **OnPush** : Utiliser `ChangeDetectionStrategy.OnPush` pour la performance

### Utilitaires

1. **Fonctions pures** : Pas d'effets de bord
2. **Type-safe** : Types TypeScript stricts
3. **Testables** : Facilement testables unitairement
4. **Documentées** : JSDoc pour chaque fonction

### Animations

1. **Performance** : Utiliser `@angular/animations` (optimisé)
2. **Réutilisables** : Définir une fois, utiliser partout
3. **Légères** : Éviter les animations lourdes

## Voir aussi

- [docs/architecture.md](../../../../docs/architecture.md) : Architecture complète
- [docs/game-types.md](../../../../docs/game-types.md) : Types de jeux
- [features/README.md](../features/README.md) : Features utilisant ces composants
