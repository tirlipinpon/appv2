import { Component, Input, Output, EventEmitter, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmationDialogService } from '../../../../../../shared';
import { isGameType, isGameTypeOneOf, normalizeGameTypeName } from '../../../../utils/game-type.util';
import { CaseVideFormComponent } from '../case-vide-form/case-vide-form.component';
import { ReponseLibreFormComponent } from '../reponse-libre-form/reponse-libre-form.component';
import { LiensFormComponent } from '../liens-form/liens-form.component';
import { ChronologieFormComponent } from '../chronologie-form/chronologie-form.component';
import { QcmFormComponent } from '../qcm-form/qcm-form.component';
import { VraiFauxFormComponent } from '../vrai-faux-form/vrai-faux-form.component';
import { MemoryFormComponent } from '../memory-form/memory-form.component';
import { GameGlobalFieldsComponent, type GameGlobalFieldsData } from '../game-global-fields/game-global-fields.component';
import type { GeneratedGameWithState } from '../../../../types/ai-game-generation';
import type { GameType } from '../../../../types/game-type';
import type { CaseVideData, ReponseLibreData, LiensData, ChronologieData, QcmData, VraiFauxData, MemoryData } from '@shared/games';

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
    MemoryFormComponent,
    GameGlobalFieldsComponent,
  ],
  templateUrl: './ai-generated-preview.component.html',
  styleUrls: ['./ai-generated-preview.component.scss'],
})
export class AIGeneratedPreviewComponent {
  private readonly confirmationDialog = inject(ConfirmationDialogService);
  
  // Exposer les fonctions utilitaires pour le template
  readonly isGameType = isGameType;
  readonly normalizeGameTypeName = normalizeGameTypeName;

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

  async onRemove(game: GeneratedGameWithState): Promise<void> {
    const confirmed = await this.confirmationDialog.confirm({
      message: 'Êtes-vous sûr de vouloir supprimer ce jeu généré ?',
      type: 'warning',
    });

    if (confirmed) {
      this.remove.emit(game._tempId);
    }
  }

  onGameDataChange(game: GeneratedGameWithState, data: CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData): void {
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
    if (isGameType(typeName, 'case vide') && game.metadata) {
      // Accepter le nouveau format (texte + cases_vides) ou l'ancien format (debut_phrase)
      if (('texte' in game.metadata && 'cases_vides' in game.metadata) || 'debut_phrase' in game.metadata) {
        return game.metadata as unknown as CaseVideData;
      }
    }
    return null;
  }

  getInitialDataForReponseLibre(game: GeneratedGameWithState): ReponseLibreData | null {
    const typeName = this.getGameTypeName(game);
    if (isGameType(typeName, 'reponse libre') && game.metadata && 'reponse_valide' in game.metadata && !('debut_phrase' in game.metadata)) {
      return game.metadata as unknown as ReponseLibreData;
    }
    return null;
  }

  getInitialDataForLiens(game: GeneratedGameWithState): LiensData | null {
    const typeName = this.getGameTypeName(game);
    if (isGameType(typeName, 'liens') && game.metadata && 'mots' in game.metadata && 'reponses' in game.metadata && 'liens' in game.metadata) {
      return game.metadata as unknown as LiensData;
    }
    return null;
  }

  getInitialDataForChronologie(game: GeneratedGameWithState): ChronologieData | null {
    const typeName = this.getGameTypeName(game);
    if (isGameType(typeName, 'chronologie') && game.metadata && 'mots' in game.metadata && 'ordre_correct' in game.metadata && !('reponses' in game.metadata)) {
      return game.metadata as unknown as ChronologieData;
    }
    return null;
  }

  getInitialDataForQcm(game: GeneratedGameWithState): QcmData | null {
    const typeName = this.getGameTypeName(game);
    if (isGameType(typeName, 'qcm') && game.metadata && 'propositions' in game.metadata && 'reponses_valides' in game.metadata) {
      return game.metadata as unknown as QcmData;
    }
    return null;
  }

  getInitialDataForVraiFaux(game: GeneratedGameWithState): VraiFauxData | null {
    const typeName = this.getGameTypeName(game).toLowerCase();
    // Normaliser le nom du type (peut être "vrai/faux", "vrai faux", etc.)
    const normalizedTypeName = typeName.replace(/\s+/g, '/').toLowerCase();
    
    if (isGameTypeOneOf(typeName, 'vrai/faux', 'vrai-faux') && game.metadata) {
      const metadata = game.metadata as any;
      
      // Vérifier si les métadonnées contiennent des énoncés
      if (metadata.enonces && Array.isArray(metadata.enonces)) {
        // Normaliser les énoncés : s'assurer que chaque énoncé a texte et reponse_correcte
        const normalizedEnonces = metadata.enonces.map((enonce: any) => {
          if (typeof enonce === 'string') {
            // Si c'est juste une string, créer un énoncé avec réponse par défaut
            return { texte: enonce, reponse_correcte: true };
          } else if (enonce && typeof enonce === 'object') {
            // S'assurer que reponse_correcte est un boolean
            return {
              texte: enonce.texte || enonce.text || String(enonce),
              reponse_correcte: typeof enonce.reponse_correcte === 'boolean' 
                ? enonce.reponse_correcte 
                : (enonce.reponse_correcte === 'vrai' || enonce.reponse_correcte === true || enonce.reponse_correcte === 'true')
            };
          }
          return null;
        }).filter((e: any) => e && e.texte);
        
        if (normalizedEnonces.length > 0) {
          return { enonces: normalizedEnonces };
        }
      }
    }
    return null;
  }

  getInitialDataForMemory(game: GeneratedGameWithState): MemoryData | null {
    const typeName = this.getGameTypeName(game);
    if (isGameType(typeName, 'memory') && game.metadata && 'paires' in game.metadata) {
      return game.metadata as unknown as MemoryData;
    }
    return null;
  }

  formatMetadataForDisplay(game: GeneratedGameWithState): string {
    const typeName = normalizeGameTypeName(this.getGameTypeName(game));
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
      
      case 'memory':
        const memory = metadata as unknown as MemoryData;
        return `${memory.paires?.length || 0} paire(s) de cartes`;
      
      default:
        return JSON.stringify(metadata).substring(0, 100);
    }
  }
}

