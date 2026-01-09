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
6. [Tables Badges - Système de gamification](#tables-badges---système-de-gamification)
7. [Relations entre Tables](#relations-entre-tables)
8. [Storage Buckets](#storage-buckets)
9. [Politiques RLS](#politiques-rls)

---

## Tables Utilisateurs et Profils

### `profiles`

**Description :** Table principale des profils utilisateurs, liée à `auth.users` de Supabase. Cette table sert de point central pour tous les utilisateurs de l'application (parents, professeurs, administrateurs). Elle stocke les informations de base communes à tous les utilisateurs et gère les rôles multiples via un tableau de rôles.

**Rôle métier :**

- Centralise les informations de profil de tous les utilisateurs authentifiés
- Gère le système de rôles multiples (un utilisateur peut être à la fois parent et professeur)
- Stocke les métadonnées utilisateur et les préférences d'affichage

**Utilisation :**

- **Admin/Frontend :** Utilisée par `AuthService` et `ProfileService` pour récupérer et mettre à jour les profils utilisateurs
- **Authentification :** Liée à `auth.users` via trigger automatique lors de l'inscription
- **Gestion des rôles :** Le champ `roles` (tableau) permet de gérer plusieurs rôles par utilisateur (ex: `['parent', 'prof']`)

**Relations clés :**

- 1:1 avec `parents` (via `profile_id`)
- 1:1 avec `teachers` (via `profile_id`)
- 1:N avec `children` (via `parent_id` qui référence `profiles.id`)

| Colonne        | Type          | Contraintes                       | Description                              |
| -------------- | ------------- | --------------------------------- | ---------------------------------------- |
| `id`           | `uuid`        | PRIMARY KEY, FK → `auth.users.id` | Identifiant unique du profil             |
| `display_name` | `text`        | NULLABLE                          | Nom d'affichage                          |
| `avatar_url`   | `text`        | NULLABLE                          | URL de l'avatar                          |
| `roles`        | `text[]`      | NULLABLE, DEFAULT: `'{}'::text[]` | Tableau des rôles (ex: 'prof', 'parent') |
| `metadata`     | `jsonb`       | NULLABLE                          | Métadonnées supplémentaires              |
| `created_at`   | `timestamptz` | NULLABLE, DEFAULT: `now()`        | Date de création                         |
| `updated_at`   | `timestamptz` | NULLABLE, DEFAULT: `now()`        | Date de mise à jour                      |

**RLS:** Activé

---

### `parents`

**Description :** Table des parents, liée à `profiles`. Stocke les informations détaillées des comptes parents, incluant leurs coordonnées et préférences. Chaque parent peut gérer plusieurs enfants.

**Rôle métier :**

- Gère les informations personnelles des parents (nom, téléphone, adresse)
- Stocke les préférences utilisateur dans le champ JSONB `preferences`
- Permet aux parents de gérer les profils de leurs enfants via la relation avec `children`

**Utilisation :**

- **Admin :** Utilisée dans l'interface parent pour afficher et modifier les informations du compte
- **Gestion des enfants :** Les parents peuvent créer, modifier et activer/désactiver les profils de leurs enfants
- **RLS :** Les parents ne peuvent accéder qu'à leurs propres données et celles de leurs enfants

**Relations clés :**

- 1:1 avec `profiles` (via `profile_id`)
- 1:N avec `children` (via `parent_id` dans `children` qui référence `profiles.id`)

| Colonne       | Type          | Contraintes                               | Description             |
| ------------- | ------------- | ----------------------------------------- | ----------------------- |
| `id`          | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique      |
| `profile_id`  | `uuid`        | UNIQUE, FK → `profiles.id`                | Référence au profil     |
| `fullname`    | `text`        | NULLABLE                                  | Nom complet             |
| `phone`       | `text`        | NULLABLE                                  | Téléphone               |
| `address`     | `text`        | NULLABLE                                  | Adresse                 |
| `city`        | `text`        | NULLABLE                                  | Ville                   |
| `country`     | `text`        | NULLABLE                                  | Pays                    |
| `preferences` | `jsonb`       | NULLABLE, DEFAULT: `'{}'::jsonb`          | Préférences utilisateur |
| `avatar_url`  | `text`        | NULLABLE                                  | URL de l'avatar         |
| `created_at`  | `timestamptz` | DEFAULT: `now()`                          | Date de création        |
| `updated_at`  | `timestamptz` | DEFAULT: `now()`                          | Date de mise à jour     |

**RLS:** Activé

---

### `children`

**Description :** Table des enfants, liée à `profiles` (parent) et `schools`. Cette table est centrale dans l'application car elle gère les profils des enfants qui utilisent l'interface frontend. Elle inclut un système d'authentification simplifié via PIN à 4 chiffres et génération d'avatar.

**Rôle métier :**

- Gère les profils des enfants qui utilisent l'application frontend
- Système d'authentification simplifié : connexion via `firstname` + `login_pin` (4 chiffres)
- Génération d'avatar via DiceBear avec `avatar_seed` et `avatar_style` (fun-emoji ou bottts)
- Gère le niveau scolaire et l'école de l'enfant
- Permet l'activation/désactivation des comptes enfants

**Utilisation :**

- **Frontend :** Utilisée par `ChildAuthService` pour l'authentification des enfants (connexion par prénom + PIN)
- **Admin :** Utilisée par `ChildService` pour la gestion des profils enfants par les parents
- **RLS spéciale :** Politique publique pour la connexion (lecture seule des enfants actifs avec `firstname` et `login_pin`)
- **Filtrage :** Le champ `is_active` permet de désactiver temporairement un compte sans le supprimer

**Relations clés :**

- N:1 avec `profiles` (via `parent_id`)
- N:1 avec `schools` (via `school_id`)
- 1:N avec toutes les tables `frontend_*` (progression, tentatives, collectibles, etc.)
- 1:N avec `child_subject_enrollments` et `child_subject_category_enrollments`

**Cas d'usage spécifiques :**

- Authentification enfant : `firstname` + `login_pin` pour connexion sans email
- Vérification unicité : La combinaison `avatar_seed` + `login_pin` doit être unique

| Colonne        | Type          | Contraintes                               | Description                          |
| -------------- | ------------- | ----------------------------------------- | ------------------------------------ | ------ | ------ | --------------- |
| `id`           | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique                   |
| `parent_id`    | `uuid`        | FK → `profiles.id`                        | Référence au parent                  |
| `firstname`    | `text`        | NULLABLE                                  | Prénom                               |
| `lastname`     | `text`        | NULLABLE                                  | Nom                                  |
| `birthdate`    | `date`        | NULLABLE                                  | Date de naissance                    |
| `gender`       | `text`        | NULLABLE                                  | Genre                                |
| `school_level` | `text`        | NULLABLE, CHECK: `M[1-3]                  | P[1-6]                               | S[1-6] | Autre` | Niveau scolaire |
| `notes`        | `text`        | NULLABLE                                  | Notes                                |
| `avatar_url`   | `text`        | NULLABLE                                  | URL de l'avatar                      |
| `avatar_seed`  | `text`        | NULLABLE                                  | Seed pour générer l'avatar DiceBear  |
| `avatar_style` | `varchar`     | NULLABLE, DEFAULT: `'fun-emoji'`          | Style d'avatar (fun-emoji ou bottts) |
| `login_pin`    | `varchar`     | NULLABLE                                  | Code PIN à 4 chiffres pour connexion |
| `school_id`    | `uuid`        | NULLABLE, FK → `schools.id`               | École de l'enfant                    |
| `is_active`    | `boolean`     | DEFAULT: `true`                           | Statut actif                         |
| `created_at`   | `timestamptz` | DEFAULT: `now()`                          | Date de création                     |
| `updated_at`   | `timestamptz` | DEFAULT: `now()`                          | Date de mise à jour                  |

**RLS:** Activé

---

### `teachers`

**Description :** Table des professeurs, liée à `profiles`. Stocke les informations détaillées des comptes professeurs, incluant leurs coordonnées et préférences de partage avec les parents.

**Rôle métier :**

- Gère les informations personnelles des professeurs (nom, biographie, téléphone)
- Contrôle le partage d'informations avec les parents (`share_email`, `share_phone`)
- Permet aux professeurs de créer et gérer des jeux, matières et affectations

**Utilisation :**

- **Admin :** Utilisée dans l'interface professeur pour afficher et modifier les informations du compte
- **Création de contenu :** Les professeurs peuvent créer des jeux, matières, sous-catégories via leurs affectations
- **Gestion des affectations :** Liée à `teacher_assignments` pour gérer les matières et classes enseignées

**Relations clés :**

- 1:1 avec `profiles` (via `profile_id`)
- 1:N avec `teacher_assignments` (via `teacher_id`)
- 1:N avec `questions` (via `teacher_id`)

| Colonne       | Type          | Contraintes                               | Description                    |
| ------------- | ------------- | ----------------------------------------- | ------------------------------ |
| `id`          | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique             |
| `profile_id`  | `uuid`        | UNIQUE, FK → `profiles.id`                | Référence au profil            |
| `fullname`    | `text`        | NULLABLE                                  | Nom complet                    |
| `bio`         | `text`        | NULLABLE                                  | Biographie                     |
| `phone`       | `text`        | NULLABLE                                  | Téléphone                      |
| `avatar_url`  | `text`        | NULLABLE                                  | URL de l'avatar                |
| `share_email` | `boolean`     | NULLABLE, DEFAULT: `false`                | Partage email avec parents     |
| `share_phone` | `boolean`     | NULLABLE, DEFAULT: `false`                | Partage téléphone avec parents |
| `created_at`  | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de création               |
| `updated_at`  | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de mise à jour            |

**RLS:** Activé

---

## Tables Écoles et Classes

### `schools`

**Description :** Table des écoles. Gère les établissements scolaires où sont inscrits les enfants et où enseignent les professeurs.

**Rôle métier :**

- Référentiel des établissements scolaires
- Permet d'organiser les enfants et professeurs par école
- Stocke les informations de localisation (adresse, ville, pays)

**Utilisation :**

- **Admin :** Utilisée par `SchoolService` pour la gestion des écoles (création, modification, liste)
- **Filtrage :** Utilisée pour filtrer les enfants et les affectations des professeurs par école
- **Interface parent :** Permet aux parents de sélectionner l'école de leur enfant lors de la création du profil

**Relations clés :**

- 1:N avec `children` (via `school_id`)
- 1:N avec `school_years` (via `school_id`)
- 1:N avec `teacher_assignments` (via `school_id`)
- 1:N avec `school_level_subjects` (via `school_id`)

| Colonne      | Type          | Contraintes                               | Description                 |
| ------------ | ------------- | ----------------------------------------- | --------------------------- |
| `id`         | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique          |
| `name`       | `text`        | NOT NULL                                  | Nom de l'école              |
| `address`    | `text`        | NULLABLE                                  | Adresse                     |
| `city`       | `text`        | NULLABLE                                  | Ville                       |
| `country`    | `text`        | NULLABLE                                  | Pays                        |
| `metadata`   | `jsonb`       | NULLABLE, DEFAULT: `'{}'::jsonb`          | Métadonnées supplémentaires |
| `created_at` | `timestamptz` | DEFAULT: `now()`                          | Date de création            |
| `updated_at` | `timestamptz` | DEFAULT: `now()`                          | Date de mise à jour         |

**RLS:** Activé

---

### `school_years`

**Description :** Table des années scolaires. Gère les années scolaires pour organiser les classes et les inscriptions des enfants.

**Rôle métier :**

- Organise les années scolaires (ex: "2023-2024", "2024-2025")
- Permet de filtrer les classes et inscriptions par année
- Gère l'ordre d'affichage via `order_index`

**Utilisation :**

- **Admin :** Utilisée pour organiser les classes et les inscriptions des enfants par année scolaire
- **Filtrage temporel :** Permet de filtrer les données par période scolaire
- **Statut actif :** Le champ `is_active` permet de désactiver les années scolaires passées

**Relations clés :**

- N:1 avec `schools` (via `school_id`)
- 1:N avec `classes` (via `school_year_id`)
- 1:N avec `teacher_assignments` (via `school_year_id`)
- 1:N avec `child_subject_enrollments` (via `school_year_id`)

| Colonne       | Type          | Contraintes                               | Description         |
| ------------- | ------------- | ----------------------------------------- | ------------------- |
| `id`          | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique  |
| `school_id`   | `uuid`        | NULLABLE, FK → `schools.id`               | École               |
| `label`       | `text`        | NOT NULL                                  | Libellé de l'année  |
| `order_index` | `integer`     | NULLABLE                                  | Ordre d'affichage   |
| `is_active`   | `boolean`     | NULLABLE, DEFAULT: `true`                 | Statut actif        |
| `created_at`  | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de création    |
| `updated_at`  | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de mise à jour |

**RLS:** Activé

---

### `classes`

**Description :** Table des classes. Gère les classes d'élèves au sein des écoles et années scolaires.

**Rôle métier :**

- Organise les élèves en classes au sein d'une école et d'une année scolaire
- Gère la capacité maximale des classes
- Permet d'organiser les affectations des professeurs par classe

**Utilisation :**

- **Admin :** Utilisée pour organiser les élèves et les affectations des professeurs
- **Gestion des affectations :** Liée à `teacher_assignments` pour affecter des professeurs à des classes spécifiques
- **Métadonnées :** Le champ `metadata` (JSONB) permet de stocker des informations supplémentaires sur la classe

**Relations clés :**

- N:1 avec `schools` (via `school_id`)
- N:1 avec `school_years` (via `school_year_id`)
- 1:N avec `teacher_assignments` (via `class_id`)

| Colonne          | Type          | Contraintes                               | Description                 |
| ---------------- | ------------- | ----------------------------------------- | --------------------------- |
| `id`             | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique          |
| `school_id`      | `uuid`        | NULLABLE, FK → `schools.id`               | École                       |
| `school_year_id` | `uuid`        | NULLABLE, FK → `school_years.id`          | Année scolaire              |
| `label`          | `text`        | NOT NULL                                  | Libellé de la classe        |
| `capacity`       | `integer`     | NULLABLE                                  | Capacité maximale           |
| `metadata`       | `jsonb`       | NULLABLE                                  | Métadonnées supplémentaires |
| `created_at`     | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de création            |
| `updated_at`     | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de mise à jour         |

**RLS:** Activé

---

### `teacher_assignments`

**Description :** Table des affectations des professeurs. Cette table est centrale pour le système pédagogique car elle lie les professeurs aux matières, classes, écoles et niveaux scolaires qu'ils enseignent. Elle utilise le soft delete pour conserver l'historique.

**Rôle métier :**

- Gère les affectations des professeurs (quelle matière, quelle classe, quelle école, quel niveau)
- Détermine quels jeux sont visibles pour un professeur (seuls les jeux des matières avec affectations actives sont accessibles)
- Permet de gérer les rôles des professeurs (titulaire, remplaçant, etc.)
- Utilise le soft delete (`deleted_at`) pour conserver l'historique sans supprimer définitivement

**Utilisation :**

- **Admin :** Utilisée par `TeacherAssignmentService` pour gérer les affectations des professeurs
- **Filtrage des jeux :** Les jeux ne sont visibles que si la matière a au moins une affectation active (`deleted_at IS NULL`)
- **Gestion des conflits :** Le système vérifie les affectations actives avec des niveaux différents pour éviter les doublons
- **Réactivation :** Permet de réactiver une affectation supprimée en créant une nouvelle avec les mêmes paramètres

**Relations clés :**

- N:1 avec `teachers` (via `teacher_id`)
- N:1 avec `schools` (via `school_id`)
- N:1 avec `school_years` (via `school_year_id`)
- N:1 avec `classes` (via `class_id`)
- N:1 avec `subjects` (via `subject_id`)

**Cas d'usage spécifiques :**

- Un professeur peut avoir plusieurs affectations pour la même matière mais avec des niveaux différents
- Les affectations supprimées (soft delete) peuvent être réactivées
- Le système vérifie les conflits lors de la création d'affectations

| Colonne          | Type          | Contraintes                               | Description                       |
| ---------------- | ------------- | ----------------------------------------- | --------------------------------- | ------ | ------ | --------------- |
| `id`             | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique                |
| `teacher_id`     | `uuid`        | FK → `teachers.id`                        | Professeur                        |
| `school_id`      | `uuid`        | NULLABLE, FK → `schools.id`               | École                             |
| `school_year_id` | `uuid`        | NULLABLE, FK → `school_years.id`          | Année scolaire                    |
| `class_id`       | `uuid`        | NULLABLE, FK → `classes.id`               | Classe                            |
| `subject_id`     | `uuid`        | NULLABLE, FK → `subjects.id`              | Matière                           |
| `roles`          | `text[]`      | NULLABLE, DEFAULT: `ARRAY['titulaire']`   | Rôles du professeur               |
| `school_level`   | `text`        | DEFAULT: `''`, CHECK: `M[1-3]             | P[1-6]                            | S[1-6] | Autre` | Niveau scolaire |
| `start_date`     | `date`        | NULLABLE                                  | Date de début                     |
| `end_date`       | `date`        | NULLABLE                                  | Date de fin                       |
| `deleted_at`     | `timestamptz` | NULLABLE                                  | Date de suppression (soft delete) |
| `created_at`     | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de création                  |
| `updated_at`     | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de mise à jour               |

**RLS:** Activé

---

## Tables Matières et Catégories

### `subjects`

**Description :** Table des matières. Gère le référentiel des matières scolaires (ex: Mathématiques, Français) et extra-scolaires (ex: Musique, Sport).

**Rôle métier :**

- Référentiel central des matières disponibles dans l'application
- Distingue les matières scolaires, extra-scolaires et optionnelles via le champ `type`
- Permet d'organiser les jeux et les inscriptions des enfants par matière

**Utilisation :**

- **Admin :** Utilisée par `SubjectService` pour la gestion des matières (création, modification, liste)
- **Frontend :** Utilisée par `SubjectsInfrastructure` pour afficher les matières disponibles pour un enfant
- **Filtrage :** Les matières sont filtrées selon les inscriptions de l'enfant (`child_subject_enrollments` avec `selected=true`)
- **Gestion des jeux :** Les jeux peuvent être liés directement à une matière (sans sous-catégorie)

**Relations clés :**

- 1:N avec `subject_categories` (via `subject_id`)
- 1:N avec `games` (via `subject_id`)
- 1:N avec `questions` (via `subject_id`)
- 1:N avec `school_level_subjects` (via `subject_id`)
- 1:N avec `child_subject_enrollments` (via `subject_id`)
- 1:N avec `frontend_bonus_games` (via `subject_id`)

**Cas d'usage spécifiques :**

- Les matières peuvent avoir des sous-catégories (`subject_categories`) pour une organisation plus fine
- Les matières peuvent être liées à des niveaux scolaires spécifiques via `school_level_subjects`

| Colonne             | Type          | Contraintes                               | Description                 |
| ------------------- | ------------- | ----------------------------------------- | --------------------------- | ------------ | --------------- |
| `id`                | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique          |
| `name`              | `text`        | NOT NULL                                  | Nom de la matière           |
| `description`       | `text`        | NULLABLE                                  | Description                 |
| `type`              | `text`        | NULLABLE, CHECK: `scolaire                | extra                       | optionnelle` | Type de matière |
| `default_age_range` | `text`        | NULLABLE                                  | Tranche d'âge par défaut    |
| `metadata`          | `jsonb`       | NULLABLE                                  | Métadonnées supplémentaires |
| `created_at`        | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de création            |
| `updated_at`        | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de mise à jour         |

**RLS:** Activé

---

### `subject_categories`

**Description :** Table des catégories de matières (sous-catégories). Permet de subdiviser les matières en sous-catégories plus spécifiques (ex: Mathématiques → Addition, Soustraction, Multiplication).

**Rôle métier :**

- Organise les matières en sous-catégories pour une granularité plus fine
- Permet de créer des jeux spécifiques à une sous-catégorie
- Gère la progression des enfants par sous-catégorie (via `frontend_subject_category_progress`)
- Permet de lier des collectibles à des sous-catégories

**Utilisation :**

- **Admin :** Utilisée par `SubjectCategoryService` pour la gestion des sous-catégories (création, modification, suppression, transfert)
- **Frontend :** Utilisée pour afficher les sous-catégories d'une matière et organiser les jeux
- **Progression :** La progression des enfants est suivie par sous-catégorie (étoiles, pourcentage de complétion)
- **Transfert :** Les sous-catégories peuvent être transférées d'une matière à une autre (les jeux restent liés)

**Relations clés :**

- N:1 avec `subjects` (via `subject_id`)
- 1:N avec `games` (via `subject_category_id`)
- 1:N avec `frontend_collectibles` (via `subject_category_id`)
- 1:N avec `frontend_subject_category_progress` (via `subject_category_id`)
- 1:N avec `child_subject_category_enrollments` (via `subject_category_id`)

**Cas d'usage spécifiques :**

- Les professeurs peuvent compter les enfants inscrits à une sous-catégorie avec filtres école/niveau
- Les sous-catégories peuvent être transférées vers une autre matière (les jeux suivent)
- RLS : Accès réservé aux professeurs pour la création/modification

| Colonne       | Type          | Contraintes                                            | Description         |
| ------------- | ------------- | ------------------------------------------------------ | ------------------- |
| `id`          | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()`              | Identifiant unique  |
| `subject_id`  | `uuid`        | NOT NULL, FK → `subjects.id`, UNIQUE(subject_id, name) | Matière parente     |
| `name`        | `text`        | NOT NULL                                               | Nom de la catégorie |
| `description` | `text`        | NULLABLE                                               | Description         |
| `created_at`  | `timestamptz` | DEFAULT: `now()`                                       | Date de création    |
| `updated_at`  | `timestamptz` | DEFAULT: `now()`                                       | Date de mise à jour |

**RLS:** Activé

**Index:**

- `idx_subject_categories_subject_id` sur `subject_id`

---

### `school_level_subjects`

**Description :** Table de liaison entre niveaux scolaires et matières. Définit quelles matières sont disponibles et obligatoires pour chaque niveau scolaire dans chaque école.

**Rôle métier :**

- Lie les matières aux niveaux scolaires (M1-M3, P1-P6, S1-S6) par école
- Détermine si une matière est obligatoire (`required=true`) ou optionnelle pour un niveau
- Permet de personnaliser le programme par école et par niveau

**Utilisation :**

- **Admin :** Utilisée pour configurer le programme scolaire par école et par niveau
- **Frontend :** Utilisée pour filtrer les matières disponibles selon le niveau scolaire de l'enfant
- **Gestion des inscriptions :** Les matières obligatoires peuvent être automatiquement ajoutées aux inscriptions des enfants

**Relations clés :**

- N:1 avec `schools` (via `school_id`)
- N:1 avec `subjects` (via `subject_id`)

**Cas d'usage spécifiques :**

- Une même matière peut être obligatoire pour certains niveaux et optionnelle pour d'autres
- Permet de personnaliser le programme par école

| Colonne        | Type          | Contraintes                               | Description         |
| -------------- | ------------- | ----------------------------------------- | ------------------- | ------- | --------------- |
| `id`           | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique  |
| `school_id`    | `uuid`        | NOT NULL, FK → `schools.id`               | École               |
| `school_level` | `text`        | NOT NULL, CHECK: `M[1-3]                  | P[1-6]              | S[1-6]` | Niveau scolaire |
| `subject_id`   | `uuid`        | NOT NULL, FK → `subjects.id`              | Matière             |
| `required`     | `boolean`     | DEFAULT: `true`                           | Matière obligatoire |
| `created_at`   | `timestamptz` | DEFAULT: `now()`                          | Date de création    |

**RLS:** Activé

---

### `child_subject_enrollments`

**Description :** Table des inscriptions des enfants aux matières. Gère les matières activées (`selected=true`) ou désactivées pour chaque enfant, par école et année scolaire.

**Rôle métier :**

- Détermine quelles matières sont activées pour un enfant (visible dans l'interface frontend)
- Permet aux parents de sélectionner/désélectionner les matières pour leurs enfants
- Lie les inscriptions à une école et une année scolaire spécifiques

**Utilisation :**

- **Admin :** Utilisée par `ParentSubjectService` pour gérer les matières activées pour un enfant
- **Frontend :** Utilisée par `SubjectsInfrastructure` pour filtrer les matières affichées (seulement celles avec `selected=true`)
- **Création automatique :** Les inscriptions peuvent être créées automatiquement lors de l'ajout d'un enfant à une école

**Relations clés :**

- N:1 avec `children` (via `child_id`)
- N:1 avec `schools` (via `school_id`)
- N:1 avec `school_years` (via `school_year_id`)
- N:1 avec `subjects` (via `subject_id`)

**Cas d'usage spécifiques :**

- Le champ `selected` détermine si la matière est visible dans l'interface enfant
- Les inscriptions sont créées automatiquement pour les matières obligatoires du niveau scolaire

| Colonne          | Type          | Contraintes                               | Description          |
| ---------------- | ------------- | ----------------------------------------- | -------------------- |
| `id`             | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique   |
| `child_id`       | `uuid`        | NOT NULL, FK → `children.id`              | Enfant               |
| `school_id`      | `uuid`        | NOT NULL, FK → `schools.id`               | École                |
| `school_year_id` | `uuid`        | NULLABLE, FK → `school_years.id`          | Année scolaire       |
| `subject_id`     | `uuid`        | NOT NULL, FK → `subjects.id`              | Matière              |
| `selected`       | `boolean`     | DEFAULT: `true`                           | Matière sélectionnée |
| `created_at`     | `timestamptz` | DEFAULT: `now()`                          | Date de création     |
| `updated_at`     | `timestamptz` | DEFAULT: `now()`                          | Date de mise à jour  |

**RLS:** Activé

---

### `child_subject_category_enrollments`

**Description :** Table des inscriptions des enfants aux catégories de matières. Gère les sous-catégories activées (`selected=true`) ou désactivées pour chaque enfant.

**Rôle métier :**

- Détermine quelles sous-catégories sont activées pour un enfant
- Permet un contrôle fin de la progression de l'enfant par sous-catégorie
- Utilisée pour filtrer les jeux disponibles dans l'interface frontend

**Utilisation :**

- **Admin :** Utilisée pour gérer les sous-catégories activées pour un enfant
- **Frontend :** Utilisée pour filtrer les jeux et la progression par sous-catégorie
- **RLS :** Accès réservé aux parents pour leurs enfants

**Relations clés :**

- N:1 avec `children` (via `child_id`)
- N:1 avec `subject_categories` (via `subject_category_id`)

**Index :**

- `idx_child_category_enrollments_child_id` : Optimise les requêtes par enfant
- `idx_child_category_enrollments_category_id` : Optimise les requêtes par catégorie

| Colonne               | Type          | Contraintes                                                         | Description            |
| --------------------- | ------------- | ------------------------------------------------------------------- | ---------------------- |
| `id`                  | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()`                           | Identifiant unique     |
| `child_id`            | `uuid`        | NOT NULL, FK → `children.id`, UNIQUE(child_id, subject_category_id) | Enfant                 |
| `subject_category_id` | `uuid`        | NOT NULL, FK → `subject_categories.id`                              | Catégorie              |
| `selected`            | `boolean`     | DEFAULT: `true`                                                     | Catégorie sélectionnée |
| `created_at`          | `timestamptz` | DEFAULT: `now()`                                                    | Date de création       |
| `updated_at`          | `timestamptz` | DEFAULT: `now()`                                                    | Date de mise à jour    |

**RLS:** Activé

**Index:**

- `idx_child_category_enrollments_child_id` sur `child_id`
- `idx_child_category_enrollments_category_id` sur `subject_category_id`

---

## Tables Jeux

### `game_types`

**Description :** Table des types de jeux. Référentiel des types de jeux disponibles dans l'application (QCM, Memory, Puzzle, Chronologie, etc.).

**Rôle métier :**

- Définit les types de jeux disponibles dans l'application
- Stocke les métadonnées de chaque type (icône, couleur, description)
- Utilisée pour catégoriser et styliser les jeux dans l'interface

**Utilisation :**

- **Admin :** Utilisée par `GameTypeService` pour récupérer la liste des types disponibles
- **Frontend :** Utilisée par `GameTypeStyleService` pour appliquer les styles et icônes selon le type
- **Statistiques :** Utilisée pour compter les jeux par type dans les statistiques

**Relations clés :**

- 1:N avec `games` (via `game_type_id`)

**Cas d'usage spécifiques :**

- Chaque type de jeu a une icône et une couleur associée pour l'affichage
- Les types sont utilisés pour filtrer et organiser les jeux dans l'interface

| Colonne       | Type          | Contraintes                               | Description                 |
| ------------- | ------------- | ----------------------------------------- | --------------------------- |
| `id`          | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique          |
| `name`        | `text`        | NOT NULL, UNIQUE                          | Nom du type de jeu          |
| `description` | `text`        | NULLABLE                                  | Description                 |
| `icon`        | `text`        | NULLABLE                                  | Icône                       |
| `color_code`  | `text`        | NULLABLE                                  | Code couleur                |
| `metadata`    | `jsonb`       | NULLABLE                                  | Métadonnées supplémentaires |
| `created_at`  | `timestamptz` | DEFAULT: `now()`                          | Date de création            |
| `updated_at`  | `timestamptz` | DEFAULT: `now()`                          | Date de mise à jour         |

**RLS:** Activé

---

### `games`

**Description :** Table principale des jeux. Stocke tous les jeux éducatifs créés par les professeurs. Un jeu doit être lié soit à une matière (`subject_id`) soit à une sous-catégorie (`subject_category_id`), mais pas les deux.

**Rôle métier :**

- Centralise tous les jeux éducatifs de l'application
- Stocke les données spécifiques à chaque type de jeu dans `reponses` (JSONB)
- Gère les aides pédagogiques (textes, images, vidéos) pour aider les enfants
- Permet de créer des jeux variés : QCM, Memory, Puzzle, Chronologie, Vrai/Faux, etc.

**Utilisation :**

- **Admin :** Utilisée par `GameService` pour créer, modifier, supprimer et lister les jeux
- **Frontend :** Utilisée par `GameInfrastructure` pour charger les jeux et sauvegarder les tentatives
- **Filtrage :** Les jeux ne sont visibles que si la matière a au moins une affectation active (`teacher_assignments` avec `deleted_at IS NULL`)
- **Statistiques :** Utilisée pour compter les jeux par type et par matière/catégorie

**Relations clés :**

- N:1 avec `subjects` (via `subject_id`) - optionnel
- N:1 avec `subject_categories` (via `subject_category_id`) - optionnel
- N:1 avec `game_types` (via `game_type_id`) - obligatoire
- 1:N avec `frontend_game_attempts` (via `game_id`)
- 1:N avec `frontend_game_variants` (via `game_id`)

**Contraintes importantes :**

- `games_subject_or_category_check` : Un jeu doit avoir soit `subject_id` soit `subject_category_id` (pas les deux, pas aucun)

**Cas d'usage spécifiques :**

- Les jeux liés à une matière sont affichés directement sous la matière
- Les jeux liés à une sous-catégorie sont affichés sous la sous-catégorie
- Le champ `reponses` (JSONB) stocke la structure spécifique à chaque type de jeu
- Les aides (`aides`, `aide_image_url`, `aide_video_url`) sont affichées pour aider l'enfant

| Colonne               | Type          | Contraintes                               | Description                                                       |
| --------------------- | ------------- | ----------------------------------------- | ----------------------------------------------------------------- |
| `id`                  | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique                                                |
| `subject_id`          | `uuid`        | NULLABLE, FK → `subjects.id`              | Matière (nullable si subject_category_id)                         |
| `subject_category_id` | `uuid`        | NULLABLE, FK → `subject_categories.id`    | Catégorie (nullable si subject_id)                                |
| `game_type_id`        | `uuid`        | NOT NULL, FK → `game_types.id`            | Type de jeu                                                       |
| `name`                | `text`        | NOT NULL                                  | Nom du jeu                                                        |
| `description`         | `text`        | NULLABLE                                  | Description                                                       |
| `instructions`        | `text`        | NULLABLE                                  | Instructions                                                      |
| `question`            | `text`        | NULLABLE                                  | Question du jeu                                                   |
| `reponses`            | `jsonb`       | NULLABLE                                  | Structure: `{"propositions": string[], "reponse_valide": string}` |
| `aides`               | `jsonb`       | NULLABLE                                  | Tableau de phrases d'aide: `string[]`                             |
| `aide_image_url`      | `text`        | NULLABLE                                  | URL de l'image d'aide                                             |
| `aide_video_url`      | `text`        | NULLABLE                                  | URL de la vidéo d'aide                                            |
| `metadata`            | `jsonb`       | NULLABLE                                  | Métadonnées supplémentaires                                       |
| `created_at`          | `timestamptz` | DEFAULT: `now()`                          | Date de création                                                  |
| `updated_at`          | `timestamptz` | DEFAULT: `now()`                          | Date de mise à jour                                               |

**RLS:** Activé

**Contraintes:**

- `games_subject_or_category_check`: Un jeu doit avoir soit `subject_id` soit `subject_category_id` (pas les deux, pas aucun)

**Index:**

- `idx_games_subject_category_id` sur `subject_category_id`

---

### `questions`

**Description :** Table des questions (pour les QCM, vrai/faux, etc.). Stocke les questions réutilisables créées par les professeurs, qui peuvent être utilisées dans plusieurs jeux.

**Rôle métier :**

- Banque de questions réutilisables pour les professeurs
- Supporte plusieurs types de questions (QCM, vrai/faux, texte, numérique)
- Permet de gérer la difficulté des questions
- Peut être liée à un professeur spécifique pour le suivi

**Utilisation :**

- **Admin :** Utilisée pour créer et gérer une banque de questions réutilisables
- **Création de jeux :** Les questions peuvent être utilisées lors de la création de jeux
- **Filtrage :** Les questions peuvent être filtrées par matière, type et difficulté

**Relations clés :**

- N:1 avec `subjects` (via `subject_id`)
- N:1 avec `teachers` (via `teacher_id`) - optionnel

**Cas d'usage spécifiques :**

- Les questions peuvent être partagées entre plusieurs jeux
- Le champ `options` (JSONB) stocke la structure spécifique à chaque type de question
- Le champ `answer_key` (JSONB) stocke la réponse correcte selon le type

| Colonne         | Type          | Contraintes                               | Description                                   |
| --------------- | ------------- | ----------------------------------------- | --------------------------------------------- | ---------- | ---------- | ---------------- |
| `id`            | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique                            |
| `subject_id`    | `uuid`        | NOT NULL, FK → `subjects.id`              | Matière                                       |
| `teacher_id`    | `uuid`        | NULLABLE, FK → `teachers.id`              | Professeur créateur                           |
| `question_type` | `text`        | NULLABLE, CHECK: `qcm                     | vrai_faux                                     | texte      | numerique` | Type de question |
| `prompt`        | `text`        | NOT NULL                                  | Énoncé de la question                         |
| `options`       | `jsonb`       | NULLABLE                                  | Options de réponse (structure dépend du type) |
| `answer_key`    | `jsonb`       | NULLABLE                                  | Clé de réponse                                |
| `difficulty`    | `text`        | NULLABLE, CHECK: `facile                  | moyen                                         | difficile` | Difficulté |
| `metadata`      | `jsonb`       | NULLABLE                                  | Métadonnées supplémentaires                   |
| `created_at`    | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de création                              |
| `updated_at`    | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de mise à jour                           |

**RLS:** Activé

---

## Tables Frontend

### `frontend_game_attempts`

**Description :** Table des tentatives de jeux des enfants. Enregistre chaque tentative de jeu d'un enfant avec le score, la durée, les réponses et le succès. Cette table est essentielle pour le suivi de la progression et les statistiques.

**Rôle métier :**

- Enregistre toutes les tentatives de jeux des enfants
- Calcule les scores et le taux de réussite pour chaque jeu
- Permet de suivre la progression de l'enfant (meilleur score, nombre de tentatives)
- Utilisée pour calculer les étoiles et le pourcentage de complétion des sous-catégories

**Utilisation :**

- **Frontend :** Utilisée par `GameInfrastructure` pour sauvegarder les tentatives après chaque jeu
- **Progression :** Utilisée par `ProgressionService` pour calculer la progression par sous-catégorie
- **Statistiques :** Utilisée pour afficher les statistiques de jeu à l'enfant et aux parents
- **Adaptation :** Utilisée par `AdaptiveDifficultyService` pour adapter la difficulté selon les performances

**Relations clés :**

- N:1 avec `children` (via `child_id`)
- N:1 avec `games` (via `game_id`)

**Cas d'usage spécifiques :**

- Le score est un pourcentage (0-100) calculé selon les réponses correctes
- Le champ `responses_json` (JSONB) stocke toutes les réponses de l'enfant pour analyse
- Le meilleur score par jeu est utilisé pour déterminer si un jeu est "réussi" (score = 100%)
- Les tentatives échouées sont utilisées pour proposer des jeux à refaire

| Colonne            | Type          | Contraintes                               | Description            |
| ------------------ | ------------- | ----------------------------------------- | ---------------------- |
| `id`               | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique     |
| `child_id`         | `uuid`        | NOT NULL, FK → `children.id`              | Enfant                 |
| `game_id`          | `uuid`        | NOT NULL, FK → `games.id`                 | Jeu                    |
| `success`          | `boolean`     | DEFAULT: `false`                          | Succès de la tentative |
| `score`            | `integer`     | DEFAULT: `0`                              | Score obtenu           |
| `duration_ms`      | `integer`     | NULLABLE                                  | Durée en millisecondes |
| `responses_json`   | `jsonb`       | NULLABLE                                  | Réponses de l'enfant   |
| `difficulty_level` | `integer`     | DEFAULT: `1`                              | Niveau de difficulté   |
| `started_at`       | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de début          |
| `completed_at`     | `timestamptz` | NULLABLE                                  | Date de fin            |
| `created_at`       | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de création       |
| `updated_at`       | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de mise à jour    |

**RLS:** Activé

---

### `frontend_subject_category_progress`

**Description :** Table de progression des enfants par catégorie de matière. Suit la progression de chaque enfant pour chaque sous-catégorie avec les étoiles obtenues, le pourcentage de complétion et le statut de complétion.

**Rôle métier :**

- Suit la progression de l'enfant par sous-catégorie (étoiles, pourcentage, complétion)
- Calcule automatiquement le pourcentage de complétion basé sur les jeux réussis (score = 100%)
- Gère le système d'étoiles (0-3 étoiles) selon les performances
- Détermine si une sous-catégorie est complétée (100% ou `completed=true`)

**Utilisation :**

- **Frontend :** Utilisée par `ProgressionService` pour mettre à jour la progression après chaque jeu
- **Affichage :** Utilisée pour afficher les étoiles et le pourcentage de complétion dans l'interface
- **Déblocage :** Utilisée pour vérifier les conditions de déblocage des collectibles et jeux bonus
- **Calcul :** Le pourcentage est calculé comme : (jeux réussis / total jeux) × 100

**Relations clés :**

- N:1 avec `children` (via `child_id`)
- N:1 avec `subject_categories` (via `subject_category_id`)

**Cas d'usage spécifiques :**

- Les étoiles sont calculées selon le score et le taux de réussite (3 étoiles = parfait, 2 = bien, 1 = passable, 0 = à refaire)
- Le pourcentage de complétion est mis à jour automatiquement après chaque tentative
- Une sous-catégorie est considérée complétée si `completed=true` OU `completion_percentage >= 100`
- Utilisée pour débloquer les collectibles liés à la sous-catégorie

| Colonne                 | Type          | Contraintes                               | Description               |
| ----------------------- | ------------- | ----------------------------------------- | ------------------------- |
| `id`                    | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique        |
| `child_id`              | `uuid`        | NOT NULL, FK → `children.id`              | Enfant                    |
| `subject_category_id`   | `uuid`        | NOT NULL, FK → `subject_categories.id`    | Catégorie                 |
| `completed`             | `boolean`     | DEFAULT: `false`                          | Catégorie complétée       |
| `stars_count`           | `integer`     | DEFAULT: `0`, CHECK: `0-3`                | Nombre d'étoiles (0-3)    |
| `completion_percentage` | `integer`     | DEFAULT: `0`, CHECK: `0-100`              | Pourcentage de complétion |
| `last_played_at`        | `timestamptz` | NULLABLE                                  | Dernière date de jeu      |
| `created_at`            | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de création          |
| `updated_at`            | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de mise à jour       |

**RLS:** Activé

---

### `frontend_game_variants`

**Description :** Table des variantes de jeux (pour différents niveaux de difficulté). Permet de créer plusieurs variantes d'un même jeu avec différents niveaux de difficulté (1-5).

**Rôle métier :**

- Gère les variantes de difficulté pour un même jeu
- Permet d'adapter la difficulté selon le niveau de l'enfant
- Stocke les données spécifiques à chaque variante dans `variant_data_json` (JSONB)

**Utilisation :**

- **Frontend :** Utilisée pour charger la variante appropriée selon le niveau de difficulté de l'enfant
- **Adaptation :** Utilisée par `AdaptiveDifficultyService` pour proposer la bonne difficulté
- **Progression :** Permet d'augmenter progressivement la difficulté selon les performances

**Relations clés :**

- N:1 avec `games` (via `game_id`)

**Cas d'usage spécifiques :**

- Les variantes peuvent être activées/désactivées via `is_active`
- Le niveau de difficulté va de 1 (facile) à 5 (très difficile)
- Les données de chaque variante sont stockées dans `variant_data_json` (structure spécifique au type de jeu)

| Colonne             | Type          | Contraintes                               | Description                |
| ------------------- | ------------- | ----------------------------------------- | -------------------------- |
| `id`                | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique         |
| `game_id`           | `uuid`        | NOT NULL, FK → `games.id`                 | Jeu parent                 |
| `variant_data_json` | `jsonb`       | NOT NULL                                  | Données de la variante     |
| `difficulty_level`  | `integer`     | DEFAULT: `1`, CHECK: `1-5`                | Niveau de difficulté (1-5) |
| `is_active`         | `boolean`     | DEFAULT: `true`                           | Variante active            |
| `created_at`        | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de création           |
| `updated_at`        | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de mise à jour        |

**RLS:** Activé

---

### `frontend_collectibles`

**Description :** Table des objets collectionnables. Définit les objets que les enfants peuvent débloquer en complétant des sous-catégories ou en atteignant certains objectifs.

**Rôle métier :**

- Gère le système de collection pour motiver les enfants
- Définit les conditions de déblocage via `unlock_condition_json` (JSONB)
- Permet de lier des collectibles à des sous-catégories spécifiques
- Gère l'ordre d'affichage dans la collection

**Utilisation :**

- **Frontend :** Utilisée par `CollectionService` pour afficher les collectibles disponibles et débloqués
- **Déblocage automatique :** Les collectibles sont débloqués automatiquement quand les conditions sont remplies
- **Condition principale :** Compléter une sous-catégorie (`complete_subject_category`)

**Relations clés :**

- N:1 avec `subject_categories` (via `subject_category_id`) - optionnel

**Cas d'usage spécifiques :**

- Les collectibles sont débloqués automatiquement quand une sous-catégorie est complétée
- Le champ `unlock_condition_json` permet de définir des conditions complexes (type, subject_category_id, etc.)
- Les collectibles peuvent être activés/désactivés via `is_active`
- L'ordre d'affichage est géré par `display_order`

| Colonne                 | Type          | Contraintes                               | Description             |
| ----------------------- | ------------- | ----------------------------------------- | ----------------------- |
| `id`                    | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique      |
| `name`                  | `text`        | NOT NULL                                  | Nom de l'objet          |
| `description`           | `text`        | NULLABLE                                  | Description             |
| `image_url`             | `text`        | NULLABLE                                  | URL de l'image          |
| `subject_category_id`   | `uuid`        | NULLABLE, FK → `subject_categories.id`    | Catégorie associée      |
| `unlock_condition_json` | `jsonb`       | NULLABLE                                  | Conditions de déblocage |
| `display_order`         | `integer`     | NULLABLE, DEFAULT: `0`                    | Ordre d'affichage       |
| `is_active`             | `boolean`     | DEFAULT: `true`                           | Objet actif             |
| `created_at`            | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de création        |
| `updated_at`            | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de mise à jour     |

**RLS:** Activé

---

### `frontend_child_collectibles`

**Description :** Table de liaison enfants/objets collectionnables (objets débloqués). Enregistre quels collectibles ont été débloqués par chaque enfant et à quel moment.

**Rôle métier :**

- Suit les collectibles débloqués par chaque enfant
- Enregistre la date de déblocage pour afficher l'historique
- Permet d'afficher la collection personnelle de l'enfant

**Utilisation :**

- **Frontend :** Utilisée par `CollectionService` pour afficher les collectibles débloqués par l'enfant
- **Vérification :** Utilisée pour vérifier si un collectible est déjà débloqué avant de le débloquer à nouveau
- **Affichage :** Utilisée pour afficher la collection personnelle dans l'interface enfant

**Relations clés :**

- N:1 avec `children` (via `child_id`)
- N:1 avec `frontend_collectibles` (via `collectible_id`)

**Cas d'usage spécifiques :**

- Les collectibles sont débloqués automatiquement par le système quand les conditions sont remplies
- La date de déblocage (`unlocked_at`) permet d'afficher l'ordre chronologique

| Colonne          | Type          | Contraintes                               | Description           |
| ---------------- | ------------- | ----------------------------------------- | --------------------- |
| `id`             | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique    |
| `child_id`       | `uuid`        | NOT NULL, FK → `children.id`              | Enfant                |
| `collectible_id` | `uuid`        | NOT NULL, FK → `frontend_collectibles.id` | Objet collectionnable |
| `unlocked_at`    | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de déblocage     |
| `created_at`     | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de création      |

**RLS:** Activé

---

### `frontend_bonus_games`

**Description :** Table des jeux bonus. Définit les mini-jeux bonus que les enfants peuvent débloquer en complétant des matières entières ou en atteignant certains objectifs.

**Rôle métier :**

- Gère les jeux bonus récompenses pour motiver les enfants
- Définit les conditions de déblocage via `unlock_condition_json` (JSONB)
- Stocke les données du jeu dans `game_data_json` (JSONB)
- Permet de lier des jeux bonus à des matières spécifiques

**Utilisation :**

- **Frontend :** Utilisée par `BonusGamesService` pour afficher les jeux bonus disponibles et débloqués
- **Déblocage :** Les jeux bonus sont débloqués quand toutes les sous-catégories d'une matière sont complétées
- **Jouabilité :** Les jeux bonus peuvent être joués plusieurs fois (compteur `played_count`)

**Relations clés :**

- N:1 avec `subjects` (via `subject_id`) - optionnel

**Cas d'usage spécifiques :**

- Condition principale : Compléter toutes les sous-catégories d'une matière (`complete_subject`)
- Les données du jeu sont stockées dans `game_data_json` (structure spécifique au type de jeu bonus)
- Les jeux bonus peuvent être activés/désactivés via `is_active`

| Colonne                 | Type          | Contraintes                               | Description             |
| ----------------------- | ------------- | ----------------------------------------- | ----------------------- |
| `id`                    | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique      |
| `name`                  | `text`        | NOT NULL                                  | Nom du jeu              |
| `description`           | `text`        | NULLABLE                                  | Description             |
| `subject_id`            | `uuid`        | NULLABLE, FK → `subjects.id`              | Matière associée        |
| `unlock_condition_json` | `jsonb`       | NOT NULL                                  | Conditions de déblocage |
| `game_data_json`        | `jsonb`       | NOT NULL                                  | Données du jeu          |
| `image_url`             | `text`        | NULLABLE                                  | URL de l'image          |
| `is_active`             | `boolean`     | DEFAULT: `true`                           | Jeu actif               |
| `created_at`            | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de création        |
| `updated_at`            | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de mise à jour     |

**RLS:** Activé

---

### `frontend_child_bonus_game_unlocks`

**Description :** Table de liaison enfants/jeux bonus (jeux débloqués). Enregistre quels jeux bonus ont été débloqués par chaque enfant, avec le nombre de parties jouées et la dernière date de jeu.

**Rôle métier :**

- Suit les jeux bonus débloqués par chaque enfant
- Enregistre le nombre de parties jouées pour les statistiques
- Permet de suivre l'engagement de l'enfant avec les jeux bonus

**Utilisation :**

- **Frontend :** Utilisée par `BonusGamesService` pour afficher les jeux bonus débloqués
- **Compteur :** Le compteur `played_count` est incrémenté à chaque partie jouée
- **Historique :** La date `last_played_at` permet de suivre l'activité récente

**Relations clés :**

- N:1 avec `children` (via `child_id`)
- N:1 avec `frontend_bonus_games` (via `bonus_game_id`)

**Cas d'usage spécifiques :**

- Les jeux bonus sont débloqués automatiquement quand les conditions sont remplies
- Le compteur `played_count` permet de suivre l'engagement de l'enfant
- La date `last_played_at` est mise à jour à chaque partie

| Colonne          | Type          | Contraintes                               | Description              |
| ---------------- | ------------- | ----------------------------------------- | ------------------------ |
| `id`             | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique       |
| `child_id`       | `uuid`        | NOT NULL, FK → `children.id`              | Enfant                   |
| `bonus_game_id`  | `uuid`        | NOT NULL, FK → `frontend_bonus_games.id`  | Jeu bonus                |
| `unlocked_at`    | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de déblocage        |
| `played_count`   | `integer`     | DEFAULT: `0`                              | Nombre de parties jouées |
| `last_played_at` | `timestamptz` | NULLABLE                                  | Dernière date de jeu     |
| `created_at`     | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de création         |
| `updated_at`     | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de mise à jour      |

**RLS:** Activé

---

### `frontend_themes`

**Description :** Table des thèmes visuels de l'application. Définit les thèmes personnalisables que les enfants peuvent débloquer et sélectionner pour personnaliser l'apparence de l'interface.

**Rôle métier :**

- Gère les thèmes visuels personnalisables de l'application
- Définit les couleurs et formes via `shapes_colors_json` (JSONB)
- Permet de filtrer les thèmes par niveau scolaire (`school_level_min`, `school_level_max`)
- Gère les conditions de déblocage via `unlock_condition_json` (JSONB)

**Utilisation :**

- **Frontend :** Utilisée par `ThemesService` pour afficher les thèmes disponibles selon le niveau scolaire
- **Sélection :** Les enfants peuvent sélectionner un thème parmi ceux débloqués
- **Déblocage :** Les thèmes peuvent être débloqués selon le nombre total d'étoiles obtenues
- **Par défaut :** Les thèmes avec `is_default=true` sont toujours disponibles

**Relations clés :**

- 1:N avec `frontend_child_themes` (via `theme_id`)

**Cas d'usage spécifiques :**

- Les thèmes par défaut (`is_default=true`) sont toujours disponibles sans condition
- Les thèmes peuvent être filtrés par niveau scolaire pour adapter l'apparence à l'âge
- Les conditions de déblocage peuvent être basées sur le nombre total d'étoiles (`by_level` avec `min_stars`)
- L'ordre d'affichage est géré par `display_order`

| Colonne                 | Type          | Contraintes                               | Description                          |
| ----------------------- | ------------- | ----------------------------------------- | ------------------------------------ |
| `id`                    | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique                   |
| `name`                  | `text`        | NOT NULL                                  | Nom du thème                         |
| `school_level_min`      | `integer`     | NULLABLE                                  | Niveau scolaire minimum              |
| `school_level_max`      | `integer`     | NULLABLE                                  | Niveau scolaire maximum              |
| `shapes_colors_json`    | `jsonb`       | NOT NULL                                  | Configuration des formes et couleurs |
| `unlock_condition_json` | `jsonb`       | NULLABLE                                  | Conditions de déblocage              |
| `is_default`            | `boolean`     | DEFAULT: `false`                          | Thème par défaut                     |
| `display_order`         | `integer`     | NULLABLE, DEFAULT: `0`                    | Ordre d'affichage                    |
| `is_active`             | `boolean`     | DEFAULT: `true`                           | Thème actif                          |
| `created_at`            | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de création                     |
| `updated_at`            | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de mise à jour                  |

**RLS:** Activé

---

### `frontend_child_themes`

**Description :** Table de liaison enfants/thèmes (thèmes débloqués et sélectionnés). Enregistre quels thèmes ont été débloqués par chaque enfant et lequel est actuellement sélectionné.

**Rôle métier :**

- Suit les thèmes débloqués par chaque enfant
- Gère le thème sélectionné (`is_selected=true`) pour appliquer l'apparence
- Permet de débloquer automatiquement les thèmes quand les conditions sont remplies

**Utilisation :**

- **Frontend :** Utilisée par `ThemesService` pour afficher les thèmes débloqués et appliquer le thème sélectionné
- **Sélection unique :** Un seul thème peut être sélectionné à la fois (les autres sont automatiquement désélectionnés)
- **Déblocage automatique :** Les thèmes sont débloqués automatiquement quand les conditions sont remplies

**Relations clés :**

- N:1 avec `children` (via `child_id`)
- N:1 avec `frontend_themes` (via `theme_id`)

**Cas d'usage spécifiques :**

- Quand un enfant sélectionne un thème, tous les autres sont automatiquement désélectionnés
- Si un thème n'est pas encore débloqué mais est sélectionné, il est automatiquement débloqué
- La date de déblocage (`unlocked_at`) permet d'afficher l'historique

| Colonne       | Type          | Contraintes                               | Description         |
| ------------- | ------------- | ----------------------------------------- | ------------------- |
| `id`          | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique  |
| `child_id`    | `uuid`        | NOT NULL, FK → `children.id`              | Enfant              |
| `theme_id`    | `uuid`        | NOT NULL, FK → `frontend_themes.id`       | Thème               |
| `is_selected` | `boolean`     | DEFAULT: `false`                          | Thème sélectionné   |
| `unlocked_at` | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de déblocage   |
| `created_at`  | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de création    |
| `updated_at`  | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de mise à jour |

**RLS:** Activé

---

### `frontend_child_mascot_state`

**Description :** Table de l'état de la mascotte de l'enfant (niveau, XP, évolution). Gère le système de gamification avec une mascotte qui évolue selon les performances de l'enfant.

**Rôle métier :**

- Gère le système de mascotte pour motiver les enfants
- Suit le niveau, l'XP et le stade d'évolution de la mascotte
- Calcule automatiquement le niveau selon l'XP (formule : `floor(sqrt(xp / 100)) + 1`)
- Gère l'évolution de la mascotte selon le niveau (5 stades d'évolution)

**Utilisation :**

- **Frontend :** Utilisée par `MascotService` pour afficher et mettre à jour l'état de la mascotte
- **Gain d'XP :** L'XP est ajoutée après chaque jeu réussi (10-30 points selon le score)
- **Évolution :** Le stade d'évolution est calculé automatiquement selon le niveau (1-5 stades)
- **Apparence :** Le champ `current_appearance_json` stocke l'apparence actuelle (couleur, accessoires)

**Relations clés :**

- 1:1 avec `children` (via `child_id`, UNIQUE)

**Cas d'usage spécifiques :**

- L'XP est gagnée après chaque jeu réussi : base 10 points + bonus jusqu'à 20 points selon le score
- Le niveau est calculé automatiquement : `floor(sqrt(xp / 100)) + 1`
- Les stades d'évolution : 1 (niveau 1-4), 2 (niveau 5-9), 3 (niveau 10-14), 4 (niveau 15-19), 5 (niveau 20+)
- Un état par défaut est créé automatiquement si inexistant (niveau 1, XP 0, stade 1)

| Colonne                   | Type          | Contraintes                               | Description               |
| ------------------------- | ------------- | ----------------------------------------- | ------------------------- |
| `id`                      | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique        |
| `child_id`                | `uuid`        | NOT NULL, UNIQUE, FK → `children.id`      | Enfant                    |
| `level`                   | `integer`     | DEFAULT: `1`, CHECK: `>= 1`               | Niveau de la mascotte     |
| `xp`                      | `integer`     | DEFAULT: `0`, CHECK: `>= 0`               | Points d'expérience       |
| `current_appearance_json` | `jsonb`       | NULLABLE                                  | Apparence actuelle (JSON) |
| `evolution_stage`         | `integer`     | DEFAULT: `1`, CHECK: `1-5`                | Stade d'évolution (1-5)   |
| `last_xp_gain_at`         | `timestamptz` | NULLABLE                                  | Dernière acquisition d'XP |
| `created_at`              | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de création          |
| `updated_at`              | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de mise à jour       |

**RLS:** Activé

---

### `frontend_child_checkpoints`

**Description :** Table des points de sauvegarde pour l'application enfant (sauvegarde hybride: auto + checkpoint). Permet de sauvegarder l'état de l'application à des moments clés (fin de jeu, fin de sous-catégorie) pour permettre la reprise de session.

**Rôle métier :**

- Gère les points de sauvegarde pour permettre la reprise de session
- Sauvegarde l'état de l'application à des moments clés (fin de jeu, fin de sous-catégorie)
- Permet de restaurer l'état de l'application après une fermeture inattendue
- Système hybride : sauvegarde automatique + checkpoints explicites

**Utilisation :**

- **Frontend :** Utilisée par `CheckpointService` pour créer et récupérer les checkpoints
- **Types de checkpoints :** `game_end` (fin de jeu), `subject_category_end` (fin de sous-catégorie)
- **Récupération :** Le dernier checkpoint est récupéré au démarrage pour restaurer l'état
- **Nettoyage :** Les anciens checkpoints peuvent être nettoyés (garde les N derniers)

**Relations clés :**

- N:1 avec `children` (via `child_id`)

**Cas d'usage spécifiques :**

- Les checkpoints sont créés automatiquement à la fin de chaque jeu
- Les checkpoints sont créés à la fin de chaque sous-catégorie complétée
- Le champ `checkpoint_data_json` stocke toutes les données nécessaires pour restaurer l'état
- Les anciens checkpoints peuvent être nettoyés automatiquement (garde les 10 derniers par défaut)

| Colonne                | Type          | Contraintes                               | Description           |
| ---------------------- | ------------- | ----------------------------------------- | --------------------- |
| `id`                   | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique    |
| `child_id`             | `uuid`        | NOT NULL, FK → `children.id`              | Enfant                |
| `checkpoint_type`      | `text`        | NOT NULL                                  | Type de checkpoint    |
| `checkpoint_data_json` | `jsonb`       | NOT NULL                                  | Données du checkpoint |
| `created_at`           | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de création      |

**RLS:** Activé

---

### `frontend_badges`

**Description :** Table des badges disponibles (catalogue). Définit tous les badges que les enfants peuvent débloquer avec leurs descriptions, icônes et couleurs. Le système de badges récompense les enfants pour leurs accomplissements (première catégorie complétée, jeux parfaits, séries de réponses correctes, etc.).

**Rôle métier :**

- Catalogue de tous les badges disponibles dans l'application
- Définit les types de badges et leurs caractéristiques visuelles (icône, couleur)
- Permet d'activer/désactiver des badges sans les supprimer
- Gère les métadonnées des badges (nom, description, image)

**Utilisation :**

- **Frontend :** Utilisée pour afficher la liste des badges disponibles dans la collection
- **Déblocage :** Les badges sont débloqués automatiquement via les triggers PostgreSQL
- **Affichage :** Les badges actifs (`is_active=true`) sont affichés dans l'interface

**Relations clés :**

- 1:N avec `frontend_child_badges` (via `badge_id`)

**Cas d'usage spécifiques :**

- Les badges peuvent être désactivés temporairement via `is_active=false`
- Chaque badge a un type unique (`badge_type`) qui détermine les conditions de déblocage
- Les icônes et couleurs sont utilisées pour l'affichage visuel dans l'interface

| Colonne       | Type          | Contraintes                               | Description           |
| ------------- | ------------- | ----------------------------------------- | --------------------- |
| `id`          | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique    |
| `name`        | `text`        | NOT NULL                                  | Nom du badge          |
| `description` | `text`        | NULLABLE                                  | Description du badge  |
| `badge_type`  | `text`        | NOT NULL, CHECK                           | Type de badge         |
| `icon_url`    | `text`        | NULLABLE                                  | URL de l'icône        |
| `color_code`  | `text`        | NULLABLE                                  | Code couleur du badge |
| `image_url`   | `text`        | NULLABLE                                  | URL de l'image        |
| `is_active`   | `boolean`     | DEFAULT: `true`                           | Badge actif           |
| `created_at`  | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de création      |
| `updated_at`  | `timestamptz` | NULLABLE, DEFAULT: `now()`                | Date de mise à jour   |

**Types de badges :**

- `first_category_complete` : Première catégorie complétée
- `first_subject_complete` : Première matière complétée
- `first_game_perfect` : Premier jeu parfait du 1er coup
- `daily_streak_responses` : Réponses quotidiennes (5+ ou 7+)
- `consecutive_correct` : Réponses consécutives correctes (5 ou 7)
- `perfect_games_count` : Jeux parfaits cumulatifs (10 ou 13)

**RLS:** Activé

---

### `frontend_child_badges`

**Description :** Table des badges débloqués par enfant (historique avec niveaux). Enregistre quels badges ont été débloqués par chaque enfant, à quel niveau et avec quelle valeur obtenue. Un même badge peut être débloqué plusieurs fois à différents niveaux grâce au système de progression dynamique.

**Rôle métier :**

- Historique complet des badges débloqués par chaque enfant
- Suit le niveau de déblocage pour chaque badge (progression dynamique)
- Stocke la valeur obtenue lors du déblocage (ex: 10 jeux parfaits, 5 réponses consécutives)
- Permet de débloquer le même badge plusieurs fois avec des seuils croissants

**Utilisation :**

- **Frontend :** Utilisée pour afficher les badges débloqués dans la collection
- **Notification :** Utilisée pour afficher les notifications de nouveaux badges débloqués
- **Progression :** Le niveau permet de suivre la progression de l'enfant pour chaque type de badge

**Relations clés :**

- N:1 avec `children` (via `child_id`)
- N:1 avec `frontend_badges` (via `badge_id`)

**Cas d'usage spécifiques :**

- Un même badge peut être débloqué plusieurs fois (une fois par niveau)
- La contrainte UNIQUE sur `(child_id, badge_id, level)` permet plusieurs déblocages du même badge à différents niveaux
- La valeur (`value`) est utilisée pour l'affichage visuel du badge (ex: "10 jeux parfaits")

| Colonne       | Type          | Contraintes                               | Description         |
| ------------- | ------------- | ----------------------------------------- | ------------------- |
| `id`          | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique  |
| `child_id`    | `uuid`        | NOT NULL, FK → `children.id`              | Enfant              |
| `badge_id`    | `uuid`        | NOT NULL, FK → `frontend_badges.id`       | Badge               |
| `unlocked_at` | `timestamptz` | DEFAULT: `now()`                          | Date de déblocage   |
| `level`       | `integer`     | DEFAULT: `1`                              | Niveau de déblocage |
| `value`       | `integer`     | NULLABLE                                  | Valeur obtenue      |
| `created_at`  | `timestamptz` | DEFAULT: `now()`                          | Date de création    |

**RLS:** Activé

---

### `frontend_badge_levels`

**Description :** Table des niveaux de progression pour chaque badge. Suit le niveau actuel de progression pour chaque type de badge et chaque enfant. Permet de calculer les seuils dynamiques pour les prochains déblocages (valeurs croissantes de 30% par niveau).

**Rôle métier :**

- Suit la progression de l'enfant pour chaque type de badge
- Calcule les seuils dynamiques pour les prochains déblocages
- Permet de débloquer le même badge plusieurs fois avec des seuils croissants
- Formule de progression : `base × 1.3^(niveau-1)`

**Utilisation :**

- **Backend :** Utilisée par les fonctions SQL pour calculer les seuils de déblocage
- **Progression :** Le niveau est incrémenté après chaque déblocage
- **Calcul :** Les seuils sont calculés dynamiquement selon le niveau actuel

**Relations clés :**

- N:1 avec `children` (via `child_id`)

**Cas d'usage spécifiques :**

- Chaque type de badge a son propre niveau de progression
- Le niveau est incrémenté automatiquement après chaque déblocage
- Les seuils augmentent de 30% à chaque niveau (ex: 5 → 6.5 → 8.45 → ...)

| Colonne            | Type          | Contraintes                               | Description               |
| ------------------ | ------------- | ----------------------------------------- | ------------------------- |
| `id`               | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique        |
| `child_id`         | `uuid`        | NOT NULL, FK → `children.id`              | Enfant                    |
| `badge_type`       | `text`        | NOT NULL                                  | Type de badge             |
| `current_level`    | `integer`     | DEFAULT: `1`                              | Niveau actuel             |
| `last_unlocked_at` | `timestamptz` | NULLABLE                                  | Date du dernier déblocage |
| `created_at`       | `timestamptz` | DEFAULT: `now()`                          | Date de création          |
| `updated_at`       | `timestamptz` | DEFAULT: `now()`                          | Date de mise à jour       |

**RLS:** Activé

---

### `frontend_first_perfect_games`

**Description :** Table de tracking des jeux parfaits du premier coup (pour Badge 3). Enregistre les jeux réussis à 100% en première tentative pour chaque catégorie. Un jeu ne peut être enregistré qu'une seule fois par catégorie.

**Rôle métier :**

- Suit les jeux réussis à 100% en première tentative
- Permet de débloquer le badge "Parfait du premier coup"
- Un jeu ne peut être compté qu'une seule fois par catégorie

**Utilisation :**

- **Backend :** Utilisée par la fonction `check_and_unlock_badges()` pour vérifier le badge 3
- **Déblocage :** Le badge est débloqué automatiquement lors de la première tentative parfaite d'une catégorie

**Relations clés :**

- N:1 avec `children` (via `child_id`)
- N:1 avec `subject_categories` (via `subject_category_id`)
- N:1 avec `games` (via `game_id`)

| Colonne               | Type          | Contraintes                               | Description          |
| --------------------- | ------------- | ----------------------------------------- | -------------------- |
| `id`                  | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique   |
| `child_id`            | `uuid`        | NOT NULL, FK → `children.id`              | Enfant               |
| `subject_category_id` | `uuid`        | NOT NULL, FK → `subject_categories.id`    | Catégorie            |
| `game_id`             | `uuid`        | NOT NULL, FK → `games.id`                 | Jeu                  |
| `attempted_at`        | `timestamptz` | DEFAULT: `now()`                          | Date de la tentative |
| `created_at`          | `timestamptz` | DEFAULT: `now()`                          | Date de création     |

**RLS:** Activé

---

### `frontend_consecutive_responses`

**Description :** Table de tracking des réponses consécutives correctes (pour Badges 5 et 5.1). Suit le nombre de réponses consécutives correctes pour chaque enfant. Le compteur est réinitialisé à 0 en cas d'erreur.

**Rôle métier :**

- Suit les séries de réponses correctes consécutives
- Permet de débloquer les badges "Série sans erreur" (5 ou 7 consécutives)
- Réinitialise le compteur en cas d'erreur

**Utilisation :**

- **Backend :** Utilisée par la fonction `track_daily_and_consecutive_responses()` pour suivre les séries
- **Déblocage :** Les badges sont débloqués automatiquement quand le seuil est atteint

**Relations clés :**

- N:1 avec `children` (via `child_id`)

| Colonne               | Type          | Contraintes                               | Description                     |
| --------------------- | ------------- | ----------------------------------------- | ------------------------------- |
| `id`                  | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique              |
| `child_id`            | `uuid`        | NOT NULL, FK → `children.id`              | Enfant                          |
| `consecutive_count`   | `integer`     | DEFAULT: `0`                              | Nombre de réponses consécutives |
| `consecutive_7_count` | `integer`     | DEFAULT: `0`                              | Compteur pour badge 7           |
| `last_response_date`  | `timestamptz` | DEFAULT: `now()`                          | Date de la dernière réponse     |
| `created_at`          | `timestamptz` | DEFAULT: `now()`                          | Date de création                |
| `updated_at`          | `timestamptz` | DEFAULT: `now()`                          | Date de mise à jour             |

**RLS:** Activé

---

### `frontend_daily_responses`

**Description :** Table de tracking des réponses quotidiennes (pour Badges 4 et 4.1). Enregistre le nombre de bonnes réponses par jour pour chaque enfant. Les badges quotidiens peuvent être débloqués plusieurs fois (une fois par jour si la condition est remplie).

**Rôle métier :**

- Suit les bonnes réponses quotidiennes pour chaque enfant
- Permet de débloquer les badges quotidiens (5+ ou 7+ réponses/jour)
- Les badges quotidiens sont récurrents (peuvent être débloqués plusieurs fois)

**Utilisation :**

- **Backend :** Utilisée par la fonction `track_daily_and_consecutive_responses()` pour suivre les réponses quotidiennes
- **Déblocage :** Les badges quotidiens sont débloqués automatiquement chaque jour si la condition est remplie

**Relations clés :**

- N:1 avec `children` (via `child_id`)

| Colonne                   | Type          | Contraintes                               | Description                    |
| ------------------------- | ------------- | ----------------------------------------- | ------------------------------ |
| `id`                      | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique             |
| `child_id`                | `uuid`        | NOT NULL, FK → `children.id`              | Enfant                         |
| `response_date`           | `date`        | NOT NULL                                  | Date UTC des réponses          |
| `correct_responses_count` | `integer`     | DEFAULT: `0`                              | Nombre de bonnes réponses      |
| `badge_4_unlocked`        | `boolean`     | DEFAULT: `false`                          | Badge 4 débloqué aujourd'hui   |
| `badge_4_1_unlocked`      | `boolean`     | DEFAULT: `false`                          | Badge 4.1 débloqué aujourd'hui |
| `created_at`              | `timestamptz` | DEFAULT: `now()`                          | Date de création               |
| `updated_at`              | `timestamptz` | DEFAULT: `now()`                          | Date de mise à jour            |

**RLS:** Activé

---

### `frontend_perfect_games_count`

**Description :** Table de tracking des jeux parfaits cumulatifs (pour Badges 6 et 6.1). Suit le nombre total de jeux uniques réussis à 100% pour chaque enfant. Un jeu est compté une seule fois même s'il est réussi plusieurs fois.

**Rôle métier :**

- Suit le nombre total de jeux uniques réussis à 100%
- Permet de débloquer les badges "Jeux parfaits" (10 ou 13 jeux)
- Un jeu est compté une seule fois (meilleur score = 100%)

**Utilisation :**

- **Backend :** Utilisée par la fonction `track_daily_and_consecutive_responses()` pour compter les jeux parfaits
- **Déblocage :** Les badges sont débloqués automatiquement quand le seuil est atteint

**Relations clés :**

- N:1 avec `children` (via `child_id`)

| Colonne               | Type          | Contraintes                               | Description                   |
| --------------------- | ------------- | ----------------------------------------- | ----------------------------- |
| `id`                  | `uuid`        | PRIMARY KEY, DEFAULT: `gen_random_uuid()` | Identifiant unique            |
| `child_id`            | `uuid`        | NOT NULL, FK → `children.id`              | Enfant                        |
| `total_perfect_games` | `integer`     | DEFAULT: `0`                              | Nombre total de jeux parfaits |
| `badge_6_unlocked`    | `boolean`     | DEFAULT: `false`                          | Badge 6 débloqué              |
| `badge_6_1_unlocked`  | `boolean`     | DEFAULT: `false`                          | Badge 6.1 débloqué            |
| `created_at`          | `timestamptz` | DEFAULT: `now()`                          | Date de création              |
| `updated_at`          | `timestamptz` | DEFAULT: `now()`                          | Date de mise à jour           |

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
  ├── frontend_child_checkpoints (1:N)
  ├── frontend_child_badges (1:N)
  ├── frontend_badge_levels (1:N)
  ├── frontend_first_perfect_games (1:N)
  ├── frontend_consecutive_responses (1:1)
  ├── frontend_daily_responses (1:N)
  └── frontend_perfect_games_count (1:1)
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
