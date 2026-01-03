import { Injectable, inject } from '@angular/core';
import { Observable, from, map, catchError, throwError } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { SupabaseService } from '../../../../shared';
import { GameCreate } from '../../types/game';
import { GameType } from '../../types/game-type';
import type {
  AIGameGenerationRequest,
  AIRawResponse,
  AIRawGameResponse,
} from '../../types/ai-game-generation';
import { getAgeFromSchoolYear } from '../../utils/school-levels.util';
import { isGameType, isGameTypeOneOf, normalizeGameTypeName } from '../../utils/game-type.util';

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
   * Retourne le jeu transformé et la réponse brute de l'IA
   */
  generateSingleGame(
    request: AIGameGenerationRequest,
    gameTypes: GameType[],
    pdfText?: string
  ): Observable<{game: GameCreate, rawResponse: AIRawResponse, userPrompt: string}> {
    // Modifier la requête pour générer 1 seul jeu
    const singleGameRequest = { ...request, numberOfGames: 1 };
    const {messages, currentUserPrompt} = this.buildConversationMessages(singleGameRequest, gameTypes, pdfText);

    return from(this.callDeepSeekProxy(messages)).pipe(
      map((response) => {
        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('Aucune réponse de l\'IA');
        }

        const parsedResponse: AIRawResponse = JSON.parse(content);
        if (!parsedResponse.games || parsedResponse.games.length === 0) {
          throw new Error('Aucun jeu généré par l\'IA');
        }

        // Retourner le premier jeu transformé, la réponse brute et le prompt utilisateur
        const games = this.transformToGameCreate(
          parsedResponse.games,
          request.subjectId,
          gameTypes
        );
        return {
          game: games[0],
          rawResponse: parsedResponse,
          userPrompt: currentUserPrompt
        };
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
    const messages = [
      {
        role: 'system',
        content: 'Tu es un expert en pédagogie française spécialisé dans la création de jeux éducatifs adaptés à chaque niveau scolaire.'
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    return from(this.callDeepSeekProxy(messages)).pipe(
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
  private async callDeepSeekProxy(messages: {role: string, content: string}[]): Promise<{choices: {message: {content: string}}[]}> {
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
        messages,
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
   * Construit le prompt système simplifié avec règles générales et format JSON
   */
  private buildSystemPrompt(): string {
    return `Tu es un expert en pédagogie française spécialisé dans la création de jeux éducatifs adaptés à chaque niveau scolaire.

IMPORTANT - FORMAT DE RÉPONSE: Tu DOIS répondre en JSON uniquement. Retourne un JSON valide conforme à la structure fournie.

RÈGLES GÉNÉRALES:
1. Vocabulaire adapté à l'âge de l'élève
2. INTERDICTION ABSOLUE - IMAGES: Ne JAMAIS mentionner d'images, de photos, de dessins, de schémas ou de visuels dans les instructions ou questions
3. Réponds UNIQUEMENT en JSON valide, aucun texte avant/après
4. Format attendu: JSON object avec la clé "games" contenant un tableau avec UN jeu`;
  }

  /**
   * Construit un prompt spécifique optimisé selon le type de jeu
   */
  private buildTypeSpecificPrompt(
    request: AIGameGenerationRequest,
    gameType: GameType,
    pdfText?: string
  ): string {
    const ageRange = getAgeFromSchoolYear(request.schoolYearLabel);
    const typeName = gameType.name.toLowerCase();

    // Contexte de base
    let prompt = `CONTEXTE:
- Matière: ${request.subjectName}
- Thème: ${request.subject}
- Niveau: ${request.schoolYearLabel} (${ageRange})
- Difficulté: ${request.difficulty}/5
${pdfText ? `- Contenu PDF: ${pdfText.substring(0, 800)}...\n` : ''}

TYPE DE JEU: ${gameType.name}
${gameType.description ? `Description: ${gameType.description}\n` : ''}
`;

    // Instructions spécifiques par type
    // Utiliser les fonctions de comparaison normalisées pour gérer les variations de noms depuis la DB
    const normalizedTypeName = typeName.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    if (normalizedTypeName === 'qcm') {
        prompt += `INSTRUCTIONS SPÉCIFIQUES - QCM:
- Crée une question à choix multiples avec 3 à 5 propositions
- Chaque proposition doit être UNIQUE et DISTINCTE (ne jamais répéter la même réponse)
- Une ou plusieurs propositions peuvent être correctes (indiquées dans reponses_valides)
- Adapte le vocabulaire au niveau ${ageRange}
${request.requestHelp ? `- Ajoute une aide pédagogique dans le champ "aides" expliquant comment utiliser ce QCM` : `- Ajoute une aide progressive dans le champ "aides"`}

FORMAT JSON ATTENDU:
{
  "games": [{
    "type_name": "qcm",
    "question": "Question claire et adaptée au niveau",
    "instructions": "Instructions pour répondre au QCM",
    "metadata": {
      "propositions": ["Proposition A", "Proposition B", "Proposition C", "Proposition D"],
      "reponses_valides": ["Proposition A"]
    },
    "aides": ["Aide pédagogique"]
  }]
}
`;
    } else if (normalizedTypeName === 'case vide') {
        prompt += `INSTRUCTIONS SPÉCIFIQUES - CASE VIDE:
- Crée une phrase COMPLÈTE avec 2 à 4 mots à trouver placés entre crochets [mot]
- Chaque [mot] dans le texte correspond à une case vide à remplir
- Crée une banque de mots avec les mots corrects + 2 à 4 mots leurres (plausibles mais incorrects)
- Les mots doivent être adaptés au niveau ${ageRange}
${request.requestHelp ? `- Ajoute une aide pédagogique dans le champ "aides"` : `- Ajoute une aide progressive dans le champ "aides"`}

FORMAT JSON ATTENDU:
{
  "games": [{
    "type_name": "case vide",
    "question": "Complète les phrases en remplissant les cases vides",
    "instructions": "Lis la phrase et choisis les bons mots dans la banque",
    "metadata": {
      "texte": "Le matin, le petit [chat] boit son bol de [lait].",
      "cases_vides": [
        {"index": 1, "reponse_correcte": "chat"},
        {"index": 2, "reponse_correcte": "lait"}
      ],
      "banque_mots": ["chat", "lait", "chien", "eau", "lapin", "jus"]
    },
    "aides": ["Aide pédagogique"]
  }]
}
`;
    } else if (normalizedTypeName === 'memory') {
        prompt += `INSTRUCTIONS SPÉCIFIQUES - MEMORY:
- Crée EXACTEMENT 4 paires question/réponse (pas plus, pas moins)
- Chaque paire doit être claire et adaptée au niveau ${ageRange}
- Les questions et réponses doivent être liées au thème "${request.subject}"
${request.requestHelp ? `- Ajoute une aide pédagogique dans le champ "aides"` : `- Ajoute une aide progressive dans le champ "aides"`}

FORMAT JSON ATTENDU:
{
  "games": [{
    "type_name": "memory",
    "question": "Associe chaque question à sa réponse",
    "instructions": "Trouve les 4 paires question/réponse correspondantes",
    "metadata": {
      "paires": [
        {"question": "Question 1", "reponse": "Réponse 1"},
        {"question": "Question 2", "reponse": "Réponse 2"},
        {"question": "Question 3", "reponse": "Réponse 3"},
        {"question": "Question 4", "reponse": "Réponse 4"}
      ]
    },
    "aides": ["Aide pédagogique"]
  }]
}
`;
    } else if (normalizedTypeName === 'vrai/faux' || normalizedTypeName === 'vrai-faux') {
        prompt += `INSTRUCTIONS SPÉCIFIQUES - VRAI/FAUX:
- Crée 3 à 6 énoncés clairs et testables (vrai ou faux sans ambiguïté)
- Chaque énoncé doit être adapté au niveau ${ageRange}
- Le champ "reponse_correcte" doit être un boolean (true pour Vrai, false pour Faux)
${request.requestHelp ? `- Ajoute une aide pédagogique dans le champ "aides"` : `- Ajoute une aide progressive dans le champ "aides"`}

FORMAT JSON ATTENDU:
{
  "games": [{
    "type_name": "vrai/faux",
    "question": "Indique si chaque énoncé est vrai ou faux",
    "instructions": "Lis chaque énoncé et indique s'il est vrai ou faux",
    "metadata": {
      "enonces": [
        {"texte": "Énoncé 1", "reponse_correcte": true},
        {"texte": "Énoncé 2", "reponse_correcte": false},
        {"texte": "Énoncé 3", "reponse_correcte": true}
      ]
    },
    "aides": ["Aide pédagogique"]
  }]
}
`;
    } else if (normalizedTypeName === 'chronologie') {
        prompt += `INSTRUCTIONS SPÉCIFIQUES - CHRONOLOGIE:
- Crée 3 à 8 éléments à ordonner dans le temps ou dans un ordre logique
- Les éléments doivent être adaptés au niveau ${ageRange}
- L'ordre correct doit être clairement défini
${request.requestHelp ? `- Ajoute une aide pédagogique dans le champ "aides"` : `- Ajoute une aide progressive dans le champ "aides"`}

FORMAT JSON ATTENDU:
{
  "games": [{
    "type_name": "chronologie",
    "question": "Classe les éléments dans le bon ordre",
    "instructions": "Réorganise les éléments dans l'ordre chronologique/logique correct",
    "metadata": {
      "mots": ["Élément 1", "Élément 2", "Élément 3", "Élément 4"],
      "ordre_correct": ["Élément 1", "Élément 2", "Élément 3", "Élément 4"]
    },
    "aides": ["Aide pédagogique"]
  }]
}
`;
    } else if (normalizedTypeName === 'liens') {
        prompt += `INSTRUCTIONS SPÉCIFIQUES - LIENS:
- Crée 3 à 6 paires de mots/concepts à associer
- Les associations doivent être logiques et adaptées au niveau ${ageRange}
- Chaque mot doit avoir une réponse correspondante unique
${request.requestHelp ? `- Ajoute une aide pédagogique dans le champ "aides"` : `- Ajoute une aide progressive dans le champ "aides"`}

FORMAT JSON ATTENDU:
{
  "games": [{
    "type_name": "liens",
    "question": "Associe chaque mot à sa réponse correspondante",
    "instructions": "Relie chaque mot de la colonne de gauche à sa réponse dans la colonne de droite",
    "metadata": {
      "mots": ["Mot 1", "Mot 2", "Mot 3"],
      "reponses": ["Réponse 1", "Réponse 2", "Réponse 3"],
      "liens": [
        {"mot": "Mot 1", "reponse": "Réponse 1"},
        {"mot": "Mot 2", "reponse": "Réponse 2"},
        {"mot": "Mot 3", "reponse": "Réponse 3"}
      ]
    },
    "aides": ["Aide pédagogique"]
  }]
}
`;
    } else if (normalizedTypeName === 'reponse libre') {
        prompt += `INSTRUCTIONS SPÉCIFIQUES - RÉPONSE LIBRE:
- Crée une question ouverte nécessitant une réponse textuelle
- La réponse attendue doit être claire et adaptée au niveau ${ageRange}
- Accepte différentes formulations de la même réponse correcte
${request.requestHelp ? `- Ajoute une aide pédagogique dans le champ "aides"` : `- Ajoute une aide progressive dans le champ "aides"`}

FORMAT JSON ATTENDU:
{
  "games": [{
    "type_name": "reponse libre",
    "question": "Question ouverte nécessitant une réponse écrite",
    "instructions": "Réponds à la question en utilisant tes propres mots",
    "metadata": {
      "reponse_valide": "Réponse attendue (acceptera les variantes)"
    },
    "aides": ["Aide pédagogique"]
  }]
}
`;
    } else {
        prompt += `INSTRUCTIONS:
- Crée un jeu adapté au niveau ${ageRange}
- Respecte la structure metadata pour le type "${gameType.name}"
${request.requestHelp ? `- Ajoute une aide pédagogique dans le champ "aides"` : `- Ajoute une aide progressive dans le champ "aides"`}
`;
    }

    prompt += `\nRéponds en JSON valide selon le format indiqué ci-dessus.`;

    return prompt;
  }

  /**
   * Construit les messages conversationnels avec prompt spécifique par type de jeu
   * Retourne les messages et le prompt utilisateur actuel
   */
  private buildConversationMessages(
    request: AIGameGenerationRequest,
    gameTypes: GameType[],
    pdfText?: string
  ): {messages: {role: string, content: string}[], currentUserPrompt: string} {
    const messages: {role: string, content: string}[] = [];
    
    // Message system toujours présent
    messages.push({
      role: 'system',
      content: this.buildSystemPrompt()
    });
    
    // Déterminer le type de jeu à utiliser
    const typesToUse = request.remainingGameTypeIds ?? request.selectedGameTypeIds;
    let selectedGameType: GameType | undefined;
    
    if (typesToUse && typesToUse.length > 0) {
      selectedGameType = gameTypes.find(gt => typesToUse.includes(gt.id));
    }
    
    // Si aucun type sélectionné, prendre le premier disponible
    if (!selectedGameType) {
      selectedGameType = gameTypes[0];
    }
    
    // Construire le prompt spécifique au type de jeu
    const currentPrompt = this.buildTypeSpecificPrompt(request, selectedGameType, pdfText);
    messages.push({
      role: 'user',
      content: currentPrompt
    });
    
    return {messages, currentUserPrompt: currentPrompt};
  }

  /**
   * @deprecated Cette méthode n'est plus utilisée - remplacée par buildTypeSpecificPrompt
   * Conservée pour compatibilité avec generateGames() si nécessaire
   */
  private buildPrompt(
    request: AIGameGenerationRequest,
    gameTypes: GameType[],
    pdfText?: string
  ): string {
    // Déterminer le type de jeu à utiliser
    const typesToUse = request.remainingGameTypeIds ?? request.selectedGameTypeIds;
    let selectedGameType: GameType | undefined;
    
    if (typesToUse && typesToUse.length > 0) {
      selectedGameType = gameTypes.find(gt => typesToUse.includes(gt.id));
    }
    
    // Si aucun type sélectionné, prendre le premier disponible
    if (!selectedGameType) {
      selectedGameType = gameTypes[0];
    }
    
    return this.buildTypeSpecificPrompt(request, selectedGameType, pdfText);
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
      if (isGameType(rawGame.type_name, 'qcm') && rawGame.metadata) {
        normalizedMetadata = this.normalizeQcmMetadata(rawGame.metadata);
      } else if (isGameTypeOneOf(rawGame.type_name, 'vrai/faux', 'vrai-faux') && rawGame.metadata) {
        normalizedMetadata = this.normalizeVraiFauxMetadata(rawGame.metadata);
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
   * Normalise les métadonnées Vrai/Faux pour corriger les problèmes courants
   */
  private normalizeVraiFauxMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    interface VraiFauxMetadata {
      enonces?: ({
        texte?: string;
        text?: string;
        reponse_correcte?: boolean | string;
      } | string)[];
    }
    
    const vraiFaux = metadata as unknown as VraiFauxMetadata;
    
    if (!vraiFaux.enonces || !Array.isArray(vraiFaux.enonces)) {
      // Si pas d'énoncés, retourner les métadonnées telles quelles
      return metadata;
    }

    // Normaliser chaque énoncé
    const normalizedEnonces = vraiFaux.enonces.map((enonce) => {
      if (typeof enonce === 'string') {
        // Si c'est juste une string, créer un énoncé avec réponse par défaut
        return { texte: enonce, reponse_correcte: true };
      } else if (enonce && typeof enonce === 'object') {
        // S'assurer que reponse_correcte est un boolean
        let reponseCorrecte: boolean;
        if (typeof enonce.reponse_correcte === 'boolean') {
          reponseCorrecte = enonce.reponse_correcte;
        } else if (typeof enonce.reponse_correcte === 'string') {
          reponseCorrecte = enonce.reponse_correcte.toLowerCase() === 'vrai' || enonce.reponse_correcte === 'true';
        } else {
          reponseCorrecte = true; // Par défaut
        }
        
        return {
          texte: enonce.texte || enonce.text || String(enonce),
          reponse_correcte: reponseCorrecte
        };
      }
      return null;
    }).filter((e): e is {texte: string, reponse_correcte: boolean} => e !== null && e.texte !== undefined && e.texte.trim() !== '');

    return {
      ...metadata,
      enonces: normalizedEnonces
    };
  }

  /**
   * Retourne la description de la structure metadata pour un type de jeu
   */
  private getMetadataStructureDescription(typeName: string): string {
    const normalized = normalizeGameTypeName(typeName);
    
    // Utiliser les noms normalisés pour la comparaison
    if (normalized === 'case vide') {
      return '{ texte: string (phrase avec [mot] pour chaque case vide), cases_vides: [{index: number, reponse_correcte: string}], banque_mots: string[] }';
    }
    if (normalized === 'reponse libre') {
      return '{ reponse_valide: string }';
    }
    if (normalized === 'liens') {
      return '{ mots: string[], reponses: string[], liens: {mot: string, reponse: string}[] }';
    }
    if (normalized === 'chronologie') {
      return '{ mots: string[], ordre_correct: string[] }';
    }
    if (normalized === 'qcm') {
      return '{ propositions: string[], reponses_valides: string[] }';
    }
    if (normalized === 'vrai/faux' || normalized === 'vrai-faux') {
      return '{ enonces: [{texte: string, reponse_correcte: boolean}[] }';
    }
    if (normalized === 'memory') {
      return '{ paires: {question: string, reponse: string}[] }';
    }

    return '{ structure spécifique au type }';
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

