-- Migration: Fonction RPC pour vérifier si un email existe déjà (hors utilisateur spécifique)
-- Cette fonction permet de vérifier si un autre utilisateur avec le même email existe dans auth.users
-- Exclut l'utilisateur spécifié par son ID pour éviter les faux positifs lors de la création

-- Supprimer l'ancienne fonction si elle existe (avec un seul paramètre)
DROP FUNCTION IF EXISTS public.check_email_exists(TEXT);

-- Créer la nouvelle fonction avec deux paramètres
CREATE OR REPLACE FUNCTION public.check_email_exists(
  email_to_check TEXT,
  exclude_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE email = email_to_check
    AND (exclude_user_id IS NULL OR id != exclude_user_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commentaire pour expliquer l'utilisation
COMMENT ON FUNCTION public.check_email_exists IS 'Vérifie si un autre utilisateur avec le même email existe dans auth.users. Exclut l''utilisateur spécifié par exclude_user_id pour éviter les faux positifs lors de la création.';

