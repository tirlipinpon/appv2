-- Vérifier les politiques RLS sur child_subject_enrollments
-- Exécutez ce script dans l'éditeur SQL de Supabase

SELECT 
    policyname,
    cmd,
    CASE WHEN qual IS NOT NULL THEN 'OUI' ELSE 'NON' END as has_qual,
    CASE WHEN with_check IS NOT NULL THEN 'OUI' ELSE 'NON' END as has_with_check,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'child_subject_enrollments'
ORDER BY policyname;

-- Vérifier aussi si la fonction check_child_parent_relationship existe
SELECT 
    proname as function_name,
    pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'check_child_parent_relationship';

