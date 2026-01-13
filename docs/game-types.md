# Types de jeux

## Vue d'ensemble

L'application supporte plusieurs types de jeux éducatifs, chacun avec sa propre structure de données stockée dans `game_data_json` (JSONB) ou dans l'ancien format `reponses`/`metadata` (pour compatibilité).

## Types de jeux disponibles

### 1. QCM (Question à Choix Multiples)

**Type normalisé** : `qcm`

**Variations acceptées** : `qcm`, `question à choix multiples`, `choix multiples`

**Structure `game_data_json`** :
```json
{
  "propositions": ["Réponse A", "Réponse B", "Réponse C", "Réponse D"],
  "reponses_valides": ["Réponse A"]  // ou ["Réponse A", "Réponse B"] pour plusieurs bonnes réponses
}
```

**Ancien format (migration depuis `metadata` ou `reponses`)** :
```json
{
  "propositions": ["Réponse A", "Réponse B", "Réponse C", "Réponse D"],
  "reponse_valide": "Réponse A"  // ou "reponses_valides": ["Réponse A"]
}
```

**Logique de validation** :
- L'enfant sélectionne une ou plusieurs propositions
- La réponse est correcte si toutes les sélections correspondent aux `reponses_valides`
- Score : (réponses correctes / total réponses) × 100

**Champs additionnels** :
- `question` : Texte de la question (optionnel)
- `instructions` : Instructions pour l'enfant
- `aides` : Tableau de phrases d'aide
- `aide_image_url` : URL de l'image d'aide
- `aide_video_url` : URL de la vidéo d'aide

### 2. Memory

**Type normalisé** : `memory`

**Variations acceptées** : `memory`, `mémoire`, `paires`

**Structure `game_data_json`** :
```json
{
  "paires": [
    { "question": "2 + 2", "reponse": "4" },
    { "question": "3 + 3", "reponse": "6" },
    { "question": "4 + 4", "reponse": "8" }
  ]
}
```

**Ancien format (migration depuis `metadata.paires`)** :
```json
{
  "paires": [
    { "question": "2 + 2", "reponse": "4" }
  ]
}
```

**Logique de validation** :
- L'enfant doit retrouver les paires en retournant les cartes
- Une paire est correcte si `question` et `reponse` correspondent
- Score : (paires trouvées / total paires) × 100

**Caractéristiques** :
- Les paires sont mélangées aléatoirement
- Interface avec cartes retournables
- Feedback visuel pour les paires correctes/incorrectes

### 3. Chronologie

**Type normalisé** : `chronologie`

**Variations acceptées** : `chronologie`, `ordre chronologique`, `ordre`

**Structure `game_data_json`** :
```json
{
  "mots": ["Événement 1", "Événement 2", "Événement 3", "Événement 4"],
  "ordre_correct": [0, 1, 2, 3]  // Indices dans l'ordre correct
}
```

**Ancien format (migration depuis `metadata`)** :
```json
{
  "mots": ["Événement 1", "Événement 2", "Événement 3"],
  "ordre_correct": [0, 1, 2]
}
```

**Logique de validation** :
- L'enfant doit remettre les événements dans l'ordre chronologique
- La réponse est correcte si l'ordre correspond à `ordre_correct`
- Score : 100% si correct, 0% sinon

**Caractéristiques** :
- Interface drag & drop ou boutons
- Feedback visuel pour l'ordre correct

### 4. Vrai/Faux

**Type normalisé** : `vrai_faux`

**Variations acceptées** : `vrai/faux`, `vrai_faux`, `vrai ou faux`, `true/false`

**Structure `game_data_json`** :
```json
{
  "enonces": [
    { "texte": "2 + 2 = 4", "reponse_correcte": true },
    { "texte": "3 + 3 = 5", "reponse_correcte": false },
    { "texte": "4 + 4 = 8", "reponse_correcte": true }
  ]
}
```

**Ancien format (migration depuis `metadata.enonces`)** :
```json
{
  "enonces": [
    { "texte": "2 + 2 = 4", "reponse_correcte": true }
  ]
}
```

**Logique de validation** :
- L'enfant répond Vrai ou Faux pour chaque énoncé
- Score : (réponses correctes / total énoncés) × 100

**Caractéristiques** :
- Interface simple avec boutons Vrai/Faux
- Feedback immédiat pour chaque énoncé

### 5. Liens

**Type normalisé** : `liens`

**Variations acceptées** : `liens`, `associer`, `relier`

**Structure `game_data_json`** :
```json
{
  "mots": ["Pomme", "Voiture", "Chien"],
  "reponses": ["Fruit", "Véhicule", "Animal"],
  "liens": [
    { "mot_index": 0, "reponse_index": 0 },  // Pomme -> Fruit
    { "mot_index": 1, "reponse_index": 1 },  // Voiture -> Véhicule
    { "mot_index": 2, "reponse_index": 2 }   // Chien -> Animal
  ]
}
```

**Ancien format (migration depuis `metadata`)** :
```json
{
  "mots": ["Pomme", "Voiture"],
  "reponses": ["Fruit", "Véhicule"],
  "liens": [
    { "mot_index": 0, "reponse_index": 0 }
  ]
}
```

