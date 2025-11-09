-- Migration: Correction de la fonction create_profile_after_signup
-- Pour mieux gérer les cas où l'utilisateur ou le profil existe déjà

-- Fonction RPC améliorée : create_profile_after_signup
CREATE OR REPLACE FUNCTION public.create_profile_after_signup(
    user_id UUID,
    roles_array TEXT[],
    metadata_json JSONB DEFAULT NULL
)
RETURNS public.profiles AS $$
DECLARE
    valid_roles TEXT[] := ARRAY['parent', 'prof', 'admin'];
    role TEXT;
    result_profile public.profiles;
    existing_roles TEXT[];
BEGIN
    -- Vérifier que l'utilisateur existe dans auth.users
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_id) THEN
        RAISE EXCEPTION 'User with id % does not exist in auth.users', user_id;
    END IF;

    -- Valider que tous les rôles fournis sont valides
    FOREACH role IN ARRAY roles_array
    LOOP
        IF NOT (role = ANY(valid_roles)) THEN
            RAISE EXCEPTION 'Invalid role: %. Valid roles are: parent, prof, admin', role;
        END IF;
    END LOOP;

    -- Vérifier si le profil existe déjà
    SELECT roles INTO existing_roles
    FROM public.profiles
    WHERE id = user_id;

    IF existing_roles IS NOT NULL THEN
        -- Le profil existe déjà, fusionner les rôles (ajouter ceux qui n'existent pas)
        UPDATE public.profiles
        SET 
            roles = (
                SELECT array_agg(DISTINCT r)
                FROM unnest(existing_roles || roles_array) AS r
            ),
            metadata = COALESCE(metadata_json, profiles.metadata),
            updated_at = NOW()
        WHERE id = user_id
        RETURNING * INTO result_profile;
    ELSE
        -- Créer un nouveau profil avec les rôles spécifiés
        INSERT INTO public.profiles (id, roles, metadata, updated_at)
        VALUES (user_id, roles_array, metadata_json, NOW())
        RETURNING * INTO result_profile;
    END IF;

    RETURN result_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

