-- Migration: Ajout des commentaires de documentation pour toutes les tables
-- Description: Ajoute les commentaires COMMENT ON TABLE et COMMENT ON COLUMN pour documenter
--              le rôle métier et l'utilisation de chaque table et colonne importante

-- ============================================================================
-- TABLES UTILISATEURS ET PROFILS
-- ============================================================================

COMMENT ON TABLE profiles IS 'Table principale des profils utilisateurs, liée à auth.users de Supabase. Centralise les informations de profil de tous les utilisateurs authentifiés et gère le système de rôles multiples (un utilisateur peut être à la fois parent et professeur).';

COMMENT ON COLUMN profiles.roles IS 'Tableau des rôles de l''utilisateur (ex: ''prof'', ''parent''). Permet de gérer plusieurs rôles par utilisateur.';

COMMENT ON TABLE parents IS 'Table des parents, liée à profiles. Stocke les informations détaillées des comptes parents, incluant leurs coordonnées et préférences. Chaque parent peut gérer plusieurs enfants.';

COMMENT ON TABLE children IS 'Table des enfants, liée à profiles (parent) et schools. Gère les profils des enfants qui utilisent l''interface frontend avec un système d''authentification simplifié via PIN à 4 chiffres et génération d''avatar.';

COMMENT ON COLUMN children.login_pin IS 'Code PIN à 4 chiffres pour la connexion simplifiée des enfants (sans email). Utilisé avec firstname pour l''authentification.';

COMMENT ON COLUMN children.avatar_seed IS 'Seed pour générer l''avatar DiceBear. La combinaison avatar_seed + login_pin doit être unique.';

COMMENT ON COLUMN children.is_active IS 'Statut actif de l''enfant. Permet de désactiver temporairement un compte sans le supprimer.';

COMMENT ON TABLE teachers IS 'Table des professeurs, liée à profiles. Stocke les informations détaillées des comptes professeurs, incluant leurs coordonnées et préférences de partage avec les parents.';

COMMENT ON COLUMN teachers.share_email IS 'Autorise le partage de l''email du professeur avec les parents.';

COMMENT ON COLUMN teachers.share_phone IS 'Autorise le partage du téléphone du professeur avec les parents.';

-- ============================================================================
-- TABLES ÉCOLES ET CLASSES
-- ============================================================================

COMMENT ON TABLE schools IS 'Table des écoles. Gère les établissements scolaires où sont inscrits les enfants et où enseignent les professeurs.';

COMMENT ON TABLE school_years IS 'Table des années scolaires. Gère les années scolaires pour organiser les classes et les inscriptions des enfants.';

COMMENT ON COLUMN school_years.order_index IS 'Ordre d''affichage des années scolaires dans l''interface.';

COMMENT ON TABLE classes IS 'Table des classes. Gère les classes d''élèves au sein des écoles et années scolaires.';

COMMENT ON COLUMN classes.capacity IS 'Capacité maximale de la classe en nombre d''élèves.';

COMMENT ON TABLE teacher_assignments IS 'Table des affectations des professeurs. Lie les professeurs aux matières, classes, écoles et niveaux scolaires qu''ils enseignent. Utilise le soft delete (deleted_at) pour conserver l''historique. Détermine quels jeux sont visibles pour un professeur (seuls les jeux des matières avec affectations actives sont accessibles).';

COMMENT ON COLUMN teacher_assignments.roles IS 'Rôles du professeur dans cette affectation (ex: ''titulaire'', ''remplaçant'').';

COMMENT ON COLUMN teacher_assignments.deleted_at IS 'Date de suppression (soft delete). Permet de conserver l''historique sans supprimer définitivement. NULL = affectation active.';

-- ============================================================================
-- TABLES MATIÈRES ET CATÉGORIES
-- ============================================================================

COMMENT ON TABLE subjects IS 'Table des matières. Gère le référentiel des matières scolaires (ex: Mathématiques, Français) et extra-scolaires (ex: Musique, Sport).';

COMMENT ON COLUMN subjects.type IS 'Type de matière : ''scolaire'', ''extra'' ou ''optionnelle''.';

COMMENT ON TABLE subject_categories IS 'Table des catégories de matières (sous-catégories). Permet de subdiviser les matières en sous-catégories plus spécifiques (ex: Mathématiques → Addition, Soustraction, Multiplication). Gère la progression des enfants par sous-catégorie.';

COMMENT ON TABLE school_level_subjects IS 'Table de liaison entre niveaux scolaires et matières. Définit quelles matières sont disponibles et obligatoires pour chaque niveau scolaire dans chaque école.';

COMMENT ON COLUMN school_level_subjects.required IS 'Indique si la matière est obligatoire (true) ou optionnelle (false) pour ce niveau scolaire.';