**Logique de validation** :
- L'enfant doit relier chaque mot à sa réponse correspondante
- La réponse est correcte si tous les liens correspondent à `liens`
- Score : (liens corrects / total liens) × 100

**Caractéristiques** :
- Interface avec lignes de connexion (drag & drop)
- Feedback visuel pour les liens corrects/incorrects

### 6. Case vide

**Type normalisé** : `case_vide`

**Variations acceptées** : `case vide`, `case_vide`, `texte à trous`, `compléter`

**Structure `game_data_json`** :
```json
{
  "texte": "Le chat mange une ___ dans le jardin.",
  "cases_vides": [
    { "index": 3, "mot_correct": "pomme" }  // index dans le texte
  ],
  "banque_mots": ["pomme", "poire", "banane"],
  "mots_leurres": ["voiture", "chien"]  // Mots incorrects à éviter
}
```

**Ancien format (migration depuis `metadata`)** :
```json
{
  "texte": "Le chat mange une ___ dans le jardin.",
  "cases_vides": [
    { "index": 3, "mot_correct": "pomme" }
  ],
  "banque_mots": ["pomme", "poire"],
  "mots_leurres": ["voiture"]
}
```

**Logique de validation** :
- L'enfant doit compléter les cases vides avec les mots de la banque
- La réponse est correcte si tous les mots correspondent à `cases_vides[].mot_correct`
- Score : (cases correctes / total cases) × 100

**Caractéristiques** :
- Interface avec zones de texte ou sélection depuis banque
- Feedback pour chaque case remplie

### 7. Simon

**Type normalisé** : `simon`

**Variations acceptées** : `simon`, `séquence`, `répéter`

**Structure `game_data_json`** :
```json
{
  "nombre_elements": 4,
  "type_elements": "couleurs",  // ou "nombres", "lettres", "formes"
  "elements": [
    { "valeur": "rouge", "couleur": "#FF0000" },
    { "valeur": "bleu", "couleur": "#0000FF" },
    { "valeur": "vert", "couleur": "#00FF00" },
    { "valeur": "jaune", "couleur": "#FFFF00" }
  ],
  "sequence": [0, 1, 2, 0]  // Indices dans elements
}
```

**Ancien format (migration depuis `metadata`)** :
```json
{
  "nombre_elements": 4,
  "type_elements": "couleurs",
  "elements": [
    { "valeur": "rouge", "couleur": "#FF0000" }
  ]
}
```

**Logique de validation** :
- Le système affiche une séquence (couleurs, nombres, etc.)
- L'enfant doit répéter la séquence dans le même ordre
- Score : 100% si séquence correcte, 0% sinon

**Caractéristiques** :
- Animation de la séquence
- Interface avec boutons pour répéter
- Difficulté progressive (séquence de plus en plus longue)

### 8. Image interactive (Click)

**Type normalisé** : `image_interactive`

**Variations acceptées** : `image interactive`, `click`, `image_interactive`, `cliquer`

**Structure `game_data_json`** :
```json
{
  "image_url": "https://...",
  "image_width": 800,
  "image_height": 600,
  "zones": [
    {
      "id": "zone1",
      "x": 100,
      "y": 200,
      "width": 150,
      "height": 100,
      "correct": true,
      "label": "Zone correcte 1"
    },
    {
      "id": "zone2",
      "x": 300,
      "y": 400,
      "width": 150,
      "height": 100,
      "correct": false,
      "label": "Zone incorrecte"
    }
  ],
  "require_all_correct_zones": true  // Toutes les zones correctes doivent être cliquées
}
```

**Ancien format (migration depuis `metadata`)** :
```json
{
  "image_url": "https://...",
  "image_width": 800,
  "image_height": 600,
  "zones": [
    { "x": 100, "y": 200, "width": 150, "height": 100, "correct": true }
  ]
}
```

**Logique de validation** :
- L'enfant doit cliquer sur les zones correctes de l'image
- Si `require_all_correct_zones = true` : toutes les zones correctes doivent être cliquées
- Si `require_all_correct_zones = false` : au moins une zone correcte doit être cliquée
- Score : (zones correctes cliquées / total zones correctes) × 100

**Caractéristiques** :
- Image interactive avec zones cliquables
- Feedback visuel pour les zones cliquées
- Support de Konva pour le rendu 2D

### 9. Réponse libre

**Type normalisé** : `reponse_libre`

**Variations acceptées** : `réponse libre`, `reponse libre`, `texte libre`, `saisie libre`

**Structure `game_data_json`** :
```json
{
  "reponse_valide": "Paris"  // Réponse exacte attendue (peut être normalisée)
}
```

**Ancien format (migration depuis `metadata.reponse_valide` ou `reponses.reponse_valide`)** :
```json
{
  "reponse_valide": "Paris"
}
```

**Logique de validation** :
- L'enfant saisit une réponse libre dans un champ texte
- La réponse est comparée à `reponse_valide` (normalisation : minuscules, accents, espaces)
- Score : 100% si correct, 0% sinon

**Caractéristiques** :
- Champ de saisie texte
- Normalisation pour tolérer les variations (majuscules, accents, espaces)
- Feedback après validation

