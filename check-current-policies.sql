-- Vérifier les politiques RLS actuelles et leur contenu
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

