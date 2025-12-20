import { Component, inject, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import type { AIGameGenerationRequest } from '../../../../types/ai-game-generation';
import type { GameType } from '../../../../types/game-type';
import { getSchoolLevelsForSelect } from '../../../../utils/school-levels.util';

@Component({
  selector: 'app-ai-game-generator-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './ai-game-generator-form.component.html',
  styleUrls: ['./ai-game-generator-form.component.scss'],
})
export class AIGameGeneratorFormComponent {
  private readonly fb = inject(FormBuilder);

  @Input() subjectId!: string;
  @Input() subjectName = ''; // Nom de la matière scolaire
  @Input() schoolYearLabel: string | null = null;
  @Input() generationProgress = 0; // Progression de la génération (0-100)
  @Input() generatedCount = 0; // Nombre de jeux déjà générés
  @Input() gameTypes: GameType[] = []; // Types de jeux disponibles
  
  private _isGenerating = false;
  @Input() 
  set isGenerating(value: boolean) {
    this._isGenerating = value;
    if (value) {
      this.generatorForm.disable();
    } else {
      this.generatorForm.enable();
    }
  }
  get isGenerating(): boolean {
    return this._isGenerating;
  }

  @Output() generate = new EventEmitter<AIGameGenerationRequest>();

  selectedFile = signal<File | null>(null);
  fileError = signal<string | null>(null);
  selectedGameTypeIds = signal<string[]>([]); // IDs des types de jeux sélectionnés

  // Niveaux scolaires disponibles pour le fallback manuel (système belge)
  readonly availableSchoolLevels = getSchoolLevelsForSelect();

  generatorForm = this.fb.group({
    subject: ['', [Validators.required, Validators.minLength(3)]],
    numberOfGames: [5, [Validators.required, Validators.min(1), Validators.max(20)]],
    difficulty: [3, [Validators.required, Validators.min(1), Validators.max(5)]],
    manualSchoolLevel: [''], // Champ optionnel pour saisie manuelle
  });

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      this.selectedFile.set(null);
      this.fileError.set(null);
      return;
    }

    // Vérifier que c'est bien un PDF
    if (file.type !== 'application/pdf') {
      this.fileError.set('Seuls les fichiers PDF sont acceptés');
      this.selectedFile.set(null);
      input.value = '';
      return;
    }

    // Vérifier la taille (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      this.fileError.set('Le fichier est trop volumineux (max 10MB)');
      this.selectedFile.set(null);
      input.value = '';
      return;
    }

    this.selectedFile.set(file);
    this.fileError.set(null);
  }

  removeFile(): void {
    this.selectedFile.set(null);
    this.fileError.set(null);
    // Reset file input
    const fileInput = document.getElementById('pdfFile') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  onSubmit(): void {
    // Utiliser schoolYearLabel de l'affectation OU le niveau manuel
    const effectiveSchoolLevel = this.schoolYearLabel || this.generatorForm.value.manualSchoolLevel;
    
    if (this.generatorForm.invalid || !this.subjectId || !effectiveSchoolLevel) {
      return;
    }

    const formValue = this.generatorForm.value;
    const selectedIds = this.selectedGameTypeIds();
    
    const request: AIGameGenerationRequest = {
      subjectName: this.subjectName, // Nom de la matière scolaire
      subject: formValue.subject!, // Thème/sujet du jeu
      pdfFile: this.selectedFile() || undefined,
      numberOfGames: formValue.numberOfGames!,
      schoolYearLabel: effectiveSchoolLevel,
      difficulty: formValue.difficulty!,
      subjectId: this.subjectId,
      selectedGameTypeIds: selectedIds.length > 0 ? selectedIds : undefined, // Si vide, undefined pour utiliser tous les types
    };

    this.generate.emit(request);
  }

  toggleGameType(gameTypeId: string): void {
    if (this.isGenerating) return; // Désactiver pendant la génération
    
    const current = this.selectedGameTypeIds();
    const index = current.indexOf(gameTypeId);
    
    if (index >= 0) {
      // Désélectionner
      this.selectedGameTypeIds.set(current.filter(id => id !== gameTypeId));
    } else {
      // Sélectionner
      this.selectedGameTypeIds.set([...current, gameTypeId]);
    }
  }

  isGameTypeSelected(gameTypeId: string): boolean {
    return this.selectedGameTypeIds().includes(gameTypeId);
  }

  getDifficultyLabel(value: number): string {
    const labels: Record<number, string> = {
      1: 'Très facile',
      2: 'Facile',
      3: 'Moyen',
      4: 'Difficile',
      5: 'Très difficile',
    };
    return labels[value] || 'Moyen';
  }
}

