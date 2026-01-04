-- Migration pour créer le bucket de stockage pour les images de pièces de puzzle
-- et configurer les politiques RLS

-- Créer ou mettre à jour le bucket 'puzzle-images'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'puzzle-images',
  'puzzle-images',
  true, -- Public pour permettre l'accès aux images
  5242880, -- 5MB en octets
  ARRAY['image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Supprimer les anciennes politiques si elles existent (pour éviter les doublons)
DROP POLICY IF EXISTS "Allow authenticated users to upload puzzle images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to puzzle images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete puzzle images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update puzzle images" ON storage.objects;

-- Politique RLS pour permettre l'upload aux utilisateurs authentifiés
CREATE POLICY "Allow authenticated users to upload puzzle images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'puzzle-images' AND
  auth.role() = 'authenticated'
);

-- Politique RLS pour permettre la lecture publique des images
CREATE POLICY "Allow public read access to puzzle images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'puzzle-images');

-- Politique RLS pour permettre la suppression aux utilisateurs authentifiés
CREATE POLICY "Allow authenticated users to delete puzzle images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'puzzle-images' AND
  auth.role() = 'authenticated'
);

-- Politique RLS pour permettre la mise à jour aux utilisateurs authentifiés
CREATE POLICY "Allow authenticated users to update puzzle images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'puzzle-images' AND
  auth.role() = 'authenticated'
);
