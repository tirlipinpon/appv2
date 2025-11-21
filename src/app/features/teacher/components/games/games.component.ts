import { Component, inject, OnInit, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormArray, FormControl } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { GamesApplication } from './application/application';
import { GamesStore } from '../../store/games.store';
import { TeacherAssignmentStore } from '../../store/assignments.store';
import { ErrorSnackbarService } from '../../../../shared/services/snackbar/error-snackbar.service';
import type { Game, GameReponses } from '../../types/game';

@Component({
  selector: 'app-games',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './games.component.html',
  styleUrls: ['./games.component.scss'],
})
export class GamesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly application = inject(GamesApplication);
  private readonly errorSnackbar = inject(ErrorSnackbarService);
  readonly gamesStore = inject(GamesStore);
  readonly subjectsStore = inject(TeacherAssignmentStore);

  readonly subjectId = signal<string | null>(null);
  readonly editingGameId = signal<string | null>(null);

  readonly games = computed(() => this.gamesStore.games());
  readonly gameTypes = computed(() => this.gamesStore.gameTypes());
  readonly isLoading = computed(() => this.gamesStore.isLoading());
  readonly subjects = computed(() => this.subjectsStore.subjects());

  readonly currentSubject = computed(() => {
    const id = this.subjectId();
    if (!id) return null;
    return this.subjects().find(s => s.id === id) || null;
  });

  readonly currentSubjectName = computed(() => {
    const subject = this.currentSubject();
    return subject?.name || '';
  });

  // Effet pour pré-remplir le formulaire lors de l'édition
  private readonly patchFormFromGame = effect(() => {
    const gameId = this.editingGameId();
    if (gameId) {
      const game = this.games().find(g => g.id === gameId);
      if (game) {
        // Réinitialiser les FormArrays
        this.propositionsArray.clear();
        this.aidesArray.clear();

        // Remplir les champs de base
        this.gameForm.patchValue({
          instructions: game.instructions || '',
          game_type_id: game.game_type_id || '',
          question: game.question || '',
          reponse_valide: game.reponses?.reponse_valide || '',
        });

        // Remplir les propositions
        if (game.reponses?.propositions) {
          game.reponses.propositions.forEach((prop: string) => {
            const propValue: string = prop || '';
            this.propositionsArray.push(new FormControl<string>(propValue, { nonNullable: true }));
          });
        }

        // Remplir les aides
        if (game.aides) {
          game.aides.forEach((aide: string) => {
            const aideValue: string = aide || '';
            this.aidesArray.push(new FormControl<string>(aideValue, { nonNullable: true }));
          });
        }

        this.gameForm.updateValueAndValidity();
      }
    }
  });

  // Effet pour gérer les erreurs du store
  private readonly handleErrors = effect(() => {
    const errors = this.gamesStore.error();
    if (errors.length > 0) {
      errors.forEach(error => this.errorSnackbar.showError(error));
      this.gamesStore.clearError();
    }
  });

  gameForm = this.fb.group({
    instructions: [''],
    game_type_id: ['', Validators.required],
    question: [''],
    propositions: this.fb.array<FormControl<string>>([]),
    reponse_valide: [''],
    aides: this.fb.array<FormControl<string>>([]),
  });

  get propositionsArray(): FormArray<FormControl<string>> {
    return this.gameForm.get('propositions') as FormArray<FormControl<string>>;
  }

  get aidesArray(): FormArray<FormControl<string>> {
    return this.gameForm.get('aides') as FormArray<FormControl<string>>;
  }

  // Obtenir les propositions valides (non vides) pour le select de réponse valide
  get validPropositions(): string[] {
    return this.propositionsArray.value.filter((p: string) => p && p.trim());
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/teacher-subjects']);
      return;
    }
    this.subjectId.set(id);
    this.application.loadGameTypes();
    this.application.loadGamesBySubject(id);
    this.subjectsStore.loadSubjects();
    
    // Initialiser avec une proposition et une aide vides pour faciliter l'utilisation
    if (this.propositionsArray.length === 0) {
      this.addProposition();
    }
    if (this.aidesArray.length === 0) {
      this.addAide();
    }
  }

  isEditing(): boolean {
    return this.editingGameId() !== null;
  }

  create(): void {
    if (!this.gameForm.valid || !this.subjectId()) return;
    const v = this.gameForm.value;
    const subjectId = this.subjectId()!;

    // Construire l'objet reponses
    const propositions = this.propositionsArray.value.filter((p: string) => p && p.trim());
    const reponses: GameReponses | null = (propositions.length > 0 && v.reponse_valide)
      ? {
          propositions: propositions,
          reponse_valide: v.reponse_valide.trim(),
        }
      : null;

    // Construire le tableau aides
    const aides = this.aidesArray.value.filter((a: string) => a && a.trim());

    // Générer un nom automatique basé sur le type de jeu et la question
    const gameType = this.gameTypes().find(gt => gt.id === v.game_type_id);
    const gameTypeName = gameType?.name || 'Jeu';
    const questionPreview = v.question?.trim() ? v.question.trim().substring(0, 30) : '';
    const autoName = questionPreview ? `${gameTypeName} - ${questionPreview}${questionPreview.length >= 30 ? '...' : ''}` : gameTypeName;

    this.application.createGame({
      subject_id: subjectId,
      game_type_id: v.game_type_id!,
      name: autoName,
      instructions: v.instructions || null,
      question: v.question?.trim() || null,
      reponses: reponses,
      aides: aides.length > 0 ? aides : null,
      metadata: null,
    });

    this.resetForm();
  }

  startEdit(game: Game): void {
    this.editingGameId.set(game.id);
  }

  cancelEdit(): void {
    this.editingGameId.set(null);
    this.resetForm();
  }

  private resetForm(): void {
    this.gameForm.reset();
    this.propositionsArray.clear();
    this.aidesArray.clear();
    this.gameForm.patchValue({ game_type_id: '' });
  }

  update(): void {
    const gameId = this.editingGameId();
    if (!gameId || !this.gameForm.valid) return;
    const v = this.gameForm.value;

    // Construire l'objet reponses
    const propositions = this.propositionsArray.value.filter((p: string) => p && p.trim());
    const reponses: GameReponses | null = (propositions.length > 0 && v.reponse_valide)
      ? {
          propositions: propositions,
          reponse_valide: v.reponse_valide.trim(),
        }
      : null;

    // Construire le tableau aides
    const aides = this.aidesArray.value.filter((a: string) => a && a.trim());

    // Générer un nom automatique basé sur le type de jeu et la question
    const gameType = this.gameTypes().find(gt => gt.id === v.game_type_id);
    const gameTypeName = gameType?.name || 'Jeu';
    const questionPreview = v.question?.trim() ? v.question.trim().substring(0, 30) : '';
    const autoName = questionPreview ? `${gameTypeName} - ${questionPreview}${questionPreview.length >= 30 ? '...' : ''}` : gameTypeName;

    this.application.updateGame(gameId, {
      name: autoName,
      instructions: v.instructions || null,
      question: v.question?.trim() || null,
      reponses: reponses,
      aides: aides.length > 0 ? aides : null,
      game_type_id: v.game_type_id!,
    });

    this.cancelEdit();
  }

  delete(gameId: string): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce jeu ?')) {
      this.application.deleteGame(gameId);
    }
  }

  getGameTypeName(gameTypeId: string): string {
    const gameType = this.gameTypes().find(gt => gt.id === gameTypeId);
    return gameType?.name || 'Type inconnu';
  }

  addProposition(): void {
    this.propositionsArray.push(new FormControl<string>('', { nonNullable: true }));
  }

  removeProposition(index: number): void {
    const currentReponseValide = this.gameForm.get('reponse_valide')?.value;
    const propositionToRemove = this.propositionsArray.at(index).value;
    
    this.propositionsArray.removeAt(index);
    
    // Si la réponse valide était la proposition supprimée, ou si elle n'existe plus dans les propositions valides, réinitialiser
    if (currentReponseValide && (currentReponseValide === propositionToRemove || !this.validPropositions.includes(currentReponseValide))) {
      this.gameForm.patchValue({ reponse_valide: '' });
    }
  }

  addAide(): void {
    this.aidesArray.push(new FormControl<string>('', { nonNullable: true }));
  }

  removeAide(index: number): void {
    this.aidesArray.removeAt(index);
  }
}

