# Vocabulaire métier et domaines

## Acteurs principaux

### Enfant (Child)

**Définition** : Utilisateur principal de l'application frontend. Un enfant est lié à un parent et utilise l'interface ludique pour jouer à des jeux éducatifs.

**Caractéristiques** :
- Authentification simplifiée : `firstname` + `login_pin` (4 chiffres)
- Avatar généré via DiceBear (fun-emoji ou bottts)
- Niveau scolaire (M1-M3, P1-P6, S1-S6, Autre)
- École d'appartenance
- Statut actif/inactif

**Relations** :
- Appartient à un **Parent** (via `parent_id`)
- Inscrit dans une **École** (via `school_id`)
- A des **Inscriptions** aux matières et sous-catégories
- A une **Progression** par sous-catégorie
- A des **Tentatives** de jeux
- A une **Mascotte** avec niveau et XP
- A des **Badges** débloqués
- A des **Collectibles** débloqués

### Parent

**Définition** : Utilisateur admin qui gère les profils de ses enfants. Le parent peut activer/désactiver des matières et sous-catégories pour chaque enfant.

**Caractéristiques** :
- Authentification Supabase (email/password)
- Peut avoir plusieurs enfants
- Gère les inscriptions aux matières
- Accès aux statistiques de progression

**Relations** :
- A un **Profil** (via `profile_id`)
- A plusieurs **Enfants** (1:N)
- Peut être aussi **Professeur** (rôle multiple)

### Professeur (Teacher)

**Définition** : Utilisateur admin qui crée et gère des jeux éducatifs, matières, sous-catégories. Le professeur est affecté à des classes et niveaux scolaires.

**Caractéristiques** :
- Authentification Supabase (email/password)
- Crée des jeux pour ses matières
- Gère les affectations (matière, classe, niveau)
- Peut partager ses coordonnées avec les parents

**Relations** :
- A un **Profil** (via `profile_id`)
- A des **Affectations** (matière, classe, école, niveau)
- Crée des **Jeux** pour ses matières
- Crée des **Questions** réutilisables
- Peut être aussi **Parent** (rôle multiple)

### Administrateur

**Définition** : Utilisateur avec accès complet à la plateforme. Peut gérer tous les utilisateurs, écoles, matières, etc.

**Caractéristiques** :
- Authentification Supabase
- Rôle spécial dans le système
- Accès complet sans restrictions RLS

## Entités pédagogiques

### Matière (Subject)

**Définition** : Domaine d'apprentissage (ex: Mathématiques, Français, Musique, Sport).

**Types** :
- `scolaire` : Matière scolaire obligatoire
- `extra` : Matière extra-scolaire
- `optionnelle` : Matière optionnelle

**Caractéristiques** :
- Peut avoir des **Sous-catégories**
- Peut avoir des **Jeux** directement liés (sans sous-catégorie)
- Peut être liée à des **Niveaux scolaires** par école

**Relations** :
- A des **Sous-catégories** (1:N)
- A des **Jeux** (1:N)
- A des **Inscriptions** d'enfants (1:N via `child_subject_enrollments`)
- Liée à des **Niveaux scolaires** par école (via `school_level_subjects`)

### Sous-catégorie (Subject Category)

**Définition** : Subdivision d'une matière pour une granularité plus fine (ex: Mathématiques → Addition, Soustraction, Multiplication).

**Caractéristiques** :
- Appartient à une **Matière** unique
- Peut avoir des **Jeux** liés
- Permet de suivre la **Progression** par sous-catégorie
- Peut avoir des **Collectibles** associés

**Relations** :
- Appartient à une **Matière** (N:1)
- A des **Jeux** (1:N)
- A une **Progression** par enfant (1:N via `frontend_subject_category_progress`)
- A des **Inscriptions** d'enfants (1:N via `child_subject_category_enrollments`)
- Peut avoir des **Collectibles** (1:N)

### Jeu (Game)

**Définition** : Jeu éducatif créé par un professeur. Un jeu doit être lié soit à une matière soit à une sous-catégorie (pas les deux, pas aucun).

**Types de jeux** :
- **QCM** : Questions à choix multiples
- **Memory** : Jeu de mémoire (paires)
- **Puzzle** : Puzzle à reconstituer
- **Chronologie** : Remettre les événements dans l'ordre
- **Vrai/Faux** : Questions vrai ou faux
- Et autres types personnalisables

**Caractéristiques** :
- Doit avoir un **Type de jeu** (obligatoire)
- Lié à une **Matière** OU une **Sous-catégorie** (contrainte exclusive)
- Stocke les données dans `reponses` (JSONB) selon le type
- Peut avoir des **Aides** (textes, images, vidéos)
- Peut avoir des **Variantes** de difficulté (1-5)

