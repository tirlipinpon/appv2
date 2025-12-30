import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class TutorialService {
  private readonly visitedPages = signal<Set<string>>(new Set());

  constructor() {
    // Restaurer les pages visitées depuis localStorage
    this.restoreVisitedPages();
  }

  /**
   * Vérifie si c'est la première visite d'une page
   */
  isFirstVisit(pageId: string): boolean {
    return !this.visitedPages().has(pageId);
  }

  /**
   * Marque une page comme visitée
   */
  markPageAsVisited(pageId: string): void {
    const visited = new Set(this.visitedPages());
    visited.add(pageId);
    this.visitedPages.set(visited);
    this.saveVisitedPages();
  }

  /**
   * Réinitialise les pages visitées (pour tests ou réinitialisation)
   */
  resetVisitedPages(): void {
    this.visitedPages.set(new Set());
    localStorage.removeItem('tutorial_visited_pages');
  }

  /**
   * Sauvegarde les pages visitées dans localStorage
   */
  private saveVisitedPages(): void {
    try {
      const pagesArray = Array.from(this.visitedPages());
      localStorage.setItem('tutorial_visited_pages', JSON.stringify(pagesArray));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des pages visitées:', error);
    }
  }

  /**
   * Restaure les pages visitées depuis localStorage
   */
  private restoreVisitedPages(): void {
    try {
      const saved = localStorage.getItem('tutorial_visited_pages');
      if (saved) {
        const pagesArray = JSON.parse(saved) as string[];
        this.visitedPages.set(new Set(pagesArray));
      }
    } catch (error) {
      console.error('Erreur lors de la restauration des pages visitées:', error);
    }
  }
}

