-- ⚠️ ATTENTION : Cette migration vide TOUTES les tables de données
-- Utilisée pour repartir d'une base de données propre pour les tests et le debug
-- Ne pas exécuter en production !

-- Désactiver temporairement les triggers pour éviter les problèmes
SET session_replication_role = 'replica';

-- Ordre de suppression basé sur les dépendances de clés étrangères
-- 1. Tables avec le plus de dépendances (feuilles de l'arbre)
TRUNCATE TABLE child_subject_enrollments CASCADE;
TRUNCATE TABLE teacher_assignments CASCADE;
TRUNCATE TABLE questions CASCADE;
TRUNCATE TABLE school_level_subjects CASCADE;
TRUNCATE TABLE classes CASCADE;

-- 2. Tables intermédiaires
TRUNCATE TABLE children CASCADE;
TRUNCATE TABLE parents CASCADE;
TRUNCATE TABLE teachers CASCADE;
TRUNCATE TABLE school_years CASCADE;

-- 3. Tables de base (racines)
TRUNCATE TABLE schools CASCADE;
TRUNCATE TABLE subjects CASCADE;

-- ⚠️ NE PAS VIDER profiles car c'est lié à auth.users
-- Les profils utilisateurs doivent rester pour l'authentification
-- Si vous voulez nettoyer les profils, faites-le manuellement avec précaution

-- Réactiver les triggers
SET session_replication_role = 'origin';

-- Vérifier que les tables sont vides
DO $$
DECLARE
    table_name TEXT;
    row_count INTEGER;
    total_rows INTEGER := 0;
BEGIN
    FOR table_name IN 
        SELECT unnest(ARRAY[
            'child_subject_enrollments',
            'teacher_assignments',
            'questions',
            'school_level_subjects',
            'classes',
            'children',
            'parents',
            'teachers',
            'school_years',
            'schools',
            'subjects'
        ])
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I', table_name) INTO row_count;
        total_rows := total_rows + row_count;
        IF row_count > 0 THEN
            RAISE WARNING 'Table % contient encore % lignes', table_name, row_count;
        END IF;
    END LOOP;
    
    IF total_rows = 0 THEN
        RAISE NOTICE '✅ Toutes les tables ont été vidées avec succès';
    ELSE
        RAISE WARNING '⚠️ Il reste encore des données dans certaines tables (total: % lignes)', total_rows;
    END IF;
END $$;

