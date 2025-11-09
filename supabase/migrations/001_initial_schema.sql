-- Migration: Création de la table profiles et fonctions associées

-- Création de la table profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    roles TEXT[] DEFAULT '{}',
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Création d'un index sur l'id (déjà couvert par la PK, mais utile pour les jointures)
CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles(id);

-- Activation de Row-Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

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

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour updated_at
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Fonction pour créer automatiquement un profil lors de l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, roles)
    VALUES (NEW.id, '{}'::TEXT[]);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger sur auth.users pour créer automatiquement un profil
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Fonction RPC pour créer/mettre à jour un profil avec rôles après signup
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
BEGIN
    -- Valider que tous les rôles fournis sont valides
    FOREACH role IN ARRAY roles_array
    LOOP
        IF NOT (role = ANY(valid_roles)) THEN
            RAISE EXCEPTION 'Invalid role: %. Valid roles are: parent, prof, admin', role;
        END IF;
    END LOOP;

    -- Créer ou mettre à jour le profil avec les rôles spécifiés
    INSERT INTO public.profiles (id, roles, metadata, updated_at)
    VALUES (user_id, roles_array, metadata_json, NOW())
    ON CONFLICT (id) 
    DO UPDATE SET
        roles = roles_array,
        metadata = COALESCE(metadata_json, profiles.metadata),
        updated_at = NOW()
    RETURNING * INTO result_profile;

    RETURN result_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction RPC pour ajouter un rôle à un profil existant
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

