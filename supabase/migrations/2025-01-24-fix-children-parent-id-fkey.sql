-- Correction de la contrainte de clé étrangère children.parent_id
-- Le code Angular utilise auth.users.id comme parent_id, mais la contrainte référence parents.id
-- Solution : 
--   1. Mettre à jour les données existantes pour qu'elles pointent vers profiles.id
--   2. Changer la contrainte pour référencer profiles.id (qui = auth.users.id)

-- Étape 1 : Supprimer l'ancienne contrainte AVANT de mettre à jour les données
ALTER TABLE children
DROP CONSTRAINT IF EXISTS children_parent_id_fkey;

-- Étape 2 : Mettre à jour les parent_id dans children pour qu'ils pointent vers profiles.id
-- Les parent_id actuels pointent vers parents.id, mais ils doivent pointer vers parents.profile_id (= profiles.id)
UPDATE children c
SET parent_id = p.profile_id
FROM parents p
WHERE c.parent_id = p.id
AND c.parent_id IS NOT NULL
AND p.profile_id IS NOT NULL
AND c.parent_id != p.profile_id;

-- Étape 3 : Créer une nouvelle contrainte qui référence profiles.id
-- Note: profiles.id = auth.users.id dans Supabase
ALTER TABLE children
ADD CONSTRAINT children_parent_id_fkey
FOREIGN KEY (parent_id)
REFERENCES profiles(id)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- Vérifier que tous les parent_id sont maintenant valides
DO $$
DECLARE
    invalid_count INTEGER;
    total_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_count FROM children WHERE parent_id IS NOT NULL;
    SELECT COUNT(*) INTO invalid_count
    FROM children c
    WHERE c.parent_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM profiles p WHERE p.id = c.parent_id
    );
    
    RAISE NOTICE 'Total children avec parent_id: %, Invalides: %', total_count, invalid_count;
    
    IF invalid_count > 0 THEN
        RAISE WARNING 'Il y a encore % enregistrements dans children avec un parent_id invalide', invalid_count;
    ELSE
        RAISE NOTICE '✅ Tous les parent_id dans children sont maintenant valides';
    END IF;
END $$;