### 10. Puzzle

**Type normalisé** : `puzzle`

**Variations acceptées** : `puzzle`, `pièces`, `reconstituer`

**Structure `game_data_json`** :
```json
{
  "image_url": "https://...",  // Image complète du puzzle
  "image_width": 800,
  "image_height": 600,
  "pieces": [
    {
      "id": "piece1",
      "x": 0,      // Position dans l'image originale
      "y": 0,
      "width": 200,
      "height": 200,
      "correct_x": 0,  // Position correcte dans le puzzle
      "correct_y": 0
    },
    {
      "id": "piece2",
      "x": 200,
      "y": 0,
      "width": 200,
      "height": 200,
      "correct_x": 200,
      "correct_y": 0
    }
  ],
  "grid_cols": 4,  // Nombre de colonnes dans la grille
  "grid_rows": 3   // Nombre de lignes dans la grille
}
```

**Logique de validation** :
- L'enfant doit reconstituer le puzzle en plaçant les pièces aux bonnes positions
- Une pièce est correcte si sa position correspond à `correct_x` et `correct_y`
- Score : (pièces correctes / total pièces) × 100

**Caractéristiques** :
- Interface drag & drop avec grille
- Support de Konva pour le rendu 2D
- Images stockées dans le bucket `puzzle-images`

## Structure générale d'un jeu

### Champs de la table `games`

```typescript
interface Game {
  id: string;
  name: string;
  description?: string;
  subject_id?: string;           // Matière (optionnel si subject_category_id)
  subject_category_id?: string;   // Sous-catégorie (optionnel si subject_id)
  game_type_id: string;           // Type de jeu (obligatoire)
  game_type?: string;             // Nom du type (depuis game_types)
  
  // Données du jeu (nouveau format)
  game_data_json?: Record<string, unknown>;  // Structure selon le type
  
  // Anciens champs (compatibilité)
  question?: string;              // Question du jeu
  reponses?: Record<string, unknown>;  // Ancien format JSONB
  metadata?: Record<string, unknown>;  // Métadonnées (ancien format)
  
  // Aides pédagogiques
  instructions?: string;         // Instructions pour l'enfant
  aides?: string[];              // Tableau de phrases d'aide
  aide_image_url?: string;        // URL de l'image d'aide
  aide_video_url?: string;        // URL de la vidéo d'aide
  
  // Métadonnées
  image_url?: string;            // Image du jeu
  created_at: string;
  updated_at: string;
}
```

## Migration depuis l'ancien format

Le système normalise automatiquement les jeux depuis l'ancien format (`metadata`, `reponses`) vers le nouveau format (`game_data_json`). Voir `projects/frontend/src/app/shared/utils/game-normalization.util.ts`.

**Priorité** :
1. Si `game_data_json` existe et n'est pas vide → utiliser `game_data_json`
2. Sinon → convertir depuis `metadata` ou `reponses` selon le type de jeu

## Variantes de difficulté

Les jeux peuvent avoir des variantes avec différents niveaux de difficulté (1-5) stockées dans `frontend_game_variants` :

```typescript
interface GameVariant {
  id: string;
  game_id: string;
  variant_data_json: Record<string, unknown>;  // Structure selon le type
  difficulty_level: number;  // 1 (facile) à 5 (très difficile)
  is_active: boolean;
}
```

**Utilisation** :
- Si une variante existe pour le niveau de difficulté de l'enfant → utiliser `variant_data_json`
- Sinon → utiliser `game_data_json` du jeu principal

## Validation des réponses

### Structure d'une tentative

```typescript
interface GameAttempt {
  id: string;
  child_id: string;
  game_id: string;
  success: boolean;              // score === 100
  score: number;                 // 0-100
  duration_ms: number;           // Durée en millisecondes
  responses_json: Record<string, unknown>;  // Réponses de l'enfant
  difficulty_level: number;      // Niveau de difficulté utilisé
  started_at: string;
  completed_at: string;
}
```

### Calcul du score

Le score est calculé selon le type de jeu :
- **QCM** : (réponses correctes / total réponses) × 100
- **Memory** : (paires trouvées / total paires) × 100
- **Chronologie** : 100% si ordre correct, 0% sinon
- **Vrai/Faux** : (énoncés corrects / total énoncés) × 100
- **Liens** : (liens corrects / total liens) × 100
- **Case vide** : (cases correctes / total cases) × 100
- **Simon** : 100% si séquence correcte, 0% sinon
- **Image interactive** : (zones correctes cliquées / total zones correctes) × 100
- **Réponse libre** : 100% si réponse correcte, 0% sinon
- **Puzzle** : (pièces correctes / total pièces) × 100

## Bonnes pratiques

1. **Utiliser `game_data_json`** pour les nouveaux jeux (format standardisé)
2. **Respecter la structure** selon le type de jeu
3. **Valider les données** avant de sauvegarder
4. **Gérer les variantes** pour différents niveaux de difficulté
5. **Normaliser les réponses** (minuscules, accents, espaces) pour la comparaison
6. **Stocker les images** dans les buckets Supabase appropriés
