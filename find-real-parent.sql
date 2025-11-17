-- Trouver le vrai parent de l'enfant
SELECT 
    c.id as child_id,
    c.parent_id,
    c.firstname,
    c.lastname,
    p.id as parent_user_id,
    p.display_name as parent_display_name
FROM children c
LEFT JOIN profiles p ON p.id = c.parent_id
WHERE c.id = '009cda10-1f33-4aee-86da-e7fd5188583a';

-- Vérifier tous les enfants de l'utilisateur connecté
SELECT 
    c.id as child_id,
    c.firstname,
    c.lastname,
    c.parent_id
FROM children c
WHERE c.parent_id = '8acac0dd-0db0-4eb9-9a9e-550f60355603';

