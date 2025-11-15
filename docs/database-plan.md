# Documentation évolutive – Base de données éducative

## Étape 1 – Acteurs et identités

### Parents (`parents`)

- `id` (UUID, aligné sur `profiles.id`)
- `fullname`
- `email` (unique)
- `password_hash`
- `avatar_url`
- `created_at`, `updated_at`

### Enfants (`children`)

- `id`
- `firstname`, `lastname`, `nickname`
- `birthdate`
- `sex`
- `avatar_url`
- `created_at`, `updated_at`

### Lien parent ↔ enfant (`parent_children`)

- `parent_id`, `child_id`
- `relation_type` (mère, père, tuteur…)
- `is_primary`
- `created_at`
- Clé primaire composite `(parent_id, child_id)` pour autoriser plusieurs parents avec les mêmes droits.

---

## Étape 2 – Structure scolaire

### Écoles (`schools`)

- `id`, `name`
- `address`, `city`, `country`
- `metadata` (JSON pour informations libres)
- `created_at`, `updated_at`

### Années scolaires (`school_years`)

- `id`
- `school_id` (FK)
- `label` (1re, 2e…)
- `order_index`
- `is_active`
- `created_at`, `updated_at`

### Classes / Groupes (`classes`)

- `id`
- `school_id`, `school_year_id`
- `label` (ex : 4A), `capacity`
- `metadata`
- `created_at`, `updated_at`

---

## Étape 3 – Matières et catalogue pédagogique

### Matières (`subjects`)

- `id`, `name`
- `description`
- `type` (`scolaire`, `extra`, `optionnelle`)
- `default_age_range`
- `metadata`
- Timestamps standard

### Affectation matière ↔ école (`school_subjects`, optionnel)

- `id`
- `subject_id`
- `school_id`
- `school_year_id` (nullable)
- `is_mandatory`

### Questions (`questions`)

- `id`
- `subject_id`
- `question_type` (`qcm`, `vrai_faux`, etc.)
- `prompt`
- `options` (JSON)
- `answer_key` (JSON)
- `difficulty`
- `metadata`
- Timestamps standard

---

## Étape 4 – Parcours et historiques enfants

### Inscriptions (`child_enrollments`)

- `id`
- `child_id`
- `school_id`
- `school_year_id`
- `class_id` (nullable)
- `start_date`, `end_date`
- `status`, `notes`
- `payload_migration` (JSON pour conserver ce qui a déjà été fait)
- `created_at`
- Index suggéré : `(child_id, start_date)`

### Matières suivies (`child_subjects`)

- `id`
- `child_id`
- `subject_id`
- `source` (`scolaire`, `extra`, `parent`)
- `school_year_id` (nullable)
- `parent_id` (qui l’a validé)
- `start_date`, `end_date`
- `status`
- `created_at`
- Index suggéré : `(child_id, status)`

---

## Étape 5 – Professeurs et affectations

### Professeurs (`teachers`)

- `id`
- `profile_id` (vers Auth / `profiles`)
- `fullname`, `bio`, `avatar_url`
- Timestamps standard

### Affectations prof ↔ classe (`teacher_assignments`)

- `teacher_id`
- `school_id`, `school_year_id`, `class_id`
- `roles` (ARRAY : titulaire, suppléant…)
- `start_date`, `end_date`

### Affectations élève ↔ classe (`child_class_memberships`)

- `child_id`, `class_id`
- `start_date`, `end_date`
- `status`
- Utilisé si l’on veut détailler des sous-groupes ou plusieurs classes pour un même enfant.

---

## Étape 6 – Résolution des questions et suivi pédagogique

### Tentatives (`question_attempts`)

- `id`
- `child_subject_id`
- `question_id`
- `attempt_no`
- `status` (`en_cours`, `réussi`, `échoué`, `validé_prof`)
- `score`
- `response_payload` (JSON, réponses de l’enfant)
- `started_at`, `submitted_at`
- Index suggéré : `(child_subject_id, question_id)`

### Validations (`question_reviews`, optionnel)

- `id`
- `attempt_id`
- `reviewer_id` (prof ou parent)
- `feedback`
- `status`
- `reviewed_at`

### Vue agrégée (`child_subject_progress`, optionnel)

- `child_subject_id`
- `questions_answered`
- `success_rate`
- `last_activity_at`

---

## Étape 7 – Gouvernance et évolutivité

- **Colonnes standard** : ajouter partout `created_at`, `updated_at`, `deleted_at` (soft delete) si besoin.
- **Index et contraintes** : FK, unique et index composites pour sécuriser les performances.
- **RLS (Row Level Security)** :
  - Parents : accès restreint à leurs enfants via `parent_children`.
  - Professeurs : accès limité aux classes/écoles où ils sont affectés.
  - Admin : usage `service_role`.
- **Journalisation** : table `event_log` (type, payload, actor_id, created_at) pour tracer les migrations d’école/classe et déclencher des scripts d’adaptation.
- **Évolutivité** : prévoir l’ajout futur de contenus multimédias, badges, notifications en s’appuyant sur les clefs existantes.

---

### Suivi de réalisation

1. Valider ou ajuster les champs/relations pour chaque table.
2. Déterminer l’ordre de création des tables lors des migrations Supabase.
3. Définir les règles RLS et les index selon les cas d’usage.
4. Convertir progressivement cette documentation en migrations SQL lorsque les spécifications seront figées.
