import { Injectable, inject } from '@angular/core';
import { Observable, from, map, catchError, throwError } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { SupabaseService } from '../../../../shared/services/supabase/supabase.service';
import { Game, GameCreate } from '../../types/game';
import { GameType } from '../../types/game-type';
import type {
  AIGameGenerationRequest,
  AIRawResponse,
  AIRawGameResponse,
} from '../../types/ai-game-generation';
import { getAgeFromSchoolYear } from '../../utils/school-levels.util';

@Injectable({
  providedIn: 'root',
})
export class AIGameGeneratorService {
  private readonly supabaseService = inject(SupabaseService);

  constructor() {
    // Service utilise maintenant le proxy Supabase Edge Function
    // au lieu d'appeler directement l'API DeepSeek (problème CORS résolu)
  }

  /**
   * Génère UN SEUL jeu pédagogique via l'API DeepSeek (via proxy Supabase)
   * Pour générer plusieurs jeux, appeler cette méthode plusieurs fois
   */
  generateSingleGame(
    request: AIGameGenerationRequest,
    gameTypes: GameType[],
    pdfText?: string,
    existingGames: Game[] = [] // Jeux existants dans la base de données
  ): Observable<GameCreate> {
    // Modifier la requête pour générer 1 seul jeu
    const singleGameRequest = { ...request, numberOfGames: 1 };
    const prompt = this.buildPrompt(singleGameRequest, gameTypes, pdfText, existingGames, request.alreadyGeneratedInSession || []);

    return from(this.callDeepSeekProxy(prompt)).pipe(
      map((response) => {
        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('Aucune réponse de l\'IA');
        }

        const parsedResponse: AIRawResponse = JSON.parse(content);
        if (!parsedResponse.games || parsedResponse.games.length === 0) {
          throw new Error('Aucun jeu généré par l\'IA');
        }

        // Retourner uniquement le premier jeu
        const games = this.transformToGameCreate(
          parsedResponse.games,
          request.subjectId,
          gameTypes
        );
        return games[0];
      }),
      catchError((error) => {
        console.error('Erreur lors de la génération du jeu:', error);
        return throwError(
          () =>
            new Error(
              `Erreur lors de la génération: ${error.message || 'Erreur inconnue'}`
            )
        );
      })
    );
  }

  /**
   * Génère des jeux pédagogiques via l'API DeepSeek (via proxy Supabase)
   * @deprecated Utiliser generateSingleGame() avec des appels séquentiels pour un meilleur contrôle
   */
  generateGames(
    request: AIGameGenerationRequest,
    gameTypes: GameType[],
    pdfText?: string
  ): Observable<GameCreate[]> {
    const prompt = this.buildPrompt(request, gameTypes, pdfText);

    return from(this.callDeepSeekProxy(prompt)).pipe(
      map((response) => {
        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('Aucune réponse de l\'IA');
        }

        const parsedResponse: AIRawResponse = JSON.parse(content);
        return this.transformToGameCreate(
          parsedResponse.games,
          request.subjectId,
          gameTypes
        );
      }),
      catchError((error) => {
        console.error('Erreur lors de la génération des jeux:', error);
        return throwError(
          () =>
            new Error(
              `Erreur lors de la génération: ${error.message || 'Erreur inconnue'}`
            )
        );
      })
    );
  }

  /**
   * Appelle le proxy Supabase Edge Function pour DeepSeek
   */
  private async callDeepSeekProxy(prompt: string): Promise<any> {
    // Obtenir la session Supabase pour l'authentification
    const {
      data: { session },
    } = await this.supabaseService.client.auth.getSession();

    // Construire les headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      apikey: environment.supabaseAnonKey,
    };

    // Ajouter le token d'authentification si disponible
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    // Appeler le proxy Supabase Edge Function
    const response = await fetch(environment.deepseekProxy.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: environment.deepseek.model,
        messages: [
          {
            role: 'system',
            content:
              'Tu es un expert en pédagogie française spécialisé dans la création de jeux éducatifs adaptés à chaque niveau scolaire.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(
        `Proxy Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
      );
    }

    return await response.json();
  }

  /**
   * Construit le prompt pour DeepSeek
   */
  private buildPrompt(
    request: AIGameGenerationRequest,
    gameTypes: GameType[],
    pdfText?: string,
    existingGames: Game[] = [],
    alreadyGeneratedInSession: { question: string | null; game_type_id: string; metadata: Record<string, unknown> | null }[] = []
  ): string {
    const ageRange = getAgeFromSchoolYear(request.schoolYearLabel);

    // Filtrer les types de jeux selon la sélection de l'utilisateur
    let availableGameTypes = gameTypes;
    let typeSelectionInstructions = '';
    
    // Utiliser remainingGameTypeIds si disponible (priorité), sinon selectedGameTypeIds
    const typesToUse = request.remainingGameTypeIds ?? request.selectedGameTypeIds;
    
    if (typesToUse && typesToUse.length > 0) {
      availableGameTypes = gameTypes.filter(gt => typesToUse.includes(gt.id));
      const selectedTypeNames = availableGameTypes.map(gt => gt.name);
      const numberOfRemainingTypes = typesToUse.length;

      if (numberOfRemainingTypes === 1) {
        // Un seul type restant : forcer ce type
        typeSelectionInstructions = `
TYPE OBLIGATOIRE:
- Tu DOIS créer ce jeu du type "${selectedTypeNames[0]}" uniquement.
- Ne PAS utiliser d'autres types de jeux.
`;
      } else if (numberOfRemainingTypes > 1) {
        // Plusieurs types restants : choisir parmi eux
        typeSelectionInstructions = `
TYPES AUTORISÉS (choisir UN parmi ceux-ci):
- Tu DOIS choisir UN type parmi: ${selectedTypeNames.join(', ')}.
- IMPORTANT: Utilise un type qui n'a PAS encore été utilisé dans les jeux précédents.
- Si tous les types ont déjà été utilisés, choisis celui qui a été le moins utilisé.
`;
      }
    }

    // Construire la liste des types de jeux disponibles avec leur structure
    const gameTypesDescription = availableGameTypes
      .map((gt) => {
        let typeSpecificInstructions = '';
        
        // Instructions spécifiques pour le type "case vide"
        if (gt.name.toLowerCase() === 'case vide') {
          typeSpecificInstructions = `
EXEMPLE CONCRET pour "case vide":
- Texte: "Le matin, le petit [chat] boit son bol de [lait]. Ensuite, il joue avec une [balle] dans le jardin."
- Les mots entre crochets [mot] indiquent les cases vides à remplir
- cases_vides: [{index: 1, reponse_correcte: "chat"}, {index: 2, reponse_correcte: "lait"}, {index: 3, reponse_correcte: "balle"}]
- banque_mots: ["chat", "lait", "balle", "chien", "eau", "voiture"] (mots corrects + leurres)
- IMPORTANT: Le texte doit contenir les mots entre crochets [mot] directement dans la phrase
`;
        }
        
        // Instructions spécifiques pour le type "memory"
        if (gt.name.toLowerCase() === 'memory') {
          typeSpecificInstructions = `
EXEMPLE CONCRET pour "memory":
- paires: EXACTEMENT 4 paires (pas plus, pas moins)
- Chaque paire doit avoir une question et une réponse
- Exemple: [{"question": "Quelle est la capitale de la France ?", "reponse": "Paris"}, {"question": "Combien font 2+2 ?", "reponse": "4"}, {"question": "Quelle couleur fait le mélange de rouge et bleu ?", "reponse": "Violet"}, {"question": "Combien de côtés a un triangle ?", "reponse": "3"}]
- IMPORTANT: Le tableau paires doit contenir EXACTEMENT 4 éléments, ni plus ni moins
`;
        }
        
        return `
**${gt.name}**:
${gt.description || 'Pas de description'}
Structure metadata: ${this.getMetadataStructureDescription(gt.name)}
${typeSpecificInstructions}
`;
      })
      .join('\n');

    // Construire la liste des jeux existants pour éviter les doublons
    let existingGamesSection = '';
    const allExistingGames = [...existingGames, ...alreadyGeneratedInSession.map(g => ({
      question: g.question,
      game_type_id: g.game_type_id,
      metadata: g.metadata,
      instructions: null
    } as Game))];
    
    if (allExistingGames.length > 0) {
      const MAX_GAMES_TO_SHOW = 15; // Garder 15 jeux
      const totalGames = allExistingGames.length;
      
      // Trier par date de création (les plus récents en premier) si disponible
      // Sinon, prendre les derniers de la liste
      const recentGames = allExistingGames.slice(-MAX_GAMES_TO_SHOW).reverse();
      
      // Créer un résumé statistique des types de jeux
      const gameTypeStats = this.getGameTypeStatistics(allExistingGames, gameTypes);
      
      // Format ultra-compact pour chaque jeu (une seule ligne)
      const existingGamesList = recentGames
        .map((game, index) => {
          const gameTypeName = gameTypes.find(gt => gt.id === game.game_type_id)?.name || 'Inconnu';
          // Limiter la question à 50 caractères max
          const questionPreview = game.question 
            ? (game.question.length > 50 ? game.question.substring(0, 50) + '...' : game.question)
            : 'Sans question';
          // Format compact : [Type] Question (sans instructions ni métadonnées détaillées)
          return `${index + 1}. [${gameTypeName}] ${questionPreview}`;
        })
        .join('\n');

      existingGamesSection = `
JEUX EXISTANTS (${totalGames} total, ${recentGames.length} exemples récents):
Distribution: ${gameTypeStats}
Exemples:
${existingGamesList}

IMPORTANT - ÉVITER LES DOUBLONS:
- Ne PAS créer de jeux similaires aux ${totalGames} jeux existants
- Varier les types (distribution actuelle: ${gameTypeStats})
- Proposer des angles NOUVEAUX et des approches différentes
- Créer des jeux ORIGINAUX qui complètent l'existant
`;
    }

    return `Tu es un générateur de jeux pédagogiques adapté au système éducatif français.

CONTEXTE:
- Matière: ${request.subjectName}
- Thème: ${request.subject}
- Niveau: ${request.schoolYearLabel} (${ageRange})
- Difficulté: ${request.difficulty}/5
${pdfText ? `- PDF: ${pdfText.substring(0, 2000)}...` : ''}

${existingGamesSection}

TYPES DE JEUX DISPONIBLES:
${gameTypesDescription}

${typeSelectionInstructions}

CONSIGNES:
1. Génère ${request.numberOfGames} jeux variés pour ${request.schoolYearLabel}
2. ${allExistingGames.length > 0 ? 'ÉVITE les doublons avec les jeux existants. ' : ''}Adapte au niveau ${ageRange}
3. ${request.selectedGameTypeIds && request.selectedGameTypeIds.length > 0 
    ? 'Respecte STRICTEMENT les types autorisés ci-dessus.' 
    : `Répartis les types intelligemment${allExistingGames.length > 0 ? ' (privilégie les types peu utilisés)' : ''}`}
4. 1-3 aides progressives par jeu
5. Respecte STRICTEMENT la structure JSON
6. QCM: 3-5 propositions DIFFÉRENTES et VARIÉES | Liens: 3-6 paires | Chronologie: 3-8 éléments | Memory: EXACTEMENT 4 paires (pas plus, pas moins)
7. Vocabulaire adapté à l'âge
8. IMPORTANT QCM: Chaque proposition doit être UNIQUE et DISTINCTE. Ne JAMAIS répéter la même réponse dans plusieurs propositions.
9. IMPORTANT MEMORY: 
   - Le champ "paires" doit contenir EXACTEMENT 4 paires (pas plus, pas moins)
   - Chaque paire doit avoir une "question" (string) et une "reponse" (string)
   - Ne JAMAIS créer plus ou moins de 4 paires
10. IMPORTANT CASE VIDE: 
   - Le champ "texte" doit contenir une phrase COMPLÈTE avec les mots à trouver entre crochets [mot]
   - Exemple: "Le matin, le petit [chat] boit son bol de [lait]."
   - Chaque [mot] dans le texte correspond à une case vide à remplir
   - Le champ "cases_vides" doit lister chaque case avec son index (1, 2, 3...) et la réponse correcte
   - Le champ "banque_mots" doit contenir les mots corrects + 2-4 mots leurres (mots incorrects mais plausibles)
   - Ne PAS utiliser l'ancien format (debut_phrase, fin_phrase) - utiliser TOUJOURS le nouveau format (texte, cases_vides, banque_mots)
${allExistingGames.length > 0 ? '11. CRÉATIVITÉ: Angles NOUVEAUX, approches variées' : ''}

FORMAT JSON (OBLIGATOIRE):
{
  "games": [
    {
      "type_name": "qcm",
      "question": "Question",
      "instructions": "Instructions",
      "metadata": { 
        "propositions": ["Proposition A", "Proposition B", "Proposition C"],
        "reponses_valides": ["Proposition A"]
      },
      "aides": ["Aide 1", "Aide 2"]
    },
    {
      "type_name": "case vide",
      "question": "Complète les phrases en remplissant les cases vides",
      "instructions": "Lis la phrase et choisis les bons mots dans la banque",
      "metadata": {
        "texte": "Le matin, le petit [chat] boit son bol de [lait].",
        "cases_vides": [
          {"index": 1, "reponse_correcte": "chat"},
          {"index": 2, "reponse_correcte": "lait"}
        ],
        "banque_mots": ["chat", "lait", "chien", "eau"]
      },
      "aides": ["Aide 1", "Aide 2"]
    }
  ]
}

IMPORTANT: 
- JSON valide uniquement, aucun texte avant/après
- Pour QCM: propositions doit contenir des réponses DIFFÉRENTES (ex: ["100", "200", "300"] pas ["345", "345", "345"])
- reponses_valides doit contenir UNIQUEMENT les propositions qui sont correctes (tableau de strings)
- Pour Memory: paires doit contenir EXACTEMENT 4 paires (pas plus, pas moins), chaque paire avec question et reponse (strings)`;
  }

  /**
   * Transforme la réponse brute de l'IA en objets GameCreate
   */
  private transformToGameCreate(
    rawGames: AIRawGameResponse[],
    subjectId: string,
    gameTypes: GameType[]
  ): GameCreate[] {
    return rawGames.map((rawGame) => {
      // Trouver l'ID du type de jeu
      const gameType = gameTypes.find(
        (gt) => gt.name.toLowerCase() === rawGame.type_name.toLowerCase()
      );

      if (!gameType) {
        console.warn(
          `Type de jeu "${rawGame.type_name}" non trouvé, utilisation du premier type disponible`
        );
      }

      const gameTypeId = gameType?.id || gameTypes[0]?.id || '';

      // Générer un nom automatique
      const typeName = gameType?.name || rawGame.type_name;
      const questionPreview = rawGame.question?.substring(0, 30) || '';
      const autoName = questionPreview
        ? `${typeName} - ${questionPreview}${questionPreview.length >= 30 ? '...' : ''}`
        : typeName;

      // Normaliser les métadonnées pour corriger les problèmes courants
      let normalizedMetadata = rawGame.metadata;
      if (rawGame.type_name.toLowerCase() === 'qcm' && rawGame.metadata) {
        normalizedMetadata = this.normalizeQcmMetadata(rawGame.metadata);
      }

      return {
        subject_id: subjectId,
        game_type_id: gameTypeId,
        name: autoName,
        instructions: rawGame.instructions || null,
        question: rawGame.question || null,
        reponses: null, // On utilise metadata pour les données spécifiques
        aides: rawGame.aides && rawGame.aides.length > 0 ? rawGame.aides : null,
        metadata: normalizedMetadata,
      };
    });
  }

  /**
   * Normalise les métadonnées QCM pour corriger les propositions dupliquées
   */
  private normalizeQcmMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    const qcm = metadata as unknown as { propositions?: string[]; reponses_valides?: string[] };
    
    if (!qcm.propositions || !Array.isArray(qcm.propositions)) {
      return metadata;
    }

    // Détecter et corriger les propositions dupliquées
    const uniquePropositions: string[] = [];
    const seen = new Set<string>();
    
    qcm.propositions.forEach((prop, index) => {
      const trimmedProp = prop?.trim() || '';
      if (trimmedProp && !seen.has(trimmedProp)) {
        seen.add(trimmedProp);
        uniquePropositions.push(trimmedProp);
      } else if (trimmedProp && seen.has(trimmedProp)) {
        // Proposition dupliquée détectée - ajouter un suffixe pour la différencier
        let counter = 1;
        let newProp = `${trimmedProp} (variante ${counter})`;
        while (seen.has(newProp)) {
          counter++;
          newProp = `${trimmedProp} (variante ${counter})`;
        }
        seen.add(newProp);
        uniquePropositions.push(newProp);
        console.warn(`Proposition dupliquée détectée à l'index ${index}: "${trimmedProp}". Remplacée par "${newProp}"`);
      }
    });

    // Filtrer les reponses_valides pour ne garder que celles qui existent dans les propositions uniques
    const validReponses = qcm.reponses_valides?.filter((rep: string) => 
      uniquePropositions.some(p => p === rep || p.startsWith(rep))
    ) || [];

    return {
      ...metadata,
      propositions: uniquePropositions,
      reponses_valides: validReponses.length > 0 ? validReponses : (uniquePropositions.length > 0 ? [uniquePropositions[0]] : [])
    };
  }

  /**
   * Retourne la description de la structure metadata pour un type de jeu
   */
  private getMetadataStructureDescription(typeName: string): string {
    const structures: Record<string, string> = {
      'case vide':
        '{ texte: string (phrase avec [mot] pour chaque case vide), cases_vides: [{index: number, reponse_correcte: string}], banque_mots: string[] }',
      'reponse libre': '{ reponse_valide: string }',
      liens: '{ mots: string[], reponses: string[], liens: {mot: string, reponse: string}[] }',
      chronologie: '{ mots: string[], ordre_correct: string[] }',
      qcm: '{ propositions: string[], reponses_valides: string[] }',
      memory: '{ paires: {question: string, reponse: string}[] }',
    };

    return (
      structures[typeName.toLowerCase()] ||
      '{ structure spécifique au type }'
    );
  }

  /**
   * Calcule les statistiques de distribution des types de jeux
   */
  private getGameTypeStatistics(games: Game[], gameTypes: GameType[]): string {
    const stats = new Map<string, number>();
    
    games.forEach(game => {
      const gameTypeName = gameTypes.find(gt => gt.id === game.game_type_id)?.name || 'Inconnu';
      stats.set(gameTypeName, (stats.get(gameTypeName) || 0) + 1);
    });
    
    const statsArray = Array.from(stats.entries())
      .map(([type, count]) => `${type}:${count}`)
      .join(' ');
    
    return statsArray || 'Aucune';
  }

  /**
   * Formate les métadonnées d'un jeu pour l'affichage dans le prompt
   */
  private formatMetadataForPrompt(metadata: Record<string, unknown>, gameTypeName: string): string {
    const typeName = gameTypeName.toLowerCase();
    
    try {
      if (typeName === 'qcm') {
        const qcm = metadata as unknown as { propositions?: string[]; reponses_valides?: string[] };
        const propositions = qcm.propositions?.slice(0, 3).join(', ') || '';
        return `${qcm.propositions?.length || 0} propositions${propositions ? ` (ex: ${propositions}...)` : ''}`;
      }
      
      if (typeName === 'case vide') {
        const caseVide = metadata as unknown as { debut_phrase?: string; fin_phrase?: string };
        const phrase = `${caseVide.debut_phrase || ''} ___ ${caseVide.fin_phrase || ''}`;
        return phrase.length > 80 ? `"${phrase.substring(0, 80)}..."` : `"${phrase}"`;
      }
      
      if (typeName === 'reponse libre') {
        const reponseLibre = metadata as unknown as { reponse_valide?: string };
        const reponse = reponseLibre.reponse_valide || 'N/A';
        return reponse.length > 60 ? `Réponse: "${reponse.substring(0, 60)}..."` : `Réponse: "${reponse}"`;
      }
      
      if (typeName === 'liens') {
        const liens = metadata as unknown as { mots?: string[] };
        const mots = liens.mots?.slice(0, 3).join(', ') || '';
        return `${liens.mots?.length || 0} mots à relier${mots ? ` (ex: ${mots}...)` : ''}`;
      }
      
      if (typeName === 'chronologie') {
        const chronologie = metadata as unknown as { mots?: string[] };
        const mots = chronologie.mots?.slice(0, 3).join(', ') || '';
        return `${chronologie.mots?.length || 0} éléments à ordonner${mots ? ` (ex: ${mots}...)` : ''}`;
      }
      
      if (typeName === 'memory') {
        const memory = metadata as unknown as { paires?: { question?: string; reponse?: string }[] };
        const paires = memory.paires?.slice(0, 2).map(p => `${p.question}/${p.reponse}`).join(', ') || '';
        return `${memory.paires?.length || 0} paire(s)${paires ? ` (ex: ${paires}...)` : ''}`;
      }
      
      return JSON.stringify(metadata).substring(0, 100);
    } catch (error) {
      return JSON.stringify(metadata).substring(0, 100);
    }
  }

  /**
   * Extrait le texte d'un fichier PDF (version browser avec pdfjs-dist)
   * Note: pdf-parse ne fonctionne que côté serveur, on désactive cette fonctionnalité pour le moment
   */
  async extractTextFromPDF(file: File): Promise<string> {
    try {
      // TODO: Implémenter l'extraction PDF côté client avec pdfjs-dist
      // Pour le moment, on retourne un message indiquant que la fonctionnalité est en développement
      console.warn('Extraction PDF: Fonctionnalité en cours de développement');
      return `[Document PDF fourni: ${file.name}]\nNote: L'extraction automatique du contenu PDF sera disponible prochainement.`;
    } catch (error) {
      console.error('Erreur lors de l\'extraction du PDF:', error);
      throw new Error('Impossible de lire le fichier PDF');
    }
  }
}

