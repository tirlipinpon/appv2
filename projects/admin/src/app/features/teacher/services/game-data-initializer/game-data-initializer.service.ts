import { Injectable } from '@angular/core';
import type {
  CaseVideData,
  ReponseLibreData,
  LiensData,
  ChronologieData,
  QcmData,
  VraiFauxData,
  MemoryData,
  SimonData,
  ImageInteractiveData,
} from '@shared/games';

export type GameDataType =
  | CaseVideData
  | ReponseLibreData
  | LiensData
  | ChronologieData
  | QcmData
  | VraiFauxData
  | MemoryData
  | SimonData
  | ImageInteractiveData;

@Injectable({
  providedIn: 'root',
})
export class GameDataInitializerService {
  /**
   * Obtient les données initiales typées selon le type de jeu
   * @param gameTypeName - Nom du type de jeu (ex: "case vide", "qcm", etc.)
   * @param data - Données brutes à valider et typer
   * @returns Données typées ou null si le type ne correspond pas
   */
  getInitialData(
    gameTypeName: string | null,
    data: unknown
  ): GameDataType | null {
    if (!gameTypeName || !data || typeof data !== 'object') {
      return null;
    }

    const normalizedType = gameTypeName.toLowerCase().trim();

    switch (normalizedType) {
      case 'case vide':
        return this.getInitialDataForCaseVide(data);
      case 'reponse libre':
        return this.getInitialDataForReponseLibre(data);
      case 'liens':
        return this.getInitialDataForLiens(data);
      case 'chronologie':
        return this.getInitialDataForChronologie(data);
      case 'qcm':
        return this.getInitialDataForQcm(data);
      case 'vrai/faux':
        return this.getInitialDataForVraiFaux(data);
      case 'memory':
        return this.getInitialDataForMemory(data);
      case 'simon':
        return this.getInitialDataForSimon(data);
      case 'click':
      case 'image interactive':
        return this.getInitialDataForImageInteractive(data);
      default:
        return null;
    }
  }

  getInitialDataForCaseVide(data: unknown): CaseVideData | null {
    if (!data || typeof data !== 'object') {
      return null;
    }
    // Accepter le nouveau format (texte + cases_vides) ou l'ancien format (debut_phrase)
    if (
      ('texte' in data && 'cases_vides' in data) ||
      'debut_phrase' in data
    ) {
      return data as CaseVideData;
    }
    return null;
  }

  getInitialDataForReponseLibre(data: unknown): ReponseLibreData | null {
    if (
      !data ||
      typeof data !== 'object' ||
      !('reponse_valide' in data) ||
      'debut_phrase' in data
    ) {
      return null;
    }
    return data as ReponseLibreData;
  }

  getInitialDataForLiens(data: unknown): LiensData | null {
    if (
      !data ||
      typeof data !== 'object' ||
      !('mots' in data) ||
      !('reponses' in data) ||
      !('liens' in data)
    ) {
      return null;
    }
    return data as LiensData;
  }

  getInitialDataForChronologie(data: unknown): ChronologieData | null {
    if (
      !data ||
      typeof data !== 'object' ||
      !('mots' in data) ||
      !('ordre_correct' in data) ||
      'reponses' in data
    ) {
      return null;
    }
    return data as ChronologieData;
  }

  getInitialDataForQcm(data: unknown): QcmData | null {
    if (
      !data ||
      typeof data !== 'object' ||
      !('propositions' in data) ||
      !('reponses_valides' in data)
    ) {
      return null;
    }
    return data as QcmData;
  }

  getInitialDataForVraiFaux(data: unknown): VraiFauxData | null {
    if (!data || typeof data !== 'object' || !('enonces' in data)) {
      return null;
    }
    return data as VraiFauxData;
  }

  getInitialDataForMemory(data: unknown): MemoryData | null {
    if (!data || typeof data !== 'object' || !('paires' in data)) {
      return null;
    }
    return data as MemoryData;
  }

  getInitialDataForSimon(data: unknown): SimonData | null {
    if (
      !data ||
      typeof data !== 'object' ||
      !('nombre_elements' in data) ||
      !('type_elements' in data)
    ) {
      return null;
    }
    return data as SimonData;
  }

  getInitialDataForImageInteractive(
    data: unknown
  ): ImageInteractiveData | null {
    if (
      !data ||
      typeof data !== 'object' ||
      !('image_url' in data) ||
      !('image_width' in data) ||
      !('image_height' in data) ||
      !('zones' in data) ||
      typeof (data as { image_url: unknown }).image_url !== 'string' ||
      typeof (data as { image_width: unknown }).image_width !== 'number' ||
      typeof (data as { image_height: unknown }).image_height !== 'number' ||
      !Array.isArray((data as { zones: unknown }).zones)
    ) {
      return null;
    }
    return data as ImageInteractiveData;
  }
}
