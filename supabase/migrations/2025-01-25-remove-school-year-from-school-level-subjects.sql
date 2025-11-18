-- Supprimer la colonne school_year_id de la table school_level_subjects
-- Les matières sont liées uniquement à une école et un niveau, pas à une année

-- Supprimer la contrainte de clé étrangère d'abord
ALTER TABLE school_level_subjects
DROP CONSTRAINT IF EXISTS school_level_subjects_school_year_id_fkey;

-- Supprimer les index liés
DROP INDEX IF EXISTS idx_school_level_subjects_school_year_id;
DROP INDEX IF EXISTS idx_school_level_subjects_school_level_year;

-- Supprimer la colonne
ALTER TABLE school_level_subjects
DROP COLUMN IF EXISTS school_year_id;

