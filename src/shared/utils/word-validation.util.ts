/**
 * Utilitaire pour la validation de mots lettre par lettre
 * Inspiré de la logique du jeu cathegories
 */

export type LetterState = 'correct' | 'wrong-place' | 'wrong';

export interface LetterAnalysisResult {
  correct: boolean;
  correctLetters: number;
  correctPositions: number;
  wrongPositions: number;
  letterStates: LetterState[];
}

/**
 * Service statique pour la validation de mots
 */
export class WordValidationUtil {
  /**
   * Normalise un texte en supprimant les accents et en convertissant en minuscules
   * @param text - Le texte à normaliser
   * @returns Le texte normalisé
   */
  static normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  /**
   * Analyse une tentative de mot lettre par lettre
   * Compare le mot saisi avec le mot cible et détermine l'état de chaque lettre
   * @param guess - Le mot saisi par l'utilisateur
   * @param targetWord - Le mot à deviner
   * @returns Résultat de l'analyse avec l'état de chaque lettre
   */
  static analyzeGuess(guess: string, targetWord: string): LetterAnalysisResult {
    const normalizedGuess = this.normalizeText(guess);
    const normalizedWord = this.normalizeText(targetWord);

    const result: LetterAnalysisResult = {
      correct: normalizedGuess === normalizedWord,
      correctLetters: 0,
      correctPositions: 0,
      wrongPositions: 0,
      letterStates: []
    };

    const wordLetters = normalizedWord.split('');
    const guessLetters = normalizedGuess.split('');
    const usedPositions = new Set<number>();

    // Étape 1 : Vérifier les lettres à la bonne place (vert)
    for (let i = 0; i < guessLetters.length; i++) {
      if (guessLetters[i] === wordLetters[i]) {
        result.correctPositions++;
        result.letterStates[i] = 'correct';
        usedPositions.add(i);
      }
    }

    // Étape 2 : Vérifier les lettres à la mauvaise place (jaune)
    for (let i = 0; i < guessLetters.length; i++) {
      if (result.letterStates[i] !== 'correct') {
        for (let j = 0; j < wordLetters.length; j++) {
          if (!usedPositions.has(j) && guessLetters[i] === wordLetters[j]) {
            result.wrongPositions++;
            result.letterStates[i] = 'wrong-place';
            usedPositions.add(j);
            break;
          }
        }
        // Si aucune correspondance trouvée, la lettre est absente (gris)
        if (result.letterStates[i] === undefined) {
          result.letterStates[i] = 'wrong';
        }
      }
    }

    result.correctLetters = result.correctPositions + result.wrongPositions;
    return result;
  }

  /**
   * Vérifie si toutes les lettres sont correctes
   * @param letterStates - Les états des lettres
   * @returns true si toutes les lettres sont à la bonne place
   */
  static areAllLettersCorrect(letterStates: LetterState[]): boolean {
    return letterStates.length > 0 && letterStates.every(state => state === 'correct');
  }

  /**
   * Compte le nombre de lettres vertes consécutives depuis le début
   * @param letterStates - Les états des lettres
   * @returns Le nombre de lettres vertes consécutives depuis le début
   */
  static countConsecutiveGreenLetters(letterStates: LetterState[]): number {
    let count = 0;
    for (let i = 0; i < letterStates.length; i++) {
      if (letterStates[i] === 'correct') {
        count++;
      } else {
        break;
      }
    }
    return count;
  }
}

