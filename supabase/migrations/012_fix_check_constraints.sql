-- Migration: Correction des contraintes CHECK
-- Date: 2024-12-XX
-- Description: Corrige les problèmes de contraintes CHECK identifiés dans le schéma
-- 
-- Problèmes corrigés:
-- 1. Pattern regex `|)` qui permet chaîne vide dans children et teacher_assignments
-- 2. Contraintes CHECK dupliquées
-- 3. teacher_assignments: DEFAULT '' + NOT NULL + CHECK avec IS NULL (incohérence)
-- 4. school_level_subjects: Ajout de 'Autre' pour cohérence avec autres tables
-- 5. questions et subjects: Ajout gestion NULL explicite dans les CHECK

BEGIN;

-- ============================================================================
-- 1. CORRECTION: children.school_level
-- ============================================================================
-- Problème: Pattern `|)` permet chaîne vide + contrainte dupliquée
-- Solution: Supprimer les contraintes existantes et créer une nouvelle propre

-- Supprimer toutes les contraintes existantes (y compris les doublons)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
        AND table_name = 'children' 
        AND constraint_name LIKE '%school_level%'
        AND constraint_type = 'CHECK'
    ) LOOP
        EXECUTE 'ALTER TABLE children DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

-- Créer la nouvelle contrainte propre (NULL autorisé, pattern ancré sans |))
ALTER TABLE children
  ADD CONSTRAINT children_school_level_check 
  CHECK (school_level IS NULL OR school_level ~ '^(M[1-3]|P[1-6]|S[1-6]|Autre)$');

-- ============================================================================
-- 2. CORRECTION: teacher_assignments.school_level
-- ============================================================================
-- Problème: Pattern `|)` + DEFAULT '' + NOT NULL + CHECK avec IS NULL (incohérence)
-- Solution: Supprimer IS NULL du CHECK car la colonne est NOT NULL avec DEFAULT ''

-- Supprimer toutes les contraintes existantes
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
        AND table_name = 'teacher_assignments' 
        AND constraint_name LIKE '%school_level%'
        AND constraint_type = 'CHECK'
    ) LOOP
        EXECUTE 'ALTER TABLE teacher_assignments DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

-- Créer la nouvelle contrainte (pas de IS NULL car NOT NULL avec DEFAULT '')
-- Pattern: '^(M[1-3]|P[1-6]|S[1-6]|Autre)$' rejette les chaînes vides (sans | avant $)
ALTER TABLE teacher_assignments
  ADD CONSTRAINT teacher_assignments_school_level_check 
  CHECK (school_level ~ '^(M[1-3]|P[1-6]|S[1-6]|Autre)$');

-- ============================================================================
-- 3. CORRECTION: school_level_subjects.school_level
-- ============================================================================
-- Problème: Pas de 'Autre' alors que les autres tables l'ont
-- Solution: Ajouter 'Autre' pour cohérence

-- Supprimer la contrainte existante
ALTER TABLE school_level_subjects
  DROP CONSTRAINT IF EXISTS school_level_subjects_valid_level_check;

-- Créer la nouvelle contrainte avec 'Autre'
ALTER TABLE school_level_subjects
  ADD CONSTRAINT school_level_subjects_school_level_check 
  CHECK (school_level ~ '^(M[1-3]|P[1-6]|S[1-6]|Autre)$');

-- ============================================================================
-- 4. CORRECTION: questions.question_type
-- ============================================================================
-- Problème: Utilise = ANY sans gestion NULL explicite
-- Solution: Ajouter gestion NULL explicite pour clarté

ALTER TABLE questions
  DROP CONSTRAINT IF EXISTS questions_question_type_check;

ALTER TABLE questions
  ADD CONSTRAINT questions_question_type_check 
  CHECK (question_type IS NULL OR question_type = ANY (ARRAY['qcm'::text, 'vrai_faux'::text, 'texte'::text, 'numerique'::text]));

-- ============================================================================
-- 5. CORRECTION: questions.difficulty
-- ============================================================================
-- Problème: Utilise = ANY sans gestion NULL explicite
-- Solution: Ajouter gestion NULL explicite pour clarté

ALTER TABLE questions
  DROP CONSTRAINT IF EXISTS questions_difficulty_check;

ALTER TABLE questions
  ADD CONSTRAINT questions_difficulty_check 
  CHECK (difficulty IS NULL OR difficulty = ANY (ARRAY['facile'::text, 'moyen'::text, 'difficile'::text]));

-- ============================================================================
-- 6. CORRECTION: subjects.type
-- ============================================================================
-- Problème: Utilise = ANY sans gestion NULL explicite
-- Solution: Ajouter gestion NULL explicite pour clarté

ALTER TABLE subjects
  DROP CONSTRAINT IF EXISTS subjects_type_check;

ALTER TABLE subjects
  ADD CONSTRAINT subjects_type_check 
  CHECK (type IS NULL OR type = ANY (ARRAY['scolaire'::text, 'extra'::text, 'optionnelle'::text]));

COMMIT;
