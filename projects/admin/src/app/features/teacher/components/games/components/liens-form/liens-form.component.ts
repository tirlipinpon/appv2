import { Component, Input, Output, EventEmitter, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, FormControl, Validators } from '@angular/forms';
import type { LiensData } from '@shared/games';

@Component({
  selector: 'app-liens-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './liens-form.component.html',
  styleUrls: ['./liens-form.component.scss'],
})
export class LiensFormComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input() initialData: LiensData | null = null;
  @Output() dataChange = new EventEmitter<LiensData>();
  @Output() validityChange = new EventEmitter<boolean>();

  form: FormGroup;
  private isInitializing = false;

  constructor() {
    this.form = this.fb.group({
      mots: this.fb.array<FormControl<string>>([]),
      reponses: this.fb.array<FormControl<string>>([]),
    });

    this.form.valueChanges.subscribe(() => {
      // Ignorer les émissions pendant l'initialisation pour éviter les boucles infinies
      if (this.isInitializing) {
        return;
      }
      const mots = this.motsArray.value.filter((m: string) => m && m.trim());
      const reponses = this.reponsesArray.value.filter((r: string) => r && r.trim());
      
      // Générer automatiquement les liens : chaque mot à l'index i est associé à la réponse à l'index i
      // Utiliser le contenu (string) plutôt que les index pour permettre le mélange
      const liens = mots.map((mot, index) => ({
        mot: mot,
        reponse: reponses[index] || '',
      })).filter(lien => lien.mot && lien.reponse); // Filtrer les associations incomplètes

      // Valider que le nombre de mots correspond au nombre de réponses
      const isValid = mots.length > 0 && reponses.length > 0 && mots.length === reponses.length;

      if (isValid) {
        const liensData: LiensData = {
          mots: mots,
          reponses: reponses,
          liens: liens,
        };
        this.dataChange.emit(liensData);
      }
      this.validityChange.emit(isValid);
    });
  }

  get motsArray(): FormArray<FormControl<string>> {
    return this.form.get('mots') as FormArray<FormControl<string>>;
  }

  get reponsesArray(): FormArray<FormControl<string>> {
    return this.form.get('reponses') as FormArray<FormControl<string>>;
  }

  addMot(): void {
    this.motsArray.push(new FormControl<string>('', { nonNullable: true }));
  }

  removeMot(index: number): void {
    this.motsArray.removeAt(index);
  }

  addReponse(): void {
    this.reponsesArray.push(new FormControl<string>('', { nonNullable: true }));
  }

  removeReponse(index: number): void {
    this.reponsesArray.removeAt(index);
  }


  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialData'] && this.initialData) {
      // Activer le flag pour ignorer les émissions pendant l'initialisation
      this.isInitializing = true;
      this.motsArray.clear();
      this.reponsesArray.clear();

      this.initialData.mots.forEach(mot => {
        this.motsArray.push(new FormControl<string>(mot, { nonNullable: true }));
      });

      this.initialData.reponses.forEach(reponse => {
        this.reponsesArray.push(new FormControl<string>(reponse, { nonNullable: true }));
      });
      
      // Désactiver le flag après le chargement initial
      setTimeout(() => {
        this.isInitializing = false;
      }, 0);
    }
  }
}

