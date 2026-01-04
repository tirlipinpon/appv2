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
      paires: this.fb.array<FormGroup<{ mot: FormControl<string>; reponse: FormControl<string> }>>([]),
      mots_leurres: this.fb.array<FormControl<string>>([]),
    });

    this.form.valueChanges.subscribe(() => {
      // Ignorer les émissions pendant l'initialisation pour éviter les boucles infinies
      if (this.isInitializing) {
        return;
      }
      
      const paires = this.pairesArray.value
        .map((paire) => ({
          mot: (paire.mot || '').trim(),
          reponse: (paire.reponse || '').trim(),
        }))
        .filter((paire) => paire.mot && paire.reponse);
      
      const mots = paires.map((paire) => paire.mot);
      const reponses = paires.map((paire) => paire.reponse);
      
      // Générer automatiquement les liens : chaque paire est un lien
      const liens = paires.map((paire) => ({
        mot: paire.mot,
        reponse: paire.reponse,
      }));

      const motsLeurres = this.motsLeurresArray.value
        .filter((m: string) => m && m.trim())
        .map((m: string) => m.trim());

      // Valider qu'il y a au moins une paire complète
      const isValid = paires.length > 0;

      if (isValid) {
        const liensData: LiensData = {
          mots: mots,
          reponses: reponses,
          liens: liens,
          mots_leurres: motsLeurres.length > 0 ? motsLeurres : undefined,
        };
        this.dataChange.emit(liensData);
      }
      this.validityChange.emit(isValid);
    });
  }

  get pairesArray(): FormArray<FormGroup<{ mot: FormControl<string>; reponse: FormControl<string> }>> {
    return this.form.get('paires') as FormArray<FormGroup<{ mot: FormControl<string>; reponse: FormControl<string> }>>;
  }

  get motsLeurresArray(): FormArray<FormControl<string>> {
    return this.form.get('mots_leurres') as FormArray<FormControl<string>>;
  }

  addPaire(): void {
    const paireGroup = this.fb.group({
      mot: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
      reponse: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    });
    this.pairesArray.push(paireGroup);
  }

  removePaire(index: number): void {
    this.pairesArray.removeAt(index);
  }

  addMotLeurre(): void {
    this.motsLeurresArray.push(new FormControl<string>('', { nonNullable: true }));
  }

  removeMotLeurre(index: number): void {
    this.motsLeurresArray.removeAt(index);
  }

  getPaireFormGroup(index: number): FormGroup<{ mot: FormControl<string>; reponse: FormControl<string> }> {
    return this.pairesArray.at(index) as FormGroup<{ mot: FormControl<string>; reponse: FormControl<string> }>;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialData']) {
      // Activer le flag pour ignorer les émissions pendant l'initialisation
      this.isInitializing = true;
      this.pairesArray.clear();
      this.motsLeurresArray.clear();

      if (this.initialData) {
        // Charger les données existantes (mode édition)
        // Créer les paires à partir des mots et réponses
        const maxLength = Math.max(this.initialData.mots?.length || 0, this.initialData.reponses?.length || 0);
        for (let i = 0; i < maxLength; i++) {
          const paireGroup = this.fb.group({
            mot: new FormControl<string>(this.initialData.mots[i] || '', { nonNullable: true, validators: [Validators.required] }),
            reponse: new FormControl<string>(this.initialData.reponses[i] || '', { nonNullable: true, validators: [Validators.required] }),
          });
          this.pairesArray.push(paireGroup);
        }

        // Charger les mots leurres
        if (this.initialData.mots_leurres) {
          this.initialData.mots_leurres.forEach(mot => {
            this.motsLeurresArray.push(new FormControl<string>(mot, { nonNullable: true }));
          });
        }
      } else {
        // Réinitialiser le formulaire (mode création) - créer 2 paires par défaut
        for (let i = 0; i < 2; i++) {
          this.addPaire();
        }
      }
      
      // Désactiver le flag après le chargement initial
      setTimeout(() => {
        this.isInitializing = false;
        // Émettre la validité (false car les paires par défaut sont vides)
        this.validityChange.emit(false);
      }, 0);
    }
  }
}
