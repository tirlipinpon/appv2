import { Component, input, effect, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { ProgressionService } from '../../../core/services/progression/progression.service';
import { ChildAuthService } from '../../../core/auth/child-auth.service';
import { SupabaseService } from '../../../core/services/supabase/supabase.service';
import { ProgressBarComponent } from '../progress-bar/progress-bar.component';

/**
 * Composant réutilisable pour afficher la progression d'une matière ou sous-catégorie
 * Gère automatiquement le chargement de la progression selon le contexte (matière principale ou sous-catégorie)
 */
@Component({
  selector: 'app-subject-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProgressBarComponent],
  template: `
    <app-progress-bar
      [value]="progress()"
      [max]="100"
      [label]="label() || 'Progression'"
      [variant]="variant()">
    </app-progress-bar>
  `,
  styles: []
})
export class SubjectProgressComponent {
  private readonly progression = inject(ProgressionService);
  private readonly childAuthService = inject(ChildAuthService);
  private readonly supabase = inject(SupabaseService);

  // Inputs : soit subjectId + subjectCategoryId (optionnel), soit gameId
  subjectId = input<string | null>(null);
  subjectCategoryId = input<string | null>(null);
  gameId = input<string | null>(null);
  label = input<string>('Progression');
  variant = input<'primary' | 'secondary' | 'success'>('primary');

  // État interne
  progress = signal<number>(0);
  isLoading = signal<boolean>(false);

  constructor() {
    // Charger la progression quand les inputs changent
    effect(() => {
      const gameIdValue = this.gameId();
      const subjectIdValue = this.subjectId();
      const subjectCategoryIdValue = this.subjectCategoryId();

      if (gameIdValue) {
        // Si gameId est fourni, on doit charger le jeu d'abord pour obtenir subjectId/subjectCategoryId
        this.loadProgressFromGameId(gameIdValue);
      } else if (subjectIdValue || subjectCategoryIdValue) {
        // Sinon, utiliser directement subjectId et/ou subjectCategoryId
        this.loadProgress(subjectIdValue, subjectCategoryIdValue);
      }
    });
  }

  /**
   * Charge la progression à partir d'un gameId
   */
  private async loadProgressFromGameId(gameId: string): Promise<void> {
    this.isLoading.set(true);
    try {
      const { data: game, error } = await this.supabase.client
        .from('games')
        .select('subject_id, subject_category_id')
        .eq('id', gameId)
        .single();

      if (error) {
        console.error('Erreur lors de la récupération du jeu:', error);
        this.progress.set(0);
        return;
      }

      if (game) {
        await this.loadProgress(game.subject_id, game.subject_category_id);
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la progression:', error);
      this.progress.set(0);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Charge la progression selon le contexte (matière principale ou sous-catégorie)
   */
  private async loadProgress(
    subjectId: string | null,
    subjectCategoryId: string | null
  ): Promise<void> {
    const child = this.childAuthService.getCurrentChild();
    if (!child) {
      this.progress.set(0);
      return;
    }
    const childId = child.child_id;

    if (!childId) {
      this.progress.set(0);
      return;
    }

    this.isLoading.set(true);

    try {
      let progressValue = 0;

      if (subjectCategoryId) {
        // Cas 1 : Sous-catégorie (subject_category_id présent)
        progressValue = await this.progression.calculateCategoryCompletionPercentage(
          childId,
          subjectCategoryId
        );
      } else if (subjectId) {
        // Cas 2 : Matière principale (subject_id présent, subject_category_id null)
        progressValue = await this.progression.calculateSubjectCompletionPercentage(
          childId,
          subjectId
        );
      }

      this.progress.set(progressValue);
    } catch (error) {
      console.error('Erreur lors du calcul de la progression:', error);
      this.progress.set(0);
    } finally {
      this.isLoading.set(false);
    }
  }
}
