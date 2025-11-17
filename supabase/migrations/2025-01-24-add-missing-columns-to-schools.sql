-- Ajouter les colonnes manquantes à la table schools
-- Le type TypeScript School inclut country et metadata, mais ces colonnes n'existaient pas dans la DB

-- Ajouter la colonne country
ALTER TABLE schools
ADD COLUMN IF NOT EXISTS country TEXT;

COMMENT ON COLUMN schools.country IS 'Pays de l''école';

-- Ajouter la colonne metadata
ALTER TABLE schools
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN schools.metadata IS 'Métadonnées supplémentaires de l''école (JSON)';

-- Vérifier la structure finale
DO $$
DECLARE
    has_country BOOLEAN;
    has_metadata BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'schools'
        AND column_name = 'country'
    ) INTO has_country;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'schools'
        AND column_name = 'metadata'
    ) INTO has_metadata;
    
    IF has_country AND has_metadata THEN
        RAISE NOTICE '✅ Colonnes country et metadata ajoutées avec succès à la table schools';
    ELSE
        RAISE WARNING '⚠️ Certaines colonnes n''ont pas été ajoutées: country=%, metadata=%', has_country, has_metadata;
    END IF;
END $$;

