import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { CaseVideData, ReponseLibreData, LiensData, ChronologieData, QcmData } from '../../../../types/game-data';
import type { GameGlobalFieldsData } from '../game-global-fields/game-global-fields.component';

@Component({
  selector: 'app-game-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-preview.component.html',
  styleUrl: './game-preview.component.scss',
})
export class GamePreviewComponent {
  @Input() isOpen = false;
  @Input() gameTypeName: string = '';
  @Input() globalFields: GameGlobalFieldsData | null = null;
  @Input() gameData: CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | null = null;
  
  @Output() closed = new EventEmitter<void>();

  // Pour QCM - réponses sélectionnées
  selectedAnswers = signal<Set<number>>(new Set());

  // Pour Case Vide et Réponse Libre - réponse saisie
  userAnswer = signal<string>('');

  // Pour Liens - associations faites par l'utilisateur (mot -> reponse)
  userLinks = signal<Map<string, string>>(new Map());

  // Pour Chronologie - ordre choisi par l'utilisateur
  userOrder = signal<string[]>([]);

  // État de validation (pour montrer si c'est correct ou non)
  isSubmitted = signal<boolean>(false);
  isCorrect = signal<boolean | null>(null);

  close(): void {
    this.closed.emit();
    this.reset();
  }

  reset(): void {
    this.selectedAnswers.set(new Set());
    this.userAnswer.set('');
    this.userLinks.set(new Map());
    this.userOrder.set([]);
    this.selectedMotForLink.set(null);
    this.isSubmitted.set(false);
    this.isCorrect.set(null);
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('preview-backdrop')) {
      this.close();
    }
  }

  // Méthodes pour QCM
  toggleQcmAnswer(index: number): void {
    if (this.isSubmitted()) return;
    const answers = new Set(this.selectedAnswers());
    if (answers.has(index)) {
      answers.delete(index);
    } else {
      answers.add(index);
    }
    this.selectedAnswers.set(answers);
  }

  submitQcm(): void {
    if (this.isSubmitted()) return;
    const qcmData = this.gameData as QcmData;
    if (!qcmData) return;

    const selectedPropositions = Array.from(this.selectedAnswers()).map(i => qcmData.propositions[i]);
    const isValid = selectedPropositions.length === qcmData.reponses_valides.length &&
      selectedPropositions.every(prop => qcmData.reponses_valides.includes(prop));

    this.isSubmitted.set(true);
    this.isCorrect.set(isValid);
  }

  // Méthodes pour Case Vide
  submitCaseVide(): void {
    if (this.isSubmitted()) return;
    const caseVideData = this.gameData as CaseVideData;
    if (!caseVideData) return;

    const isValid = this.userAnswer().trim().toLowerCase() === caseVideData.reponse_valide.trim().toLowerCase();
    this.isSubmitted.set(true);
    this.isCorrect.set(isValid);
  }

  // Méthodes pour Réponse Libre
  submitReponseLibre(): void {
    if (this.isSubmitted()) return;
    const reponseLibreData = this.gameData as ReponseLibreData;
    if (!reponseLibreData) return;

    const isValid = this.userAnswer().trim().toLowerCase() === reponseLibreData.reponse_valide.trim().toLowerCase();
    this.isSubmitted.set(true);
    this.isCorrect.set(isValid);
  }

  // Pour les liens - mot sélectionné pour créer un lien
  selectedMotForLink = signal<string | null>(null);

  // Méthodes pour Liens
  selectMot(mot: string): void {
    if (this.isSubmitted()) return;
    const current = this.selectedMotForLink();
    if (current === mot) {
      // Désélectionner si déjà sélectionné
      this.selectedMotForLink.set(null);
    } else {
      this.selectedMotForLink.set(mot);
    }
  }

  selectReponse(reponse: string): void {
    if (this.isSubmitted()) return;
    const selectedMot = this.selectedMotForLink();
    if (!selectedMot) return;

    const links = new Map(this.userLinks());
    // Si ce mot a déjà une réponse, on la retire
    if (links.has(selectedMot)) {
      links.delete(selectedMot);
    }
    // Si cette réponse est déjà liée à un autre mot, on retire l'ancien lien
    for (const [existingMot, existingReponse] of links.entries()) {
      if (existingReponse === reponse) {
        links.delete(existingMot);
        break;
      }
    }
    // On crée le nouveau lien
    links.set(selectedMot, reponse);
    this.userLinks.set(links);
    this.selectedMotForLink.set(null); // Réinitialiser la sélection
  }

  submitLiens(): void {
    if (this.isSubmitted()) return;
    const liensData = this.gameData as LiensData;
    if (!liensData) return;

    const userLinksArray = Array.from(this.userLinks().entries()).map(([mot, reponse]) => ({ mot, reponse }));
    const correctLinks = liensData.liens;

    const isValid = userLinksArray.length === correctLinks.length &&
      userLinksArray.every(link => 
        correctLinks.some(correct => correct.mot === link.mot && correct.reponse === link.reponse)
      );

    this.isSubmitted.set(true);
    this.isCorrect.set(isValid);
  }

  isLinkSelected(mot: string, reponse: string): boolean {
    return this.userLinks().get(mot) === reponse;
  }

  // Méthodes pour Chronologie
  moveToOrder(mot: string): void {
    if (this.isSubmitted()) return;
    const order = [...this.userOrder()];
    if (!order.includes(mot)) {
      order.push(mot);
    }
    this.userOrder.set(order);
  }

  removeFromOrder(index: number): void {
    if (this.isSubmitted()) return;
    const order = [...this.userOrder()];
    order.splice(index, 1);
    this.userOrder.set(order);
  }

  submitChronologie(): void {
    if (this.isSubmitted()) return;
    const chronologieData = this.gameData as ChronologieData;
    if (!chronologieData) return;

    const isValid = JSON.stringify(this.userOrder()) === JSON.stringify(chronologieData.ordre_correct);
    this.isSubmitted.set(true);
    this.isCorrect.set(isValid);
  }

  getRemainingWords(): string[] {
    const chronologieData = this.gameData as ChronologieData;
    if (!chronologieData) return [];
    return chronologieData.mots.filter(mot => !this.userOrder().includes(mot));
  }

  // Getters pour éviter les castings dans le template
  get qcmData(): QcmData | null {
    return this.gameTypeName.toLowerCase() === 'qcm' && this.gameData ? this.gameData as QcmData : null;
  }

  get caseVideData(): CaseVideData | null {
    return this.gameTypeName.toLowerCase() === 'case vide' && this.gameData ? this.gameData as CaseVideData : null;
  }

  get reponseLibreData(): ReponseLibreData | null {
    return this.gameTypeName.toLowerCase() === 'reponse libre' && this.gameData ? this.gameData as ReponseLibreData : null;
  }

  get liensData(): LiensData | null {
    return this.gameTypeName.toLowerCase() === 'liens' && this.gameData ? this.gameData as LiensData : null;
  }

  get chronologieData(): ChronologieData | null {
    return this.gameTypeName.toLowerCase() === 'chronologie' && this.gameData ? this.gameData as ChronologieData : null;
  }

  // Méthodes helper pour les liens
  getLiensMots(): string[] {
    return this.liensData?.mots || [];
  }

  getLiensReponses(): string[] {
    return this.liensData?.reponses || [];
  }

  findMotForReponse(reponse: string): string {
    const liensData = this.liensData;
    if (!liensData) return '';
    const mot = liensData.mots.find(m => this.userLinks().get(m) === reponse);
    return mot || '';
  }

  isMotSelected(mot: string): boolean {
    return this.selectedMotForLink() === mot;
  }

  getReponseForMot(mot: string): string | null {
    return this.userLinks().get(mot) || null;
  }

  isReponseValideQcm(prop: string): boolean {
    return this.qcmData?.reponses_valides.includes(prop) || false;
  }

  getQcmValidAnswersText(): string {
    return this.qcmData?.reponses_valides.join(', ') || '';
  }

  getCaseVideReponseValide(): string {
    return this.caseVideData?.reponse_valide || '';
  }

  getReponseLibreReponseValide(): string {
    return this.reponseLibreData?.reponse_valide || '';
  }

  canSubmitChronologie(): boolean {
    const chronologieData = this.chronologieData;
    if (!chronologieData) return false;
    return this.userOrder().length === chronologieData.mots.length;
  }

  // Helper pour les aides
  hasAides(): boolean {
    return !!this.globalFields?.aides && this.globalFields.aides.length > 0;
  }

  getAides(): string[] {
    return this.globalFields?.aides || [];
  }
}

