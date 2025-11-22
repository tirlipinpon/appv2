-- Migration: Ajout de la colonne avatar_style à la table children
-- Date: 2024

-- Ajouter la colonne avatar_style pour stocker le style d'avatar DiceBear utilisé
ALTER TABLE children 
ADD COLUMN IF NOT EXISTS avatar_style VARCHAR(20) DEFAULT 'fun-emoji';

-- Commentaire sur la colonne
COMMENT ON COLUMN children.avatar_style IS 'Style d''avatar DiceBear utilisé (fun-emoji ou bottts)';

