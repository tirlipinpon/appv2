-- Modification des triggers pour exclure les matières "extra" et "optionnelle" de l'assignation automatique
-- Seules les matières de type "scolaire" sont assignées automatiquement aux enfants
-- Les parents doivent choisir manuellement les matières extra-scolaires et optionnelles

-- Fonction pour synchroniser les enrollments lors de l'insertion d'une affectation
-- MODIFIÉ : Ne crée des enrollments que pour les matières de type "scolaire"
CREATE OR REPLACE FUNCTION sync_enrollments_on_assignment_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Quand un prof crée une affectation, créer les enrollments pour tous les enfants
  -- ayant la même school_id et school_level, mais SEULEMENT pour les matières "scolaire"
  -- Les matières "extra" et "optionnelle" doivent être choisies manuellement par les parents
  IF NEW.school_id IS NOT NULL AND NEW.school_level IS NOT NULL AND NEW.deleted_at IS NULL THEN
    INSERT INTO child_subject_enrollments (child_id, school_id, school_year_id, subject_id, selected)
    SELECT 
      c.id,
      NEW.school_id,
      NEW.school_year_id,
      NEW.subject_id,
      true -- activé par défaut
    FROM children c
    INNER JOIN subjects s ON s.id = NEW.subject_id
    WHERE c.school_id = NEW.school_id
      AND c.school_level = NEW.school_level
      AND c.is_active = true
      AND s.type = 'scolaire' -- SEULEMENT les matières scolaires sont assignées automatiquement
      -- Ne créer que si l'enrollment n'existe pas déjà (éviter d'écraser un choix parent)
      AND NOT EXISTS (
        SELECT 1 FROM child_subject_enrollments cse
        WHERE cse.child_id = c.id
        AND cse.subject_id = NEW.subject_id
      )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour synchroniser les enrollments lors de la mise à jour d'une affectation
-- MODIFIÉ : Ne crée des enrollments que pour les matières de type "scolaire"
CREATE OR REPLACE FUNCTION sync_enrollments_on_assignment_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Si l'affectation est soft-deleted, supprimer les enrollments correspondants
  -- MAIS seulement pour les matières scolaires (les parents peuvent garder leurs choix pour extra/optionnelle)
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    -- Supprimer les enrollments créés automatiquement (on garde ceux créés manuellement par les parents)
    -- On identifie les enrollments automatiques par le fait qu'ils correspondent exactement à l'affectation
    -- ET que la matière est de type "scolaire"
    DELETE FROM child_subject_enrollments cse
    WHERE cse.school_id = OLD.school_id
      AND cse.subject_id = OLD.subject_id
      AND EXISTS (
        SELECT 1 FROM subjects s
        WHERE s.id = OLD.subject_id
        AND s.type = 'scolaire'
      )
      AND cse.child_id IN (
        SELECT id FROM children
        WHERE school_id = OLD.school_id
        AND school_level = OLD.school_level
        AND is_active = true
      );
    RETURN NEW;
  END IF;

  -- Si l'affectation est réactivée (deleted_at passe de NOT NULL à NULL)
  -- MODIFIÉ : Ne recréer que pour les matières scolaires
  IF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
    -- Recréer les enrollments comme pour un INSERT, mais seulement pour les matières scolaires
    INSERT INTO child_subject_enrollments (child_id, school_id, school_year_id, subject_id, selected)
    SELECT 
      c.id,
      NEW.school_id,
      NEW.school_year_id,
      NEW.subject_id,
      true
    FROM children c
    INNER JOIN subjects s ON s.id = NEW.subject_id
    WHERE c.school_id = NEW.school_id
      AND c.school_level = NEW.school_level
      AND c.is_active = true
      AND s.type = 'scolaire' -- SEULEMENT les matières scolaires
      AND NOT EXISTS (
        SELECT 1 FROM child_subject_enrollments cse
        WHERE cse.child_id = c.id
        AND cse.subject_id = NEW.subject_id
      )
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  -- Si le subject_id change, supprimer l'ancien et créer le nouveau
  -- MODIFIÉ : Ne créer que pour les matières scolaires
  IF NEW.subject_id != OLD.subject_id AND NEW.deleted_at IS NULL THEN
    -- Supprimer les enrollments de l'ancienne matière (seulement si c'était une matière scolaire)
    DELETE FROM child_subject_enrollments cse
    WHERE cse.school_id = OLD.school_id
      AND cse.subject_id = OLD.subject_id
      AND EXISTS (
        SELECT 1 FROM subjects s
        WHERE s.id = OLD.subject_id
        AND s.type = 'scolaire'
      )
      AND cse.child_id IN (
        SELECT id FROM children
        WHERE school_id = OLD.school_id
        AND school_level = OLD.school_level
        AND is_active = true
      );
    
    -- Créer les enrollments pour la nouvelle matière (seulement si c'est une matière scolaire)
    INSERT INTO child_subject_enrollments (child_id, school_id, school_year_id, subject_id, selected)
    SELECT 
      c.id,
      NEW.school_id,
      NEW.school_year_id,
      NEW.subject_id,
      true
    FROM children c
    INNER JOIN subjects s ON s.id = NEW.subject_id
    WHERE c.school_id = NEW.school_id
      AND c.school_level = NEW.school_level
      AND c.is_active = true
      AND s.type = 'scolaire' -- SEULEMENT les matières scolaires
      AND NOT EXISTS (
        SELECT 1 FROM child_subject_enrollments cse
        WHERE cse.child_id = c.id
        AND cse.subject_id = NEW.subject_id
      )
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  -- Si school_id ou school_level change, mettre à jour les enrollments correspondants
  -- MODIFIÉ : Ne créer que pour les matières scolaires
  IF (NEW.school_id != OLD.school_id OR NEW.school_level != OLD.school_level) AND NEW.deleted_at IS NULL THEN
    -- Supprimer les enrollments de l'ancienne combinaison école/niveau (seulement pour matières scolaires)
    DELETE FROM child_subject_enrollments cse
    WHERE cse.school_id = OLD.school_id
      AND cse.subject_id = OLD.subject_id
      AND EXISTS (
        SELECT 1 FROM subjects s
        WHERE s.id = OLD.subject_id
        AND s.type = 'scolaire'
      )
      AND cse.child_id IN (
        SELECT id FROM children
        WHERE school_id = OLD.school_id
        AND school_level = OLD.school_level
        AND is_active = true
      );
    
    -- Créer les enrollments pour la nouvelle combinaison école/niveau (seulement pour matières scolaires)
    INSERT INTO child_subject_enrollments (child_id, school_id, school_year_id, subject_id, selected)
    SELECT 
      c.id,
      NEW.school_id,
      NEW.school_year_id,
      NEW.subject_id,
      true
    FROM children c
    INNER JOIN subjects s ON s.id = NEW.subject_id
    WHERE c.school_id = NEW.school_id
      AND c.school_level = NEW.school_level
      AND c.is_active = true
      AND s.type = 'scolaire' -- SEULEMENT les matières scolaires
      AND NOT EXISTS (
        SELECT 1 FROM child_subject_enrollments cse
        WHERE cse.child_id = c.id
        AND cse.subject_id = NEW.subject_id
      )
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour synchroniser les enrollments existants avec les affectations actuelles
-- MODIFIÉ : Ne créer que pour les matières scolaires
CREATE OR REPLACE FUNCTION sync_all_enrollments_with_assignments()
RETURNS void AS $$
BEGIN
  -- Supprimer tous les enrollments qui correspondent à des affectations supprimées
  -- MAIS seulement pour les matières scolaires (garder les choix parents pour extra/optionnelle)
  DELETE FROM child_subject_enrollments cse
  WHERE EXISTS (
    SELECT 1 FROM subjects s
    WHERE s.id = cse.subject_id
    AND s.type = 'scolaire'
  )
  AND NOT EXISTS (
    SELECT 1 FROM teacher_assignments ta
    INNER JOIN children c ON c.id = cse.child_id
    WHERE ta.school_id = cse.school_id
      AND ta.school_level = c.school_level
      AND ta.subject_id = cse.subject_id
      AND ta.deleted_at IS NULL
  );

  -- Créer les enrollments manquants pour toutes les affectations actives
  -- MAIS seulement pour les matières scolaires
  INSERT INTO child_subject_enrollments (child_id, school_id, school_year_id, subject_id, selected)
  SELECT DISTINCT
    c.id,
    ta.school_id,
    ta.school_year_id,
    ta.subject_id,
    true
  FROM teacher_assignments ta
  INNER JOIN children c
    ON c.school_id = ta.school_id
    AND c.school_level = ta.school_level
  INNER JOIN subjects s
    ON s.id = ta.subject_id
  WHERE ta.deleted_at IS NULL
    AND c.is_active = true
    AND s.type = 'scolaire' -- SEULEMENT les matières scolaires
    AND NOT EXISTS (
      SELECT 1 FROM child_subject_enrollments cse
      WHERE cse.child_id = c.id
      AND cse.subject_id = ta.subject_id
    )
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

