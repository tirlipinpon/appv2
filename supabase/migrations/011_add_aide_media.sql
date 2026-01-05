-- Migration pour ajouter les colonnes de médias d'aide aux jeux
-- et créer le bucket de stockage pour les images d'aide

-- Ajouter les colonnes aide_image_url et aide_video_url à la table games
ALTER TABLE games
ADD COLUMN IF NOT EXISTS aide_image_url TEXT,
ADD COLUMN IF NOT EXISTS aide_video_url TEXT;

-- Créer ou mettre à jour le bucket 'aides-images'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'aides-images',
  'aides-images',
  true, -- Public pour permettre l'accès aux images
  10485760, -- 10MB en octets
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Supprimer les anciennes politiques si elles existent (pour éviter les doublons)
DROP POLICY IF EXISTS "Allow authenticated users to upload aide images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to aide images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete aide images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update aide images" ON storage.objects;

-- Politique RLS pour permettre l'upload aux utilisateurs authentifiés
CREATE POLICY "Allow authenticated users to upload aide images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'aides-images' AND
  auth.role() = 'authenticated'
);

-- Politique RLS pour permettre la lecture publique des images
CREATE POLICY "Allow public read access to aide images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'aides-images');

-- Politique RLS pour permettre la suppression aux utilisateurs authentifiés
CREATE POLICY "Allow authenticated users to delete aide images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'aides-images' AND
  auth.role() = 'authenticated'
);

-- Politique RLS pour permettre la mise à jour aux utilisateurs authentifiés
CREATE POLICY "Allow authenticated users to update aide images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'aides-images' AND
  auth.role() = 'authenticated'
);
