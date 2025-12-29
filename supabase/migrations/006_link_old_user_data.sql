-- Migration: Lier les données de l'ancien utilisateur (Supabase Auth) vers le nouvel utilisateur (Custom Auth)
-- Date: 2025-12-29
-- Objectif: Transférer toutes les données de l'ancien utilisateur vers le nouvel utilisateur pour tony-ster@hotmail.com

-- ============================================================================
-- ÉTAPE 1: Identifier les IDs des deux utilisateurs
-- ============================================================================
-- Ancien utilisateur (Supabase Auth): ID dans auth.users
-- Nouvel utilisateur (Custom Auth): ID dans public.users
-- 
-- Vous devez remplacer ces valeurs par les vrais IDs:
-- - OLD_USER_ID: L'ID de l'utilisateur dans auth.users (ex: '8acac0dd-0db0-4eb9-9a9e-550f60355603')
-- - NEW_USER_ID: L'ID de l'utilisateur dans public.users (ex: '81d8506e-7907-489e-9961-a9320d38465f')

DO $$
DECLARE
  old_user_id UUID;
  new_user_id UUID;
  old_user_email TEXT := 'tony-ster@hotmail.com';
BEGIN
  -- Récupérer l'ID de l'ancien utilisateur depuis auth.users
  SELECT id INTO old_user_id
  FROM auth.users
  WHERE email = old_user_email
  LIMIT 1;

  -- Récupérer l'ID du nouvel utilisateur depuis public.users
  SELECT id INTO new_user_id
  FROM public.users
  WHERE email = old_user_email
  LIMIT 1;

  -- Vérifier que les deux utilisateurs existent
  IF old_user_id IS NULL THEN
    RAISE EXCEPTION 'Ancien utilisateur non trouvé dans auth.users pour %', old_user_email;
  END IF;

  IF new_user_id IS NULL THEN
    RAISE EXCEPTION 'Nouvel utilisateur non trouvé dans public.users pour %', old_user_email;
  END IF;

  RAISE NOTICE 'Migration des données de % vers %', old_user_id, new_user_id;

  -- ============================================================================
  -- ÉTAPE 2: Mettre à jour le profil (profiles)
  -- ============================================================================
  -- Si le profil de l'ancien utilisateur existe, transférer ses données vers le nouveau profil
  UPDATE public.profiles
  SET 
    roles = COALESCE(
      (SELECT roles FROM public.profiles WHERE id = old_user_id),
      roles
    ),
    display_name = COALESCE(
      (SELECT display_name FROM public.profiles WHERE id = old_user_id),
      display_name
    ),
    avatar_url = COALESCE(
      (SELECT avatar_url FROM public.profiles WHERE id = old_user_id),
      avatar_url
    ),
    metadata = COALESCE(
      (SELECT metadata FROM public.profiles WHERE id = old_user_id),
      metadata
    )
  WHERE id = new_user_id;

  -- Supprimer l'ancien profil s'il existe (après avoir transféré les données)
  DELETE FROM public.profiles WHERE id = old_user_id;

  -- ============================================================================
  -- ÉTAPE 3: Mettre à jour la table teachers (si l'utilisateur est professeur)
  -- ============================================================================
  -- Mettre à jour profile_id dans teachers pour pointer vers le nouvel utilisateur
  UPDATE public.teachers
  SET profile_id = new_user_id
  WHERE profile_id = old_user_id;

  -- ============================================================================
  -- ÉTAPE 4: Mettre à jour la table children (si l'utilisateur est parent)
  -- ============================================================================
  -- Mettre à jour parent_id dans children pour pointer vers le nouvel utilisateur
  UPDATE public.children
  SET parent_id = new_user_id
  WHERE parent_id = old_user_id;

  -- ============================================================================
  -- ÉTAPE 5: Mettre à jour toutes les autres tables qui référencent l'utilisateur
  -- ============================================================================
  -- Note: Ajoutez ici toutes les autres tables qui ont des foreign keys vers profiles ou auth.users
  
  -- Exemple pour d'autres tables (à adapter selon votre schéma):
  -- UPDATE table_name
  -- SET user_id = new_user_id
  -- WHERE user_id = old_user_id;

  RAISE NOTICE 'Migration terminée avec succès';
  RAISE NOTICE 'Ancien ID: %', old_user_id;
  RAISE NOTICE 'Nouvel ID: %', new_user_id;

END $$;

-- ============================================================================
-- VÉRIFICATION: Afficher les données migrées
-- ============================================================================
-- Vérifier que le profil du nouvel utilisateur contient bien les données
SELECT 
  'Profil nouvel utilisateur' as check_type,
  id,
  roles,
  display_name,
  created_at
FROM public.profiles
WHERE id = (SELECT id FROM public.users WHERE email = 'tony-ster@hotmail.com');

-- Vérifier les enfants liés
SELECT 
  'Enfants liés' as check_type,
  id,
  COALESCE(firstname || ' ' || lastname, 'Sans nom') as name,
  parent_id
FROM public.children
WHERE parent_id = (SELECT id FROM public.users WHERE email = 'tony-ster@hotmail.com');

-- Vérifier si l'utilisateur est professeur
SELECT 
  'Professeur' as check_type,
  t.id,
  t.profile_id,
  p.roles
FROM public.teachers t
JOIN public.profiles p ON t.profile_id = p.id
WHERE p.id = (SELECT id FROM public.users WHERE email = 'tony-ster@hotmail.com');