**Relations** :
- A un **Type de jeu** (N:1)
- Lié à une **Matière** OU **Sous-catégorie** (N:1, optionnel)
- A des **Tentatives** d'enfants (1:N)
- Peut avoir des **Variantes** de difficulté (1:N)

### Type de jeu (Game Type)

**Définition** : Catégorie de jeu (QCM, Memory, Puzzle, etc.). Chaque type a une icône et une couleur associée.

**Caractéristiques** :
- Nom unique
- Icône pour l'affichage
- Code couleur pour le style
- Métadonnées JSONB pour configuration

**Relations** :
- A des **Jeux** de ce type (1:N)

### Question

**Définition** : Question réutilisable créée par un professeur. Peut être utilisée dans plusieurs jeux.

**Types de questions** :
- `qcm` : Question à choix multiples
- `vrai_faux` : Question vrai ou faux
- `texte` : Question à réponse texte
- `numerique` : Question à réponse numérique

**Caractéristiques** :
- Appartient à une **Matière**
- Peut être liée à un **Professeur** (créateur)
- Stocke les options dans `options` (JSONB)
- Stocke la réponse correcte dans `answer_key` (JSONB)
- Niveau de difficulté (facile, moyen, difficile)

**Relations** :
- Appartient à une **Matière** (N:1)
- Peut être créée par un **Professeur** (N:1, optionnel)

## Entités de progression

### Tentative (Game Attempt)

**Définition** : Enregistrement d'une tentative de jeu par un enfant. Contient le score, la durée, les réponses et le succès.

**Caractéristiques** :
- Score (0-100) : Pourcentage de réussite
- Durée en millisecondes
- Réponses stockées dans `responses_json` (JSONB)
- Niveau de difficulté utilisé
- Dates de début et fin

**Utilisation** :
- Calcul de la progression par sous-catégorie
- Statistiques de l'enfant
- Adaptation de la difficulté
- Détermination si un jeu est "réussi" (score = 100%)

**Relations** :
- Appartient à un **Enfant** (N:1)
- Appartient à un **Jeu** (N:1)

### Progression (Subject Category Progress)

**Définition** : Suivi de la progression d'un enfant pour chaque sous-catégorie avec étoiles, pourcentage de complétion et statut.

**Caractéristiques** :
- **Étoiles** (0-3) : Selon les performances
  - 3 étoiles : Parfait
  - 2 étoiles : Bien
  - 1 étoile : Passable
  - 0 étoile : À refaire
- **Pourcentage de complétion** (0-100) : Calculé comme (jeux réussis / total jeux) × 100
- **Complétion** : `true` si complétée (100% ou `completed=true`)
- Date de dernier jeu

**Calcul** :
- Mis à jour automatiquement après chaque tentative
- Jeu "réussi" = meilleur score = 100%
- Pourcentage = (jeux réussis / total jeux dans la catégorie) × 100

**Relations** :
- Appartient à un **Enfant** (N:1)
- Appartient à une **Sous-catégorie** (N:1)

### Variante de jeu (Game Variant)

**Définition** : Variante d'un même jeu avec différents niveaux de difficulté (1-5).

**Caractéristiques** :
- Niveau de difficulté (1 = facile, 5 = très difficile)
- Données spécifiques dans `variant_data_json` (JSONB)
- Peut être activée/désactivée

**Utilisation** :
- Adaptation de la difficulté selon le niveau de l'enfant
- Progression graduelle de la difficulté

**Relations** :
- Appartient à un **Jeu** (N:1)

## Entités de gamification

### Badge

**Définition** : Récompense débloquée selon des conditions spécifiques. Un même badge peut être débloqué plusieurs fois à différents niveaux.

**Types de badges** :
- `first_category_complete` : Première catégorie complétée
- `first_subject_complete` : Première matière complétée
- `first_game_perfect` : Premier jeu parfait du 1er coup
- `daily_streak_responses` : Réponses quotidiennes (5+ ou 7+)
- `consecutive_correct` : Réponses consécutives correctes (5 ou 7)
- `perfect_games_count` : Jeux parfaits cumulatifs (10 ou 13)

**Caractéristiques** :
- Nom et description
- Icône et couleur
- Type unique
- Peut être activé/désactivé

**Système de niveaux** :
- Un badge peut être débloqué plusieurs fois (une fois par niveau)
- Seuils dynamiques : `base × 1.3^(niveau-1)`
- Progression de 30% par niveau

**Relations** :
- A des **Déblocages** par enfant (1:N via `frontend_child_badges`)
- A des **Niveaux de progression** par enfant (1:N via `frontend_badge_levels`)

### Collectible

