-- Vérifier si l'utilisateur 8acac0dd-0db0-4eb9-9a9e-550f60355603 est le parent de l'enfant 009cda10-1f33-4aee-86da-e7fd5188583a

-- 1. Vérifier les informations de l'enfant
SELECT 
    c.id as child_id,
    c.parent_id,
    c.firstname,
    c.lastname,
    c.is_active
FROM children c
WHERE c.id = '009cda10-1f33-4aee-86da-e7fd5188583a';

-- 2. Tester la fonction check_child_parent_relationship
SELECT 
    check_child_parent_relationship(
        '009cda10-1f33-4aee-86da-e7fd5188583a'::uuid,
        '8acac0dd-0db0-4eb9-9a9e-550f60355603'::uuid
    ) as is_parent;

-- 3. Vérifier directement la relation
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM children c
            WHERE c.id = '009cda10-1f33-4aee-86da-e7fd5188583a'
            AND c.parent_id = '8acac0dd-0db0-4eb9-9a9e-550f60355603'
        ) THEN 'OUI - L''utilisateur est le parent'
        ELSE 'NON - L''utilisateur n''est pas le parent'
    END as relation_check;

