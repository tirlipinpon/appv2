-- ============================================
-- MIGRATION COMPLÈTE POUR L'APPLICATION ÉDUCATIVE
-- ============================================
-- Copiez ce fichier complet dans l'éditeur SQL de Supabase
-- et exécutez-le d'un coup pour créer toutes les structures nécessaires
-- ============================================

-- 1. CRÉATION DE LA TABLE PROFILES
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    roles TEXT[] DEFAULT '{}',
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles(id);

-- 2. ACTIVATION DE ROW-LEVEL SECURITY
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Supprimer les policies existantes si elles existent (pour éviter les erreurs)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Policy SELECT : un utilisateur peut voir son propre profil
CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Policy UPDATE : un utilisateur peut modifier son propre profil
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Policy INSERT : un utilisateur peut créer son propre profil (via trigger ou RPC)
CREATE POLICY "Users can insert own profile"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- 3. FONCTION POUR METTRE À JOUR updated_at AUTOMATIQUEMENT
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Supprimer le trigger existant s'il existe
DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;

-- Trigger pour mettre à jour updated_at
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 4. FONCTION ET TRIGGER POUR CRÉER AUTOMATIQUEMENT UN PROFIL
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, roles)
    VALUES (NEW.id, '{}'::TEXT[])
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supprimer le trigger existant s'il existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Trigger sur auth.users pour créer automatiquement un profil
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 5. FONCTION RPC : create_profile_after_signup
-- ============================================
-- Cette fonction permet de créer ou mettre à jour un profil avec des rôles spécifiques
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
                SELECT array_agg(DISTINCT role)
                FROM unnest(existing_roles || roles_array) AS role
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

-- 6. FONCTION RPC : add_role_to_profile
-- ============================================
-- Cette fonction permet d'ajouter un rôle à un profil existant
CREATE OR REPLACE FUNCTION public.add_role_to_profile(
    user_id UUID,
    new_role TEXT
)
RETURNS public.profiles AS $$
DECLARE
    valid_roles TEXT[] := ARRAY['parent', 'prof', 'admin'];
    current_roles TEXT[];
    result_profile public.profiles;
    is_admin BOOLEAN;
BEGIN
    -- Vérifier que le rôle est valide
    IF NOT (new_role = ANY(valid_roles)) THEN
        RAISE EXCEPTION 'Invalid role: %. Valid roles are: parent, prof, admin', new_role;
    END IF;

    -- Récupérer les rôles actuels
    SELECT roles INTO current_roles
    FROM public.profiles
    WHERE id = user_id;

    -- Si le profil n'existe pas, le créer
    IF current_roles IS NULL THEN
        INSERT INTO public.profiles (id, roles, updated_at)
        VALUES (user_id, ARRAY[new_role], NOW())
        RETURNING * INTO result_profile;
        RETURN result_profile;
    END IF;

    -- Vérifier si l'utilisateur est admin
    SELECT 'admin' = ANY(current_roles) INTO is_admin;

    -- Sécurité : seul un admin peut ajouter le rôle 'admin'
    IF new_role = 'admin' AND NOT is_admin THEN
        RAISE EXCEPTION 'Only admins can add the admin role';
    END IF;

    -- Vérifier que le rôle n'est pas déjà présent
    IF new_role = ANY(current_roles) THEN
        RAISE EXCEPTION 'Role % is already assigned to this user', new_role;
    END IF;

    -- Ajouter le rôle au tableau
    UPDATE public.profiles
    SET 
        roles = array_append(roles, new_role),
        updated_at = NOW()
    WHERE id = user_id
    RETURNING * INTO result_profile;

    RETURN result_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FIN DE LA MIGRATION
-- ============================================
-- Vérifications à faire après l'exécution :
-- 1. SELECT * FROM public.profiles LIMIT 1; (doit fonctionner)
-- 2. SELECT routine_name FROM information_schema.routines 
--    WHERE routine_schema = 'public' 
--    AND routine_name IN ('create_profile_after_signup', 'add_role_to_profile');
--    (doit retourner 2 lignes)
-- 3. SELECT * FROM pg_policies WHERE tablename = 'profiles';
--    (doit retourner 3 policies)
-- ============================================

