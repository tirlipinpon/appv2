import { Component, inject, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import type { AIGameGenerationRequest } from '../../../../types/ai-game-generation';

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
  @Input() schoolYearLabel: string | null = null;
  
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

  // Niveaux scolaires disponibles pour le fallback manuel (système belge)
  readonly availableSchoolLevels = [
    { value: 'M1', label: 'M1 (Maternelle 1ère - 3 ans)' },
    { value: 'M2', label: 'M2 (Maternelle 2ème - 4 ans)' },
    { value: 'M3', label: 'M3 (Maternelle 3ème - 5 ans)' },
    { value: 'P1', label: 'P1 (Primaire 1ère - 6 ans)' },
    { value: 'P2', label: 'P2 (Primaire 2ème - 7 ans)' },
    { value: 'P3', label: 'P3 (Primaire 3ème - 8 ans)' },
    { value: 'P4', label: 'P4 (Primaire 4ème - 9 ans)' },
    { value: 'P5', label: 'P5 (Primaire 5ème - 10 ans)' },
    { value: 'P6', label: 'P6 (Primaire 6ème - 11 ans)' },
    { value: 'S1', label: 'S1 (Secondaire 1ère - 12 ans)' },
    { value: 'S2', label: 'S2 (Secondaire 2ème - 13 ans)' },
    { value: 'S3', label: 'S3 (Secondaire 3ème - 14 ans)' },
    { value: 'S4', label: 'S4 (Secondaire 4ème - 15 ans)' },
    { value: 'S5', label: 'S5 (Secondaire 5ème - 16 ans)' },
    { value: 'S6', label: 'S6 (Secondaire 6ème - 17 ans)' },
  ];

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

    const request: AIGameGenerationRequest = {
      subject: formValue.subject!,
      pdfFile: this.selectedFile() || undefined,
      numberOfGames: formValue.numberOfGames!,
      schoolYearLabel: effectiveSchoolLevel,
      difficulty: formValue.difficulty!,
      subjectId: this.subjectId,
    };

    this.generate.emit(request);
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

