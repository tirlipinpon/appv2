-- Rollback Migration: 012_fix_check_constraints
-- Date: 2024-12-XX
-- Description: Restaure les contraintes CHECK à leur état précédent
-- 
-- ATTENTION: Ce rollback restaure les contraintes avec leurs problèmes d'origine
-- (patterns `|)`, contraintes dupliquées, etc.)

BEGIN;

-- ============================================================================
-- 1. ROLLBACK: children.school_level
-- ============================================================================

ALTER TABLE children
  DROP CONSTRAINT IF EXISTS children_school_level_check;

-- Restaurer la contrainte originale (avec le problème |))
ALTER TABLE children
  ADD CONSTRAINT valid_school_level 
  CHECK ((school_level IS NULL) OR (school_level ~ '^(M[1-3]|P[1-6]|S[1-6]|Autre|)$'::text));

-- ============================================================================
-- 2. ROLLBACK: teacher_assignments.school_level
-- ============================================================================

ALTER TABLE teacher_assignments
  DROP CONSTRAINT IF EXISTS teacher_assignments_school_level_check;

-- Restaurer la contrainte originale (avec le problème |) et IS NULL)
ALTER TABLE teacher_assignments
  ADD CONSTRAINT valid_school_level 
  CHECK ((school_level IS NULL) OR (school_level ~ '^(M[1-3]|P[1-6]|S[1-6]|Autre|)$'::text));

-- ============================================================================
-- 3. ROLLBACK: school_level_subjects.school_level
-- ============================================================================

ALTER TABLE school_level_subjects
  DROP CONSTRAINT IF EXISTS school_level_subjects_school_level_check;

-- Restaurer la contrainte originale (sans 'Autre')
ALTER TABLE school_level_subjects
  ADD CONSTRAINT school_level_subjects_valid_level_check 
  CHECK (school_level ~ '^(M[1-3]|P[1-6]|S[1-6])$'::text);

-- ============================================================================
-- 4. ROLLBACK: questions.question_type
-- ============================================================================

ALTER TABLE questions
  DROP CONSTRAINT IF EXISTS questions_question_type_check;

-- Restaurer la contrainte originale (sans gestion NULL explicite)
ALTER TABLE questions
  ADD CONSTRAINT questions_question_type_check 
  CHECK (question_type = ANY (ARRAY['qcm'::text, 'vrai_faux'::text, 'texte'::text, 'numerique'::text]));

-- ============================================================================
-- 5. ROLLBACK: questions.difficulty
-- ============================================================================

ALTER TABLE questions
  DROP CONSTRAINT IF EXISTS questions_difficulty_check;

-- Restaurer la contrainte originale (sans gestion NULL explicite)
ALTER TABLE questions
  ADD CONSTRAINT questions_difficulty_check 
  CHECK (difficulty = ANY (ARRAY['facile'::text, 'moyen'::text, 'difficile'::text]));

-- ============================================================================
-- 6. ROLLBACK: subjects.type
-- ============================================================================

ALTER TABLE subjects
  DROP CONSTRAINT IF EXISTS subjects_type_check;

-- Restaurer la contrainte originale (sans gestion NULL explicite)
ALTER TABLE subjects
  ADD CONSTRAINT subjects_type_check 
  CHECK (type = ANY (ARRAY['scolaire'::text, 'extra'::text, 'optionnelle'::text]));

COMMIT;
