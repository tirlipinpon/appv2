/**
 * Utilitaires pour la normalisation et la comparaison des noms de types de jeux
 * Version partagée pour le frontend
 * Utilise les données de la DB comme source de vérité
 */

/**
 * Normalise un nom de type de jeu pour la comparaison
 * - Convertit en minuscules
 * - Supprime les accents (normalisation Unicode NFD)
 * - Supprime les espaces en début/fin
 */
export function normalizeGameTypeName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Compare deux noms de types de jeux en les normalisant
 */
export function isGameType(
  gameTypeName: string | null | undefined,
  targetType: string
): boolean {
  return normalizeGameTypeName(gameTypeName) === normalizeGameTypeName(targetType);
}

/**
 * Vérifie si un nom de type de jeu correspond à l'un des types cibles
 * Utile pour gérer les variations (ex: 'click' vs 'image interactive')
 */
export function isGameTypeOneOf(
  gameTypeName: string | null | undefined,
  ...targetTypes: string[]
): boolean {
  const normalized = normalizeGameTypeName(gameTypeName);
  return targetTypes.some(type => normalizeGameTypeName(type) === normalized);
}