**Définition** : Objet collectionnable débloqué en complétant des sous-catégories ou en atteignant certains objectifs.

**Caractéristiques** :
- Nom et description
- Image URL
- Peut être lié à une **Sous-catégorie** spécifique
- Conditions de déblocage dans `unlock_condition_json` (JSONB)
- Ordre d'affichage

**Conditions principales** :
- Compléter une sous-catégorie (`complete_subject_category`)

**Relations** :
- Peut être lié à une **Sous-catégorie** (N:1, optionnel)
- A des **Déblocages** par enfant (1:N via `frontend_child_collectibles`)

### Jeu bonus (Bonus Game)

**Définition** : Mini-jeu récompense débloqué en complétant une matière entière (toutes les sous-catégories).

**Caractéristiques** :
- Nom et description
- Données du jeu dans `game_data_json` (JSONB)
- Peut être lié à une **Matière** spécifique
- Conditions de déblocage dans `unlock_condition_json` (JSONB)
- Peut être joué plusieurs fois (compteur `played_count`)

**Conditions principales** :
- Compléter toutes les sous-catégories d'une matière (`complete_subject`)

**Relations** :
- Peut être lié à une **Matière** (N:1, optionnel)
- A des **Déblocages** par enfant (1:N via `frontend_child_bonus_game_unlocks`)

### Mascotte

**Définition** : Avatar qui évolue selon les performances de l'enfant. La mascotte a un niveau, de l'XP et des stades d'évolution.

**Caractéristiques** :
- **Niveau** : Calculé automatiquement selon l'XP
  - Formule : `floor(sqrt(xp / 100)) + 1`
- **XP** : Points d'expérience gagnés après chaque jeu réussi
  - Base : 10 points
  - Bonus : jusqu'à 20 points selon le score
  - Total : 10-30 points par jeu réussi
- **Stades d'évolution** (1-5) :
  - Stade 1 : Niveau 1-4
  - Stade 2 : Niveau 5-9
  - Stade 3 : Niveau 10-14
  - Stade 4 : Niveau 15-19
  - Stade 5 : Niveau 20+
- **Apparence** : Stockée dans `current_appearance_json` (JSONB)

**Relations** :
- 1:1 avec un **Enfant** (via `child_id`, UNIQUE)

### Thème

**Définition** : Thème visuel personnalisable que les enfants peuvent débloquer et sélectionner.

**Caractéristiques** :
- Nom
- Configuration des formes et couleurs dans `shapes_colors_json` (JSONB)
- Filtrage par niveau scolaire (`school_level_min`, `school_level_max`)
- Conditions de déblocage dans `unlock_condition_json` (JSONB)
- Thèmes par défaut (`is_default=true`) toujours disponibles
- Ordre d'affichage

**Conditions de déblocage** :
- Basées sur le nombre total d'étoiles obtenues (`by_level` avec `min_stars`)

**Relations** :
- A des **Déblocages** par enfant (1:N via `frontend_child_themes`)

## Entités organisationnelles

### École (School)

**Définition** : Établissement scolaire où sont inscrits les enfants et où enseignent les professeurs.

**Caractéristiques** :
- Nom
- Adresse, ville, pays
- Métadonnées JSONB

**Relations** :
- A des **Enfants** inscrits (1:N)
- A des **Années scolaires** (1:N)
- A des **Affectations** de professeurs (1:N)
- A des **Matières par niveau** (1:N via `school_level_subjects`)

### Année scolaire (School Year)

**Définition** : Année scolaire (ex: "2023-2024", "2024-2025") pour organiser les classes et inscriptions.

**Caractéristiques** :
- Libellé (ex: "2023-2024")
- Ordre d'affichage
- Statut actif/inactif

**Relations** :
- Appartient à une **École** (N:1)
- A des **Classes** (1:N)
- A des **Affectations** de professeurs (1:N)
- A des **Inscriptions** d'enfants (1:N)

### Classe

**Définition** : Classe d'élèves au sein d'une école et d'une année scolaire.

**Caractéristiques** :
- Libellé (ex: "4A")
- Capacité maximale
- Métadonnées JSONB

**Relations** :
- Appartient à une **École** (N:1)
- Appartient à une **Année scolaire** (N:1)
- A des **Affectations** de professeurs (1:N)

### Affectation (Teacher Assignment)

**Définition** : Lien entre un professeur et une matière/classe/école/niveau scolaire. Détermine quels jeux sont visibles pour un professeur.

**Caractéristiques** :
- Rôles du professeur (tableau : titulaire, remplaçant, etc.)
- Niveau scolaire (M1-M3, P1-P6, S1-S6, Autre)
- Dates de début et fin
- Soft delete (`deleted_at`) pour conserver l'historique

