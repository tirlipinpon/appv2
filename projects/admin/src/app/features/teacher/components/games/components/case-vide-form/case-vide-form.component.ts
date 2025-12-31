import { Component, Input, Output, EventEmitter, inject, OnChanges, SimpleChanges, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, FormControl, Validators } from '@angular/forms';
import type { CaseVideData } from '@shared/games';

@Component({
  selector: 'app-case-vide-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './case-vide-form.component.html',
  styleUrls: ['./case-vide-form.component.scss'],
})
export class CaseVideFormComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input() initialData: CaseVideData | null = null;
  @Output() dataChange = new EventEmitter<CaseVideData>();
  @Output() validityChange = new EventEmitter<boolean>();

  form: FormGroup;
  private isInitializing = false;
  extractedWords: Array<{ index: number; word: string }> = [];

  constructor() {
    this.form = this.fb.group({
      texte: ['', Validators.required],
      mots_leurres: this.fb.array<FormControl<string>>([]),
    });

    this.form.valueChanges.subscribe(() => {
      if (this.isInitializing) {
        return;
      }
      this.emitData();
    });
  }

  ngOnInit(): void {
    // Pas besoin d'initialisation spéciale
  }

  get motsLeurresArray(): FormArray<FormControl<string>> {
    return this.form.get('mots_leurres') as FormArray<FormControl<string>>;
  }

  addMotLeurre(): void {
    this.motsLeurresArray.push(new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }));
  }

  removeMotLeurre(index: number): void {
    this.motsLeurresArray.removeAt(index);
  }

  extractWordsFromText(texte: string): Array<{ index: number; word: string }> {
    // Extraire les mots entre [mot] du texte
    const regex = /\[([^\]]+)\]/g;
    const matches = Array.from(texte.matchAll(regex)) as RegExpMatchArray[];
    const words: Array<{ index: number; word: string }> = [];
    
    matches.forEach((match, index) => {
      const word = match[1].trim();
      if (word) {
        words.push({ index: index + 1, word: word });
      }
    });
    
    return words;
  }

  transformTextWithPlaceholders(texte: string, extractedWords: Array<{ index: number; word: string }>): string {
    // Remplacer [mot] par [1], [2], etc. dans l'ordre d'apparition
    let transformedText = texte;
    extractedWords.forEach((item) => {
      const originalPattern = `[${item.word}]`;
      const placeholder = `[${item.index}]`;
      // Remplacer toutes les occurrences du même mot par le même placeholder
      const regex = new RegExp(`\\[${item.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'g');
      transformedText = transformedText.replace(regex, placeholder);
    });
    
    return transformedText;
  }

  onTexteChange(): void {
    const texte = this.form.get('texte')?.value || '';
    this.extractedWords = this.extractWordsFromText(texte);
  }

  private emitData(): void {
    const texteOriginal = this.form.get('texte')?.value?.trim() || '';
    const motsLeurres = this.motsLeurresArray.value
      .filter((m: string) => m && m.trim())
      .map((m: string) => m.trim());

    // Extraire les mots du texte
    const extractedWords = this.extractWordsFromText(texteOriginal);
    
    // Transformer le texte pour remplacer [mot] par [1], [2], etc.
    const texteTransforme = this.transformTextWithPlaceholders(texteOriginal, extractedWords);

    // Générer les cases_vides à partir des mots extraits
    const casesVides = extractedWords.map((item) => ({
      index: item.index,
      reponse_correcte: item.word,
    }));

    // La banque de mots = mots extraits + mots leurres
    const banqueMots = [...extractedWords.map(item => item.word), ...motsLeurres];

    // Validation : au moins un mot extrait
    const isValid = texteOriginal.length > 0 && extractedWords.length > 0;

    if (isValid) {
      const caseVideData: CaseVideData = {
        texte: texteTransforme,
        cases_vides: casesVides,
        banque_mots: banqueMots,
        mots_leurres: motsLeurres,
      };
      this.dataChange.emit(caseVideData);
    }
    this.validityChange.emit(isValid);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialData']) {
      this.isInitializing = true;
      
      if (this.initialData) {
        // Vérifier si c'est le nouveau format ou l'ancien
        if (this.initialData.texte && this.initialData.cases_vides) {
          // Nouveau format - vérifier si le texte contient déjà des mots entre crochets [mot] ou des placeholders [1], [2]
          let texteOriginal = this.initialData.texte;
          
          // Vérifier si le texte contient des placeholders numériques [1], [2], etc.
          const hasNumericPlaceholders = /\[\d+\]/.test(texteOriginal);
          
          if (hasNumericPlaceholders) {
            // Le texte stocké contient [1], [2], etc., on doit le reconstruire avec les mots
            this.initialData.cases_vides.forEach(caseVide => {
              const placeholder = `[${caseVide.index}]`;
              const word = caseVide.reponse_correcte;
              texteOriginal = texteOriginal.replace(placeholder, `[${word}]`);
            });
          }
          // Sinon, le texte contient déjà les mots entre crochets [mot] (format généré par l'IA)
          // On l'utilise tel quel
          
          this.form.patchValue({ texte: texteOriginal }, { emitEvent: false });
          this.extractedWords = this.extractWordsFromText(texteOriginal);

          // Charger les mots leurres
          this.motsLeurresArray.clear();
          if (this.initialData.mots_leurres) {
            this.initialData.mots_leurres.forEach(mot => {
              this.motsLeurresArray.push(new FormControl<string>(mot, { nonNullable: true, validators: [Validators.required] }));
            });
          } else if (this.initialData.banque_mots && this.initialData.cases_vides) {
            // Si pas de mots_leurres mais qu'on a banque_mots, extraire les leurres
            const motsCorrects = this.initialData.cases_vides.map(cv => cv.reponse_correcte);
            const motsLeurres = this.initialData.banque_mots.filter(mot => !motsCorrects.includes(mot));
            motsLeurres.forEach(mot => {
              this.motsLeurresArray.push(new FormControl<string>(mot, { nonNullable: true, validators: [Validators.required] }));
            });
          }
        } else if (this.initialData.debut_phrase && this.initialData.fin_phrase && this.initialData.reponse_valide) {
          // Ancien format - convertir au nouveau format
          const texteOriginal = `${this.initialData.debut_phrase} [${this.initialData.reponse_valide}] ${this.initialData.fin_phrase}`;
          this.form.patchValue({ texte: texteOriginal }, { emitEvent: false });
          this.extractedWords = this.extractWordsFromText(texteOriginal);

          this.motsLeurresArray.clear();
        }
      } else {
        // Réinitialiser
        this.form.patchValue({ texte: '' }, { emitEvent: false });
        this.motsLeurresArray.clear();
        this.extractedWords = [];
      }

      setTimeout(() => {
        this.isInitializing = false;
        this.emitData();
      }, 0);
    }
  }

  getPreviewText(): string {
    const texte = this.form.get('texte')?.value || '';
    if (!texte) return '';
    
    // Afficher le texte avec les mots entre crochets mis en évidence
    let preview = texte;
    this.extractedWords.forEach((item) => {
      const originalPattern = `[${item.word}]`;
      preview = preview.replace(originalPattern, `<span class="case-vide-preview">[${item.word}]</span>`);
    });
    
    return preview;
  }
}
