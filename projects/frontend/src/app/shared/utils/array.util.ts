/**
 * Utilitaires pour les opérations sur les tableaux
 */

/**
 * Mélange aléatoirement un tableau en utilisant l'algorithme de Fisher-Yates
 * 
 * @param array - Le tableau à mélanger
 * @returns Une nouvelle copie du tableau mélangé (le tableau original n'est pas modifié)
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
