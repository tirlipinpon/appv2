-- Migration: Ajout des colonnes avatar_seed et login_pin à la table children
-- Date: 2024

-- Ajouter les colonnes avatar_seed et login_pin
ALTER TABLE children 
ADD COLUMN IF NOT EXISTS avatar_seed TEXT,
ADD COLUMN IF NOT EXISTS login_pin VARCHAR(4);

-- Créer un index pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_children_avatar_seed_login_pin 
ON children(avatar_seed, login_pin) 
WHERE avatar_seed IS NOT NULL AND login_pin IS NOT NULL;

-- Créer une contrainte unique sur la combinaison (avatar_seed, login_pin)
-- Note: Cette contrainte permet NULL pour chaque colonne individuellement,
-- mais garantit l'unicité quand les deux sont renseignés
CREATE UNIQUE INDEX IF NOT EXISTS idx_children_unique_avatar_pin 
ON children(avatar_seed, login_pin) 
WHERE avatar_seed IS NOT NULL AND login_pin IS NOT NULL;

-- Commentaire sur les colonnes
COMMENT ON COLUMN children.avatar_seed IS 'Seed utilisé pour générer l''avatar DiceBear de l''enfant';
COMMENT ON COLUMN children.login_pin IS 'Code PIN à 4 chiffres pour la connexion de l''enfant';