COMMENT ON TABLE child_subject_enrollments IS 'Table des inscriptions des enfants aux matières. Gère les matières activées (selected=true) ou désactivées pour chaque enfant, par école et année scolaire.';

COMMENT ON COLUMN child_subject_enrollments.selected IS 'Indique si la matière est activée (visible dans l''interface frontend) pour l''enfant.';

COMMENT ON TABLE child_subject_category_enrollments IS 'Table des inscriptions des enfants aux catégories de matières. Gère les sous-catégories activées (selected=true) ou désactivées pour chaque enfant.';

COMMENT ON COLUMN child_subject_category_enrollments.selected IS 'Indique si la sous-catégorie est activée pour l''enfant.';

-- ============================================================================
-- TABLES JEUX
-- ============================================================================

COMMENT ON TABLE game_types IS 'Table des types de jeux. Référentiel des types de jeux disponibles dans l''application (QCM, Memory, Puzzle, Chronologie, etc.).';

COMMENT ON TABLE games IS 'Table principale des jeux. Stocke tous les jeux éducatifs créés par les professeurs. Un jeu doit être lié soit à une matière (subject_id) soit à une sous-catégorie (subject_category_id), mais pas les deux. Les jeux ne sont visibles que si la matière a au moins une affectation active (teacher_assignments avec deleted_at IS NULL).';

COMMENT ON COLUMN games.reponses IS 'Structure JSONB spécifique à chaque type de jeu. Stocke les propositions et la réponse valide selon le type (QCM, Memory, Puzzle, etc.).';

COMMENT ON COLUMN games.aides IS 'Tableau JSONB de phrases d''aide pour guider l''enfant pendant le jeu.';

COMMENT ON COLUMN games.aide_image_url IS 'URL de l''image d''aide stockée dans le bucket ''aides-images''.';

COMMENT ON COLUMN games.aide_video_url IS 'URL de la vidéo d''aide (peut être externe ou stockée dans Supabase Storage).';

COMMENT ON TABLE questions IS 'Table des questions (pour les QCM, vrai/faux, etc.). Stocke les questions réutilisables créées par les professeurs, qui peuvent être utilisées dans plusieurs jeux.';

COMMENT ON COLUMN questions.options IS 'Options de réponse (structure JSONB dépend du type de question : QCM, vrai/faux, texte, numérique).';

COMMENT ON COLUMN questions.answer_key IS 'Clé de réponse (structure JSONB dépend du type de question).';

-- ============================================================================
-- TABLES FRONTEND
-- ============================================================================

COMMENT ON TABLE frontend_game_attempts IS 'Table des tentatives de jeux des enfants. Enregistre chaque tentative de jeu d''un enfant avec le score, la durée, les réponses et le succès. Essentielle pour le suivi de la progression et les statistiques. Le meilleur score par jeu est utilisé pour déterminer si un jeu est réussi (score = 100%).';

COMMENT ON COLUMN frontend_game_attempts.score IS 'Score obtenu en pourcentage (0-100). Calculé selon les réponses correctes.';

COMMENT ON COLUMN frontend_game_attempts.responses_json IS 'Structure JSONB stockant toutes les réponses de l''enfant pour analyse et statistiques.';

COMMENT ON TABLE frontend_subject_category_progress IS 'Table de progression des enfants par catégorie de matière. Suit la progression de chaque enfant pour chaque sous-catégorie avec les étoiles obtenues, le pourcentage de complétion et le statut de complétion. Le pourcentage est calculé comme : (jeux réussis / total jeux) × 100.';

COMMENT ON COLUMN frontend_subject_category_progress.stars_count IS 'Nombre d''étoiles obtenues (0-3). Calculées selon le score et le taux de réussite : 3 = parfait, 2 = bien, 1 = passable, 0 = à refaire.';

COMMENT ON COLUMN frontend_subject_category_progress.completion_percentage IS 'Pourcentage de complétion (0-100). Calculé automatiquement : (jeux réussis avec score = 100% / total jeux) × 100.';

COMMENT ON COLUMN frontend_subject_category_progress.completed IS 'Indique si la sous-catégorie est complétée. Une sous-catégorie est considérée complétée si completed=true OU completion_percentage >= 100.';

COMMENT ON TABLE frontend_game_variants IS 'Table des variantes de jeux (pour différents niveaux de difficulté). Permet de créer plusieurs variantes d''un même jeu avec différents niveaux de difficulté (1-5).';

COMMENT ON COLUMN frontend_game_variants.variant_data_json IS 'Données spécifiques à chaque variante (structure JSONB dépend du type de jeu).';

COMMENT ON COLUMN frontend_game_variants.difficulty_level IS 'Niveau de difficulté de la variante (1 = facile, 5 = très difficile).';

COMMENT ON TABLE frontend_collectibles IS 'Table des objets collectionnables. Définit les objets que les enfants peuvent débloquer en complétant des sous-catégories ou en atteignant certains objectifs.';

