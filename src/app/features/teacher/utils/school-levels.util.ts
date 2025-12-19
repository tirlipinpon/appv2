/**
 * Configuration des niveaux scolaires (système belge)
 * Utilisé pour les formulaires et la génération IA
 */

export interface SchoolLevel {
  value: string;
  label: string;
  age: number;
}

/**
 * Liste complète des niveaux scolaires disponibles
 */
export const SCHOOL_LEVELS: readonly SchoolLevel[] = [
  { value: 'M1', label: 'M1 (Maternelle 1ère - 3 ans)', age: 3 },
  { value: 'M2', label: 'M2 (Maternelle 2ème - 4 ans)', age: 4 },
  { value: 'M3', label: 'M3 (Maternelle 3ème - 5 ans)', age: 5 },
  { value: 'P1', label: 'P1 (Primaire 1ère - 6 ans)', age: 6 },
  { value: 'P2', label: 'P2 (Primaire 2ème - 7 ans)', age: 7 },
  { value: 'P3', label: 'P3 (Primaire 3ème - 8 ans)', age: 8 },
  { value: 'P4', label: 'P4 (Primaire 4ème - 9 ans)', age: 9 },
  { value: 'P5', label: 'P5 (Primaire 5ème - 10 ans)', age: 10 },
  { value: 'P6', label: 'P6 (Primaire 6ème - 11 ans)', age: 11 },
  { value: 'S1', label: 'S1 (Secondaire 1ère - 12 ans)', age: 12 },
  { value: 'S2', label: 'S2 (Secondaire 2ème - 13 ans)', age: 13 },
  { value: 'S3', label: 'S3 (Secondaire 3ème - 14 ans)', age: 14 },
  { value: 'S4', label: 'S4 (Secondaire 4ème - 15 ans)', age: 15 },
  { value: 'S5', label: 'S5 (Secondaire 5ème - 16 ans)', age: 16 },
  { value: 'S6', label: 'S6 (Secondaire 6ème - 17 ans)', age: 17 },
] as const;

/**
 * Mapping des niveaux français vers les niveaux belges (pour compatibilité)
 */
const FRENCH_TO_BELGIAN_MAPPING: Record<string, string> = {
  'CP': 'P1',
  'CE1': 'P2',
  'CE2': 'P3',
  'CM1': 'P4',
  'CM2': 'P5',
  '6ème': 'S1',
  '6eme': 'S1',
  '5ème': 'S2',
  '5eme': 'S2',
  '4ème': 'S3',
  '4eme': 'S3',
  '3ème': 'S4',
  '3eme': 'S4',
  'Seconde': 'S5',
  '2nde': 'S5',
  'Première': 'S6',
  '1ère': 'S6',
  '1ere': 'S6',
  'Terminale': 'S6',
};

/**
 * Retourne l'âge approximatif à partir d'un niveau scolaire
 * Supporte les niveaux belges (M1-S6) et français (CP, CE1, etc.)
 * 
 * @param schoolYear Le niveau scolaire (ex: "P3", "CP", "6ème")
 * @returns Une chaîne décrivant l'âge (ex: "8 ans" ou "8-9 ans")
 */
export function getAgeFromSchoolYear(schoolYear: string): string {
  // Normaliser l'entrée
  const normalized = schoolYear.trim();
  
  // Si c'est un niveau français, le convertir en belge
  const belgianLevel = FRENCH_TO_BELGIAN_MAPPING[normalized] || normalized;
  
  // Chercher dans les niveaux belges
  const level = SCHOOL_LEVELS.find(l => l.value === belgianLevel);
  
  if (level) {
    // Retourner une fourchette d'âge sauf pour maternelle et S6
    if (level.age === 3 || level.age === 17) {
      return `${level.age} ans`;
    }
    return `${level.age - 1}-${level.age} ans`;
  }
  
  // Fallback si le niveau n'est pas trouvé
  return '10-15 ans (estimation)';
}

/**
 * Retourne le label complet d'un niveau scolaire
 * Gère les valeurs null/undefined en retournant une chaîne vide
 * 
 * @param schoolYear Le code du niveau (ex: "P3") ou null/undefined
 * @returns Le label complet (ex: "P3 (Primaire 3ème - 8 ans)") ou chaîne vide si null/undefined
 */
export function getSchoolLevelLabel(schoolYear: string | null | undefined): string {
  if (!schoolYear) return '';
  const level = SCHOOL_LEVELS.find(l => l.value === schoolYear);
  return level?.label || schoolYear;
}

/**
 * Retourne uniquement le code du niveau (sans description)
 * Utile pour les selects/dropdowns
 */
export function getSchoolLevelsForSelect(): { value: string; label: string }[] {
  return SCHOOL_LEVELS.map(level => ({
    value: level.value,
    label: level.label
  }));
}

