# Documentation du Schéma de Base de Données

## Vue d'ensemble

Cette documentation décrit la structure complète de la base de données de l'application, incluant toutes les tables, leurs relations, contraintes et politiques de sécurité (RLS).

**Note:** Les tables préfixées par `nlapp_` sont exclues de cette documentation car elles appartiennent à une autre application.

---

## Table des matières

1. [Tables Utilisateurs et Profils](#tables-utilisateurs-et-profils)
2. [Tables Écoles et Classes](#tables-écoles-et-classes)
3. [Tables Matières et Catégories](#tables-matières-et-catégories)
4. [Tables Jeux](#tables-jeux)
5. [Tables Frontend](#tables-frontend)
6. [Relations entre Tables](#relations-entre-tables)
7. [Storage Buckets](#storage-buckets)
8. [Politiques RLS](#politiques-rls)

---

## Tables Utilisateurs et Profils

### `profiles`

Table principale des profils utilisateurs, liée à `auth.users` de Supabase.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, FK → `auth.users.id` | Identifiant unique du profil |
| `display_name` | `text` | NULLABLE | Nom d'affichage |
| `avatar_url` | `text` | NULLABLE | URL de l'avatar |
| `roles` | `text[]` | NULLABLE, DEFAULT: `'{}'::text[]` | Tableau des rôles (ex: 'prof', 'parent') |
| `metadata` | `jsonb` | NULLABLE | Métadonnées supplémentaires |
| `created_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de création |
| `updated_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de mise à jour |

**RLS:** Activé

---

### `parents`

Table des parents, liée à `profiles`.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique |
| `profile_id` | `uuid` | UNIQUE, FK → `profiles.id` | Référence au profil |
| `fullname` | `text` | NULLABLE | Nom complet |
| `phone` | `text` | NULLABLE | Téléphone |
| `address` | `text` | NULLABLE | Adresse |
| `city` | `text` | NULLABLE | Ville |
| `country` | `text` | NULLABLE | Pays |
| `preferences` | `jsonb` | NULLABLE, DEFAULT: `'{}'::jsonb` | Préférences utilisateur |
| `avatar_url` | `text` | NULLABLE | URL de l'avatar |
| `created_at` | `timestamptz` | DEFAULT: `now()` | Date de création |
| `updated_at` | `timestamptz` | DEFAULT: `now()` | Date de mise à jour |

**RLS:** Activé

---

### `children`

Table des enfants, liée à `profiles` (parent) et `schools`.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique |
| `parent_id` | `uuid` | FK → `profiles.id` | Référence au parent |
| `firstname` | `text` | NULLABLE | Prénom |
| `lastname` | `text` | NULLABLE | Nom |
| `birthdate` | `date` | NULLABLE | Date de naissance |
| `gender` | `text` | NULLABLE | Genre |
| `school_level` | `text` | NULLABLE, CHECK: `M[1-3]|P[1-6]|S[1-6]|Autre` | Niveau scolaire |
| `notes` | `text` | NULLABLE | Notes |
| `avatar_url` | `text` | NULLABLE | URL de l'avatar |
| `avatar_seed` | `text` | NULLABLE | Seed pour générer l'avatar DiceBear |
| `avatar_style` | `varchar` | NULLABLE, DEFAULT: `'fun-emoji'` | Style d'avatar (fun-emoji ou bottts) |
| `login_pin` | `varchar` | NULLABLE | Code PIN à 4 chiffres pour connexion |
| `school_id` | `uuid` | NULLABLE, FK → `schools.id` | École de l'enfant |
| `is_active` | `boolean` | DEFAULT: `true` | Statut actif |
| `created_at` | `timestamptz` | DEFAULT: `now()` | Date de création |
| `updated_at` | `timestamptz` | DEFAULT: `now()` | Date de mise à jour |

**RLS:** Activé

---

### `teachers`

Table des professeurs, liée à `profiles`.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique |
| `profile_id` | `uuid` | UNIQUE, FK → `profiles.id` | Référence au profil |
| `fullname` | `text` | NULLABLE | Nom complet |
| `bio` | `text` | NULLABLE | Biographie |
| `phone` | `text` | NULLABLE | Téléphone |
| `avatar_url` | `text` | NULLABLE | URL de l'avatar |
| `share_email` | `boolean` | NULLABLE, DEFAULT: `false` | Partage email avec parents |
| `share_phone` | `boolean` | NULLABLE, DEFAULT: `false` | Partage téléphone avec parents |
| `created_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de création |
| `updated_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de mise à jour |

**RLS:** Activé

---

## Tables Écoles et Classes

### `schools`

Table des écoles.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique |
| `name` | `text` | NOT NULL | Nom de l'école |
| `address` | `text` | NULLABLE | Adresse |
| `city` | `text` | NULLABLE | Ville |
| `country` | `text` | NULLABLE | Pays |
| `metadata` | `jsonb` | NULLABLE, DEFAULT: `'{}'::jsonb` | Métadonnées supplémentaires |
| `created_at` | `timestamptz` | DEFAULT: `now()` | Date de création |
| `updated_at` | `timestamptz` | DEFAULT: `now()` | Date de mise à jour |

**RLS:** Activé

---

### `school_years`

Table des années scolaires.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique |
| `school_id` | `uuid` | NULLABLE, FK → `schools.id` | École |
| `label` | `text` | NOT NULL | Libellé de l'année |
| `order_index` | `integer` | NULLABLE | Ordre d'affichage |
| `is_active` | `boolean` | NULLABLE, DEFAULT: `true` | Statut actif |
| `created_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de création |
| `updated_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de mise à jour |

**RLS:** Activé

---

### `classes`

Table des classes.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique |
| `school_id` | `uuid` | NULLABLE, FK → `schools.id` | École |
| `school_year_id` | `uuid` | NULLABLE, FK → `school_years.id` | Année scolaire |
| `label` | `text` | NOT NULL | Libellé de la classe |
| `capacity` | `integer` | NULLABLE | Capacité maximale |
| `metadata` | `jsonb` | NULLABLE | Métadonnées supplémentaires |
| `created_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de création |
| `updated_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de mise à jour |

**RLS:** Activé

---

### `teacher_assignments`

Table des affectations des professeurs.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique |
| `teacher_id` | `uuid` | FK → `teachers.id` | Professeur |
| `school_id` | `uuid` | NULLABLE, FK → `schools.id` | École |
| `school_year_id` | `uuid` | NULLABLE, FK → `school_years.id` | Année scolaire |
| `class_id` | `uuid` | NULLABLE, FK → `classes.id` | Classe |
| `subject_id` | `uuid` | NULLABLE, FK → `subjects.id` | Matière |
| `roles` | `text[]` | NULLABLE, DEFAULT: `ARRAY['titulaire']` | Rôles du professeur |
| `school_level` | `text` | DEFAULT: `''`, CHECK: `M[1-3]|P[1-6]|S[1-6]|Autre` | Niveau scolaire |
| `start_date` | `date` | NULLABLE | Date de début |
| `end_date` | `date` | NULLABLE | Date de fin |
| `deleted_at` | `timestamptz` | NULLABLE | Date de suppression (soft delete) |
| `created_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de création |
| `updated_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de mise à jour |

**RLS:** Activé

---

## Tables Matières et Catégories

### `subjects`

Table des matières.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique |
| `name` | `text` | NOT NULL | Nom de la matière |
| `description` | `text` | NULLABLE | Description |
| `type` | `text` | NULLABLE, CHECK: `scolaire|extra|optionnelle` | Type de matière |
| `default_age_range` | `text` | NULLABLE | Tranche d'âge par défaut |
| `metadata` | `jsonb` | NULLABLE | Métadonnées supplémentaires |
| `created_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de création |
| `updated_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de mise à jour |

**RLS:** Activé

---

### `subject_categories`

Table des catégories de matières (sous-catégories).

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique |
| `subject_id` | `uuid` | NOT NULL, FK → `subjects.id`, UNIQUE(subject_id, name) | Matière parente |
| `name` | `text` | NOT NULL | Nom de la catégorie |
| `description` | `text` | NULLABLE | Description |
| `created_at` | `timestamptz` | DEFAULT: `now()` | Date de création |
| `updated_at` | `timestamptz` | DEFAULT: `now()` | Date de mise à jour |

**RLS:** Activé

**Index:**
- `idx_subject_categories_subject_id` sur `subject_id`

---

### `school_level_subjects`

Table de liaison entre niveaux scolaires et matières.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique |
| `school_id` | `uuid` | NOT NULL, FK → `schools.id` | École |
| `school_level` | `text` | NOT NULL, CHECK: `M[1-3]|P[1-6]|S[1-6]` | Niveau scolaire |
| `subject_id` | `uuid` | NOT NULL, FK → `subjects.id` | Matière |
| `required` | `boolean` | DEFAULT: `true` | Matière obligatoire |
| `created_at` | `timestamptz` | DEFAULT: `now()` | Date de création |

**RLS:** Activé

---

### `child_subject_enrollments`

Table des inscriptions des enfants aux matières.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique |
| `child_id` | `uuid` | NOT NULL, FK → `children.id` | Enfant |
| `school_id` | `uuid` | NOT NULL, FK → `schools.id` | École |
| `school_year_id` | `uuid` | NULLABLE, FK → `school_years.id` | Année scolaire |
| `subject_id` | `uuid` | NOT NULL, FK → `subjects.id` | Matière |
| `selected` | `boolean` | DEFAULT: `true` | Matière sélectionnée |
| `created_at` | `timestamptz` | DEFAULT: `now()` | Date de création |
| `updated_at` | `timestamptz` | DEFAULT: `now()` | Date de mise à jour |

**RLS:** Activé

---

### `child_subject_category_enrollments`

Table des inscriptions des enfants aux catégories de matières.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique |
| `child_id` | `uuid` | NOT NULL, FK → `children.id`, UNIQUE(child_id, subject_category_id) | Enfant |
| `subject_category_id` | `uuid` | NOT NULL, FK → `subject_categories.id` | Catégorie |
| `selected` | `boolean` | DEFAULT: `true` | Catégorie sélectionnée |
| `created_at` | `timestamptz` | DEFAULT: `now()` | Date de création |
| `updated_at` | `timestamptz` | DEFAULT: `now()` | Date de mise à jour |

**RLS:** Activé

**Index:**
- `idx_child_category_enrollments_child_id` sur `child_id`
- `idx_child_category_enrollments_category_id` sur `subject_category_id`

---

## Tables Jeux

### `game_types`

Table des types de jeux.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique |
| `name` | `text` | NOT NULL, UNIQUE | Nom du type de jeu |
| `description` | `text` | NULLABLE | Description |
| `icon` | `text` | NULLABLE | Icône |
| `color_code` | `text` | NULLABLE | Code couleur |
| `metadata` | `jsonb` | NULLABLE | Métadonnées supplémentaires |
| `created_at` | `timestamptz` | DEFAULT: `now()` | Date de création |
| `updated_at` | `timestamptz` | DEFAULT: `now()` | Date de mise à jour |

**RLS:** Activé

---

### `games`

Table principale des jeux.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique |
| `subject_id` | `uuid` | NULLABLE, FK → `subjects.id` | Matière (nullable si subject_category_id) |
| `subject_category_id` | `uuid` | NULLABLE, FK → `subject_categories.id` | Catégorie (nullable si subject_id) |
| `game_type_id` | `uuid` | NOT NULL, FK → `game_types.id` | Type de jeu |
| `name` | `text` | NOT NULL | Nom du jeu |
| `description` | `text` | NULLABLE | Description |
| `instructions` | `text` | NULLABLE | Instructions |
| `question` | `text` | NULLABLE | Question du jeu |
| `reponses` | `jsonb` | NULLABLE | Structure: `{"propositions": string[], "reponse_valide": string}` |
| `aides` | `jsonb` | NULLABLE | Tableau de phrases d'aide: `string[]` |
| `aide_image_url` | `text` | NULLABLE | URL de l'image d'aide |
| `aide_video_url` | `text` | NULLABLE | URL de la vidéo d'aide |
| `metadata` | `jsonb` | NULLABLE | Métadonnées supplémentaires |
| `created_at` | `timestamptz` | DEFAULT: `now()` | Date de création |
| `updated_at` | `timestamptz` | DEFAULT: `now()` | Date de mise à jour |

**RLS:** Activé

**Contraintes:**
- `games_subject_or_category_check`: Un jeu doit avoir soit `subject_id` soit `subject_category_id` (pas les deux, pas aucun)

**Index:**
- `idx_games_subject_category_id` sur `subject_category_id`

---

### `questions`

Table des questions (pour les QCM, vrai/faux, etc.).

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique |
| `subject_id` | `uuid` | NOT NULL, FK → `subjects.id` | Matière |
| `teacher_id` | `uuid` | NULLABLE, FK → `teachers.id` | Professeur créateur |
| `question_type` | `text` | NULLABLE, CHECK: `qcm|vrai_faux|texte|numerique` | Type de question |
| `prompt` | `text` | NOT NULL | Énoncé de la question |
| `options` | `jsonb` | NULLABLE | Options de réponse (structure dépend du type) |
| `answer_key` | `jsonb` | NULLABLE | Clé de réponse |
| `difficulty` | `text` | NULLABLE, CHECK: `facile|moyen|difficile` | Difficulté |
| `metadata` | `jsonb` | NULLABLE | Métadonnées supplémentaires |
| `created_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de création |
| `updated_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de mise à jour |

**RLS:** Activé

---

## Tables Frontend

### `frontend_game_attempts`

Table des tentatives de jeux des enfants.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique |
| `child_id` | `uuid` | NOT NULL, FK → `children.id` | Enfant |
| `game_id` | `uuid` | NOT NULL, FK → `games.id` | Jeu |
| `success` | `boolean` | DEFAULT: `false` | Succès de la tentative |
| `score` | `integer` | DEFAULT: `0` | Score obtenu |
| `duration_ms` | `integer` | NULLABLE | Durée en millisecondes |
| `responses_json` | `jsonb` | NULLABLE | Réponses de l'enfant |
| `difficulty_level` | `integer` | DEFAULT: `1` | Niveau de difficulté |
| `started_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de début |
| `completed_at` | `timestamptz` | NULLABLE | Date de fin |
| `created_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de création |
| `updated_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de mise à jour |

**RLS:** Activé

---

### `frontend_subject_category_progress`

Table de progression des enfants par catégorie de matière.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique |
| `child_id` | `uuid` | NOT NULL, FK → `children.id` | Enfant |
| `subject_category_id` | `uuid` | NOT NULL, FK → `subject_categories.id` | Catégorie |
| `completed` | `boolean` | DEFAULT: `false` | Catégorie complétée |
| `stars_count` | `integer` | DEFAULT: `0`, CHECK: `0-3` | Nombre d'étoiles (0-3) |
| `completion_percentage` | `integer` | DEFAULT: `0`, CHECK: `0-100` | Pourcentage de complétion |
| `last_played_at` | `timestamptz` | NULLABLE | Dernière date de jeu |
| `created_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de création |
| `updated_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de mise à jour |

**RLS:** Activé

---

### `frontend_game_variants`

Table des variantes de jeux (pour différents niveaux de difficulté).

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique |
| `game_id` | `uuid` | NOT NULL, FK → `games.id` | Jeu parent |
| `variant_data_json` | `jsonb` | NOT NULL | Données de la variante |
| `difficulty_level` | `integer` | DEFAULT: `1`, CHECK: `1-5` | Niveau de difficulté (1-5) |
| `is_active` | `boolean` | DEFAULT: `true` | Variante active |
| `created_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de création |
| `updated_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de mise à jour |

**RLS:** Activé

---

### `frontend_collectibles`

Table des objets collectionnables.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique |
| `name` | `text` | NOT NULL | Nom de l'objet |
| `description` | `text` | NULLABLE | Description |
| `image_url` | `text` | NULLABLE | URL de l'image |
| `subject_category_id` | `uuid` | NULLABLE, FK → `subject_categories.id` | Catégorie associée |
| `unlock_condition_json` | `jsonb` | NULLABLE | Conditions de déblocage |
| `display_order` | `integer` | NULLABLE, DEFAULT: `0` | Ordre d'affichage |
| `is_active` | `boolean` | DEFAULT: `true` | Objet actif |
| `created_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de création |
| `updated_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de mise à jour |

**RLS:** Activé

---

### `frontend_child_collectibles`

Table de liaison enfants/objets collectionnables (objets débloqués).

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique |
| `child_id` | `uuid` | NOT NULL, FK → `children.id` | Enfant |
| `collectible_id` | `uuid` | NOT NULL, FK → `frontend_collectibles.id` | Objet collectionnable |
| `unlocked_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de déblocage |
| `created_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de création |

**RLS:** Activé

---

### `frontend_bonus_games`

Table des jeux bonus.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique |
| `name` | `text` | NOT NULL | Nom du jeu |
| `description` | `text` | NULLABLE | Description |
| `subject_id` | `uuid` | NULLABLE, FK → `subjects.id` | Matière associée |
| `unlock_condition_json` | `jsonb` | NOT NULL | Conditions de déblocage |
| `game_data_json` | `jsonb` | NOT NULL | Données du jeu |
| `image_url` | `text` | NULLABLE | URL de l'image |
| `is_active` | `boolean` | DEFAULT: `true` | Jeu actif |
| `created_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de création |
| `updated_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de mise à jour |

**RLS:** Activé

---

### `frontend_child_bonus_game_unlocks`

Table de liaison enfants/jeux bonus (jeux débloqués).

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique |
| `child_id` | `uuid` | NOT NULL, FK → `children.id` | Enfant |
| `bonus_game_id` | `uuid` | NOT NULL, FK → `frontend_bonus_games.id` | Jeu bonus |
| `unlocked_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de déblocage |
| `played_count` | `integer` | DEFAULT: `0` | Nombre de parties jouées |
| `last_played_at` | `timestamptz` | NULLABLE | Dernière date de jeu |
| `created_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de création |
| `updated_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de mise à jour |

**RLS:** Activé

---

### `frontend_themes`

Table des thèmes visuels de l'application.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique |
| `name` | `text` | NOT NULL | Nom du thème |
| `school_level_min` | `integer` | NULLABLE | Niveau scolaire minimum |
| `school_level_max` | `integer` | NULLABLE | Niveau scolaire maximum |
| `shapes_colors_json` | `jsonb` | NOT NULL | Configuration des formes et couleurs |
| `unlock_condition_json` | `jsonb` | NULLABLE | Conditions de déblocage |
| `is_default` | `boolean` | DEFAULT: `false` | Thème par défaut |
| `display_order` | `integer` | NULLABLE, DEFAULT: `0` | Ordre d'affichage |
| `is_active` | `boolean` | DEFAULT: `true` | Thème actif |
| `created_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de création |
| `updated_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de mise à jour |

**RLS:** Activé

---

### `frontend_child_themes`

Table de liaison enfants/thèmes (thèmes débloqués et sélectionnés).

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique |
| `child_id` | `uuid` | NOT NULL, FK → `children.id` | Enfant |
| `theme_id` | `uuid` | NOT NULL, FK → `frontend_themes.id` | Thème |
| `is_selected` | `boolean` | DEFAULT: `false` | Thème sélectionné |
| `unlocked_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de déblocage |
| `created_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de création |
| `updated_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de mise à jour |

**RLS:** Activé

---

### `frontend_child_mascot_state`

Table de l'état de la mascotte de l'enfant (niveau, XP, évolution).

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique |
| `child_id` | `uuid` | NOT NULL, UNIQUE, FK → `children.id` | Enfant |
| `level` | `integer` | DEFAULT: `1`, CHECK: `>= 1` | Niveau de la mascotte |
| `xp` | `integer` | DEFAULT: `0`, CHECK: `>= 0` | Points d'expérience |
| `current_appearance_json` | `jsonb` | NULLABLE | Apparence actuelle (JSON) |
| `evolution_stage` | `integer` | DEFAULT: `1`, CHECK: `1-5` | Stade d'évolution (1-5) |
| `last_xp_gain_at` | `timestamptz` | NULLABLE | Dernière acquisition d'XP |
| `created_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de création |
| `updated_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de mise à jour |

**RLS:** Activé

---

### `frontend_child_checkpoints`

Table des points de sauvegarde pour l'application enfant (sauvegarde hybride: auto + checkpoint).

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique |
| `child_id` | `uuid` | NOT NULL, FK → `children.id` | Enfant |
| `checkpoint_type` | `text` | NOT NULL | Type de checkpoint |
| `checkpoint_data_json` | `jsonb` | NOT NULL | Données du checkpoint |
| `created_at` | `timestamptz` | NULLABLE, DEFAULT: `now()` | Date de création |

**RLS:** Activé

---

## Relations entre Tables

### Hiérarchie Utilisateurs
```
auth.users
  └── profiles (1:1)
      ├── parents (1:1)
      └── teachers (1:1)
          └── children (N:1 via parent_id)
```

### Hiérarchie Écoles
```
schools
  ├── school_years (N:1)
  │   └── classes (N:1)
  ├── children (N:1)
  └── teacher_assignments (N:1)
```

### Hiérarchie Matières
```
subjects
  ├── subject_categories (N:1)
  │   ├── games (N:1)
  │   ├── frontend_collectibles (N:1)
  │   └── frontend_subject_category_progress (N:1)
  ├── games (N:1)
  ├── questions (N:1)
  ├── school_level_subjects (N:1)
  └── child_subject_enrollments (N:1)
```

### Hiérarchie Jeux
```
game_types
  └── games (N:1)
      ├── frontend_game_attempts (N:1)
      └── frontend_game_variants (N:1)
```

### Relations Enfants
```
children
  ├── child_subject_enrollments (1:N)
  ├── child_subject_category_enrollments (1:N)
  ├── frontend_game_attempts (1:N)
  ├── frontend_subject_category_progress (1:N)
  ├── frontend_child_collectibles (1:N)
  ├── frontend_child_bonus_game_unlocks (1:N)
  ├── frontend_child_themes (1:N)
  ├── frontend_child_mascot_state (1:1)
  └── frontend_child_checkpoints (1:N)
```

---

## Storage Buckets

### `game-images`
- **Type:** Public
- **Limite:** 10MB
- **MIME types:** `image/jpeg`, `image/jpg`, `image/png`, `image/webp`, `image/gif`
- **Usage:** Stockage des images de jeux

### `puzzle-images`
- **Type:** Public
- **Limite:** 5MB
- **MIME types:** `image/png`, `image/webp`
- **Usage:** Stockage des images de pièces de puzzle

### `aides-images`
- **Type:** Public
- **Limite:** 10MB
- **MIME types:** `image/jpeg`, `image/jpg`, `image/png`, `image/webp`, `image/gif`
- **Usage:** Stockage des images d'aide pour les jeux

---

## Politiques RLS

### Principes généraux

1. **Professeurs (`prof`):** Accès complet aux tables pédagogiques (subjects, games, questions, etc.)
2. **Parents:** Accès uniquement aux données de leurs enfants
3. **Enfants:** Accès en lecture publique limité pour la connexion (firstname + PIN), puis accès à leurs propres données frontend
4. **Public:** Accès en lecture seule aux tables frontend actives (collectibles, bonus_games, themes)

### Tables avec RLS spécifiques

- **`children`:** Politique publique pour la connexion (lecture seule des enfants actifs avec firstname et login_pin)
- **`frontend_*`:** Politiques permissives pour les enfants (lecture/écriture de leurs propres données)
- **`subject_categories`:** Accès réservé aux professeurs
- **`child_subject_category_enrollments`:** Accès réservé aux parents pour leurs enfants

---

## Notes importantes

1. **Soft Delete:** La table `teacher_assignments` utilise `deleted_at` pour le soft delete
2. **Contraintes CHECK:** Plusieurs tables utilisent des contraintes CHECK pour valider les valeurs (niveaux scolaires, difficultés, etc.)
3. **JSONB:** Plusieurs colonnes utilisent JSONB pour stocker des structures flexibles (metadata, responses_json, etc.)
4. **Triggers:** Des triggers automatiques mettent à jour `updated_at` sur plusieurs tables
5. **Index:** Des index sont créés sur les colonnes fréquemment utilisées pour les jointures

---

## Mises à jour

Cette documentation doit être mise à jour à chaque modification du schéma de base de données. Les migrations SQL se trouvent dans le dossier `supabase/migrations/`.