**Règles importantes** :
- Un professeur peut avoir plusieurs affectations pour la même matière mais avec des niveaux différents
- Les jeux ne sont visibles que si la matière a au moins une affectation active (`deleted_at IS NULL`)
- Les affectations supprimées peuvent être réactivées

**Relations** :
- Appartient à un **Professeur** (N:1)
- Appartient à une **École** (N:1)
- Appartient à une **Année scolaire** (N:1)
- Appartient à une **Classe** (N:1, optionnel)
- Appartient à une **Matière** (N:1)

## Inscriptions

### Inscription matière (Child Subject Enrollment)

**Définition** : Lien entre un enfant et une matière, déterminant si la matière est activée (`selected=true`) pour l'enfant.

**Caractéristiques** :
- `selected` : `true` si la matière est visible dans l'interface frontend
- Liée à une école et une année scolaire

**Règles** :
- Les inscriptions sont créées automatiquement pour les matières obligatoires du niveau scolaire
- Le parent peut activer/désactiver les matières

**Relations** :
- Appartient à un **Enfant** (N:1)
- Appartient à une **École** (N:1)
- Appartient à une **Année scolaire** (N:1)
- Appartient à une **Matière** (N:1)

### Inscription sous-catégorie (Child Subject Category Enrollment)

**Définition** : Lien entre un enfant et une sous-catégorie, déterminant si la sous-catégorie est activée (`selected=true`) pour l'enfant.

**Caractéristiques** :
- `selected` : `true` si la sous-catégorie est visible dans l'interface frontend
- Permet un contrôle fin de la progression par sous-catégorie

**Relations** :
- Appartient à un **Enfant** (N:1)
- Appartient à une **Sous-catégorie** (N:1)

## Règles métier importantes

### Progression

1. **Calcul des étoiles** :
   - Basé sur le score et le taux de réussite
   - 3 étoiles = parfait (score = 100%)
   - 2 étoiles = bien (score >= 80%)
   - 1 étoile = passable (score >= 60%)
   - 0 étoile = à refaire (score < 60%)

2. **Calcul du pourcentage** :
   - `(jeux réussis / total jeux) × 100`
   - Jeu "réussi" = meilleur score = 100%

3. **Complétion** :
   - Une sous-catégorie est complétée si `completed=true` OU `completion_percentage >= 100`

### Badges

1. **Déblocage automatique** : Via triggers PostgreSQL après chaque action pertinente
2. **Système de niveaux** : Seuils dynamiques avec progression de 30% par niveau
3. **Déblocage multiple** : Un même badge peut être débloqué plusieurs fois (une fois par niveau)

### Gamification

1. **XP et niveau** :
   - Gain d'XP : 10-30 points par jeu réussi
   - Calcul du niveau : `floor(sqrt(xp / 100)) + 1`
   - Stades d'évolution selon le niveau

2. **Streaks** :
   - Séries de réponses correctes consécutives
   - Réinitialisation en cas d'erreur
   - Déblocage de badges à 5 et 7 consécutives

3. **Réponses quotidiennes** :
   - Compteur par jour
   - Déblocage de badges quotidiens (5+ ou 7+ réponses/jour)
   - Récurrent (peut être débloqué plusieurs fois)

### Jeux

1. **Visibilité** :
   - Un jeu n'est visible que si la matière a au moins une affectation active
   - Filtrage automatique via RLS selon les permissions

2. **Variantes de difficulté** :
   - Adaptation selon les performances de l'enfant
   - Niveaux de 1 (facile) à 5 (très difficile)

3. **Aides pédagogiques** :
   - Textes d'aide (`aides` : tableau de phrases)
   - Image d'aide (`aide_image_url`)
   - Vidéo d'aide (`aide_video_url`)

## Vocabulaire technique

### RLS (Row-Level Security)

Politiques de sécurité au niveau base de données qui filtrent automatiquement les données selon l'utilisateur connecté.

### Soft Delete

Suppression logique (via `deleted_at`) plutôt que suppression physique, permettant de conserver l'historique.

### JSONB

Type de données PostgreSQL pour stocker des structures JSON flexibles. Utilisé pour :
- Métadonnées (`metadata`)
- Réponses de jeux (`reponses`, `responses_json`)
- Conditions de déblocage (`unlock_condition_json`)
- Données de variantes (`variant_data_json`)

### JWT (JSON Web Token)

Token d'authentification utilisé pour :
- Frontend : JWT local généré après connexion enfant
- Admin : JWT Supabase après authentification

### Edge Functions

Fonctions serverless Supabase pour :
- Authentification enfant personnalisée (`auth-login-child`)
- Proxy API externe (`deepseek-proxy`)
