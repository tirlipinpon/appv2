import { Injectable } from '@angular/core';
import { Subject, debounceTime } from 'rxjs';

interface SaveOperation {
  type: string;
  data: unknown;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root',
})
export class AutoSaveService {
  private saveQueue: SaveOperation[] = [];
  private saveSubject = new Subject<SaveOperation>();
  private isSaving = false;

  constructor() {
    // Débounce les sauvegardes: attendre 500ms après la dernière action
    this.saveSubject.pipe(debounceTime(500)).subscribe((operation) => {
      this.processSave(operation);
    });
  }

  /**
   * Ajoute une opération de sauvegarde à la file d'attente
   */
  queueSave(type: string, data: unknown): void {
    const operation: SaveOperation = {
      type,
      data,
      timestamp: new Date(),
    };

    this.saveQueue.push(operation);
    this.saveSubject.next(operation);
  }

  /**
   * Traite une sauvegarde
   */
  private async processSave(operation: SaveOperation): Promise<void> {
    if (this.isSaving) {
      return; // Une sauvegarde est déjà en cours
    }

    this.isSaving = true;

    try {
      // Ici, on pourrait envoyer à Supabase ou utiliser un service de sauvegarde
      // Pour l'instant, on simule juste la sauvegarde
      await this.executeSave(operation);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde automatique:', error);
      // Retry logic pourrait être ajoutée ici
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * Exécute la sauvegarde réelle
   */
  private async executeSave(operation: SaveOperation): Promise<void> {
    // Cette méthode sera implémentée selon le type d'opération
    // Par exemple, sauvegarder dans Supabase
  }

  /**
   * Force une sauvegarde immédiate
   */
  async forceSave(): Promise<void> {
    if (this.saveQueue.length === 0) {
      return;
    }

    const operations = [...this.saveQueue];
    this.saveQueue = [];

    for (const operation of operations) {
      await this.executeSave(operation);
    }
  }

  /**
   * Retourne l'état de sauvegarde
   */
  getSavingState(): boolean {
    return this.isSaving;
  }
}

