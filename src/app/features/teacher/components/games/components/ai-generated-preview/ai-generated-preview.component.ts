import { Component, Input, Output, EventEmitter, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CaseVideFormComponent } from '../case-vide-form/case-vide-form.component';
import { ReponseLibreFormComponent } from '../reponse-libre-form/reponse-libre-form.component';
import { LiensFormComponent } from '../liens-form/liens-form.component';
import { ChronologieFormComponent } from '../chronologie-form/chronologie-form.component';
import { QcmFormComponent } from '../qcm-form/qcm-form.component';
import { VraiFauxFormComponent } from '../vrai-faux-form/vrai-faux-form.component';
import { GameGlobalFieldsComponent, type GameGlobalFieldsData } from '../game-global-fields/game-global-fields.component';
import type { GeneratedGameWithState } from '../../../../types/ai-game-generation';
import type { GameType } from '../../../../types/game-type';
import type { CaseVideData, ReponseLibreData, LiensData, ChronologieData, QcmData, VraiFauxData } from '../../../../types/game-data';

@Component({
  selector: 'app-ai-generated-preview',
  standalone: true,
  imports: [
    CommonModule,
    CaseVideFormComponent,
    ReponseLibreFormComponent,
    LiensFormComponent,
    ChronologieFormComponent,
    QcmFormComponent,
    VraiFauxFormComponent,
    GameGlobalFieldsComponent,
  ],
  templateUrl: './ai-generated-preview.component.html',
  styleUrls: ['./ai-generated-preview.component.scss'],
})
export class AIGeneratedPreviewComponent {
  @Input() generatedGames: GeneratedGameWithState[] = [];
  @Input() gameTypes: GameType[] = [];

  @Output() edit = new EventEmitter<string>();
  @Output() remove = new EventEmitter<string>();
  @Output() updateGame = new EventEmitter<{ tempId: string; updates: Partial<GeneratedGameWithState> }>();
  @Output() saveAll = new EventEmitter<void>();
  @Output() cancelAll = new EventEmitter<void>();

  getGameTypeName(game: GeneratedGameWithState): string {
    const gameType = this.gameTypes.find(gt => gt.id === game.game_type_id);
    return gameType?.name || 'Type inconnu';
  }

  toggleEdit(game: GeneratedGameWithState): void {
    this.edit.emit(game._tempId);
  }

  onRemove(game: GeneratedGameWithState): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce jeu généré ?')) {
      this.remove.emit(game._tempId);
    }
  }

  onGameDataChange(game: GeneratedGameWithState, data: CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData): void {
    this.updateGame.emit({
      tempId: game._tempId,
      updates: { metadata: data as unknown as Record<string, unknown> }
    });
  }

  onGameValidityChange(valid: boolean): void {
    // La validité est gérée par les composants enfants
  }

  onGlobalFieldsChange(game: GeneratedGameWithState, data: GameGlobalFieldsData): void {
    this.updateGame.emit({
      tempId: game._tempId,
      updates: {
        instructions: data.instructions,
        question: data.question,
        aides: data.aides,
      }
    });
  }

  getGlobalFieldsData(game: GeneratedGameWithState): GameGlobalFieldsData {
    return {
      instructions: game.instructions || null,
      question: game.question || null,
      aides: game.aides || null,
    };
  }

  onGlobalFieldsValidityChange(): void {
    // La validité est toujours vraie pour les champs globaux (optionnels)
  }

  getInitialDataForCaseVide(game: GeneratedGameWithState): CaseVideData | null {
    const typeName = this.getGameTypeName(game);
    if (typeName.toLowerCase() === 'case vide' && game.metadata) {
      // Accepter le nouveau format (texte + cases_vides) ou l'ancien format (debut_phrase)
      if (('texte' in game.metadata && 'cases_vides' in game.metadata) || 'debut_phrase' in game.metadata) {
        return game.metadata as unknown as CaseVideData;
      }
    }
    return null;
  }

  getInitialDataForReponseLibre(game: GeneratedGameWithState): ReponseLibreData | null {
    const typeName = this.getGameTypeName(game);
    if (typeName.toLowerCase() === 'reponse libre' && game.metadata && 'reponse_valide' in game.metadata && !('debut_phrase' in game.metadata)) {
      return game.metadata as unknown as ReponseLibreData;
    }
    return null;
  }

  getInitialDataForLiens(game: GeneratedGameWithState): LiensData | null {
    const typeName = this.getGameTypeName(game);
    if (typeName.toLowerCase() === 'liens' && game.metadata && 'mots' in game.metadata && 'reponses' in game.metadata && 'liens' in game.metadata) {
      return game.metadata as unknown as LiensData;
    }
    return null;
  }

  getInitialDataForChronologie(game: GeneratedGameWithState): ChronologieData | null {
    const typeName = this.getGameTypeName(game);
    if (typeName.toLowerCase() === 'chronologie' && game.metadata && 'mots' in game.metadata && 'ordre_correct' in game.metadata && !('reponses' in game.metadata)) {
      return game.metadata as unknown as ChronologieData;
    }
    return null;
  }

  getInitialDataForQcm(game: GeneratedGameWithState): QcmData | null {
    const typeName = this.getGameTypeName(game);
    if (typeName.toLowerCase() === 'qcm' && game.metadata && 'propositions' in game.metadata && 'reponses_valides' in game.metadata) {
      return game.metadata as unknown as QcmData;
    }
    return null;
  }

  getInitialDataForVraiFaux(game: GeneratedGameWithState): VraiFauxData | null {
    const typeName = this.getGameTypeName(game);
    if (typeName.toLowerCase() === 'vrai/faux' && game.metadata && 'enonces' in game.metadata) {
      return game.metadata as unknown as VraiFauxData;
    }
    return null;
  }

  formatMetadataForDisplay(game: GeneratedGameWithState): string {
    const typeName = this.getGameTypeName(game).toLowerCase();
    const metadata = game.metadata;

    if (!metadata) return 'Pas de métadonnées';

    switch (typeName) {
      case 'qcm':
        const qcm = metadata as unknown as QcmData;
        return `${qcm.propositions?.length || 0} propositions, ${qcm.reponses_valides?.length || 0} bonne(s) réponse(s)`;
      
      case 'case vide':
        const caseVide = metadata as unknown as CaseVideData;
        return `"${caseVide.debut_phrase || ''} ___ ${caseVide.fin_phrase || ''}"`;
      
      case 'reponse libre':
        const reponseLibre = metadata as unknown as ReponseLibreData;
        return `Réponse attendue: "${reponseLibre.reponse_valide || 'N/A'}"`;
      
      case 'liens':
        const liens = metadata as unknown as LiensData;
        return `${liens.mots?.length || 0} mots à relier`;
      
      case 'chronologie':
        const chronologie = metadata as unknown as ChronologieData;
        return `${chronologie.mots?.length || 0} éléments à ordonner`;
      
      case 'vrai/faux':
        const vraiFaux = metadata as unknown as VraiFauxData;
        return `${vraiFaux.enonces?.length || 0} énoncé(s)`;
      
      default:
        return JSON.stringify(metadata).substring(0, 100);
    }
  }
}

