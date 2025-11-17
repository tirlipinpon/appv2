-- Tester la fonction check_child_parent_relationship pour le child_id spécifique
-- Remplacez YOUR_USER_ID par l'ID de l'utilisateur connecté (parent)

-- 1. Vérifier qui est le parent de l'enfant
SELECT 
    c.id as child_id,
    c.parent_id,
    c.first_name,
    c.last_name,
    p.email as parent_email,
    p.id as parent_user_id
FROM children c
LEFT JOIN auth.users u ON u.id = c.parent_id
LEFT JOIN profiles p ON p.id = c.parent_id
WHERE c.id = '009cda10-1f33-4aee-86da-e7fd5188583a';

-- 2. Tester la fonction avec l'ID du parent trouvé ci-dessus
-- (Remplacez PARENT_USER_ID par l'ID trouvé dans la requête ci-dessus)
SELECT 
    check_child_parent_relationship(
        '009cda10-1f33-4aee-86da-e7fd5188583a'::uuid,
        (SELECT parent_id FROM children WHERE id = '009cda10-1f33-4aee-86da-e7fd5188583a')::uuid
    ) as function_result;

-- 3. Vérifier les enrollments avec auth.uid() (doit être exécuté en tant qu'utilisateur connecté)
SELECT 
    cse.*,
    c.parent_id,
    auth.uid() as current_user_id,
    (c.parent_id = auth.uid()) as is_parent
FROM child_subject_enrollments cse
INNER JOIN children c ON c.id = cse.child_id
WHERE cse.child_id = '009cda10-1f33-4aee-86da-e7fd5188583a';