COMMENT ON COLUMN frontend_collectibles.unlock_condition_json IS 'Conditions de déblocage (structure JSONB). Condition principale : compléter une sous-catégorie (type: ''complete_subject_category'', subject_category_id).';

COMMENT ON TABLE frontend_child_collectibles IS 'Table de liaison enfants/objets collectionnables (objets débloqués). Enregistre quels collectibles ont été débloqués par chaque enfant et à quel moment.';

COMMENT ON TABLE frontend_bonus_games IS 'Table des jeux bonus. Définit les mini-jeux bonus que les enfants peuvent débloquer en complétant des matières entières ou en atteignant certains objectifs.';

COMMENT ON COLUMN frontend_bonus_games.unlock_condition_json IS 'Conditions de déblocage (structure JSONB). Condition principale : compléter toutes les sous-catégories d''une matière (type: ''complete_subject'', subject_id).';

COMMENT ON COLUMN frontend_bonus_games.game_data_json IS 'Données du jeu bonus (structure JSONB spécifique au type de jeu bonus).';

COMMENT ON TABLE frontend_child_bonus_game_unlocks IS 'Table de liaison enfants/jeux bonus (jeux débloqués). Enregistre quels jeux bonus ont été débloqués par chaque enfant, avec le nombre de parties jouées et la dernière date de jeu.';

COMMENT ON COLUMN frontend_child_bonus_game_unlocks.played_count IS 'Nombre de parties jouées. Incrémenté à chaque partie pour suivre l''engagement de l''enfant.';

COMMENT ON TABLE frontend_themes IS 'Table des thèmes visuels de l''application. Définit les thèmes personnalisables que les enfants peuvent débloquer et sélectionner pour personnaliser l''apparence de l''interface.';

COMMENT ON COLUMN frontend_themes.shapes_colors_json IS 'Configuration des formes et couleurs du thème (structure JSONB).';

COMMENT ON COLUMN frontend_themes.unlock_condition_json IS 'Conditions de déblocage (structure JSONB). Peut être basé sur le nombre total d''étoiles (type: ''by_level'', min_stars).';

COMMENT ON COLUMN frontend_themes.is_default IS 'Indique si le thème est par défaut. Les thèmes par défaut sont toujours disponibles sans condition.';

COMMENT ON TABLE frontend_child_themes IS 'Table de liaison enfants/thèmes (thèmes débloqués et sélectionnés). Enregistre quels thèmes ont été débloqués par chaque enfant et lequel est actuellement sélectionné. Un seul thème peut être sélectionné à la fois.';

COMMENT ON COLUMN frontend_child_themes.is_selected IS 'Indique si le thème est actuellement sélectionné. Un seul thème peut être sélectionné à la fois (les autres sont automatiquement désélectionnés).';

COMMENT ON TABLE frontend_child_mascot_state IS 'Table de l''état de la mascotte de l''enfant (niveau, XP, évolution). Gère le système de gamification avec une mascotte qui évolue selon les performances de l''enfant. Le niveau est calculé automatiquement : floor(sqrt(xp / 100)) + 1. Les stades d''évolution : 1 (niveau 1-4), 2 (niveau 5-9), 3 (niveau 10-14), 4 (niveau 15-19), 5 (niveau 20+).';

COMMENT ON COLUMN frontend_child_mascot_state.xp IS 'Points d''expérience. Gagnés après chaque jeu réussi : base 10 points + bonus jusqu''à 20 points selon le score.';

COMMENT ON COLUMN frontend_child_mascot_state.level IS 'Niveau de la mascotte. Calculé automatiquement selon l''XP : floor(sqrt(xp / 100)) + 1.';

COMMENT ON COLUMN frontend_child_mascot_state.evolution_stage IS 'Stade d''évolution de la mascotte (1-5). Calculé automatiquement selon le niveau.';

COMMENT ON COLUMN frontend_child_mascot_state.current_appearance_json IS 'Apparence actuelle de la mascotte (structure JSONB : couleur, accessoires, etc.).';

COMMENT ON TABLE frontend_child_checkpoints IS 'Table des points de sauvegarde pour l''application enfant (sauvegarde hybride: auto + checkpoint). Permet de sauvegarder l''état de l''application à des moments clés (fin de jeu, fin de sous-catégorie) pour permettre la reprise de session.';

COMMENT ON COLUMN frontend_child_checkpoints.checkpoint_type IS 'Type de checkpoint : ''game_end'' (fin de jeu), ''subject_category_end'' (fin de sous-catégorie).';

COMMENT ON COLUMN frontend_child_checkpoints.checkpoint_data_json IS 'Données du checkpoint (structure JSONB). Stocke toutes les données nécessaires pour restaurer l''état de l''application.';
