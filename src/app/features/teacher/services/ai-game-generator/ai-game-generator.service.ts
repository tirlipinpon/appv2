import { Injectable, inject } from '@angular/core';
import { Observable, from, map, catchError, throwError } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { SupabaseService } from '../../../../shared/services/supabase/supabase.service';
import { GameCreate } from '../../types/game';
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
    pdfText?: string
  ): Observable<GameCreate> {
    // Modifier la requête pour générer 1 seul jeu
    const singleGameRequest = { ...request, numberOfGames: 1 };
    const prompt = this.buildPrompt(singleGameRequest, gameTypes, pdfText);

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
    pdfText?: string
  ): string {
    const ageRange = getAgeFromSchoolYear(request.schoolYearLabel);

    // Construire la liste des types de jeux disponibles avec leur structure
    const gameTypesDescription = gameTypes
      .map((gt) => {
        return `
**${gt.name}**:
${gt.description || 'Pas de description'}
Structure metadata: ${this.getMetadataStructureDescription(gt.name)}
`;
      })
      .join('\n');

    return `Tu es un générateur de jeux pédagogiques adapté au système éducatif français.

CONTEXTE:
- Matière scolaire: ${request.subjectName}
- Thème/Sujet: ${request.subject}
- Niveau scolaire: ${request.schoolYearLabel}
- Âge approximatif des élèves: ${ageRange}
- Difficulté demandée: ${request.difficulty}/5
${pdfText ? `- Contexte additionnel (extrait PDF):\n${pdfText.substring(0, 3000)}` : ''}

TYPES DE JEUX DISPONIBLES:
${gameTypesDescription}

CONSIGNES STRICTES:
1. Génère EXACTEMENT ${request.numberOfGames} jeux variés adaptés au niveau ${request.schoolYearLabel}
2. Ajuste le vocabulaire et la complexité selon l'âge (${ageRange})
3. Répartis intelligemment les types de jeux selon le sujet et le niveau
4. Chaque jeu DOIT avoir entre 1 et 3 aides progressives (adaptées à l'âge)
5. Respecte STRICTEMENT la structure JSON et metadata de chaque type
6. Pour les QCM: 3-5 propositions selon le niveau
7. Pour les liens: nombre égal de mots et réponses (3-6 paires selon le niveau)
8. Pour la chronologie: 3-8 éléments selon le niveau
9. Utilise un français adapté à l'âge (vocabulaire simple pour primaire, plus complexe pour lycée)

FORMAT DE RÉPONSE (JSON STRICT - OBLIGATOIRE):
{
  "games": [
    {
      "type_name": "qcm",
      "question": "Question du jeu",
      "instructions": "Sélectionne la ou les bonnes réponses",
      "metadata": {
        "propositions": ["Réponse A", "Réponse B", "Réponse C"],
        "reponses_valides": ["Réponse A"]
      },
      "aides": ["Première aide", "Deuxième aide"]
    },
    {
      "type_name": "case vide",
      "question": "Question pour le jeu à trous",
      "instructions": "Complète la phrase avec le mot manquant",
      "metadata": {
        "debut_phrase": "Le chat est ",
        "fin_phrase": " dans le jardin",
        "reponse_valide": "caché"
      },
      "aides": ["Indice 1", "Indice 2"]
    },
    {
      "type_name": "liens",
      "question": "Question pour relier les éléments",
      "instructions": "Relie chaque mot à sa bonne réponse",
      "metadata": {
        "mots": ["Mot 1", "Mot 2", "Mot 3"],
        "reponses": ["Réponse 1", "Réponse 2", "Réponse 3"],
        "liens": [
          {"mot": "Mot 1", "reponse": "Réponse 1"},
          {"mot": "Mot 2", "reponse": "Réponse 2"},
          {"mot": "Mot 3", "reponse": "Réponse 3"}
        ]
      },
      "aides": ["Aide 1", "Aide 2"]
    },
    {
      "type_name": "chronologie",
      "question": "Question pour ordonner",
      "instructions": "Remets les éléments dans le bon ordre chronologique",
      "metadata": {
        "mots": ["Événement 1", "Événement 2", "Événement 3"],
        "ordre_correct": ["Événement 1", "Événement 2", "Événement 3"]
      },
      "aides": ["Indice ordre", "Indice dates"]
    },
    {
      "type_name": "reponse libre",
      "question": "Question ouverte",
      "instructions": "Réponds à la question",
      "metadata": {
        "reponse_valide": "La réponse attendue"
      },
      "aides": ["Piste 1", "Piste 2"]
    }
  ]
}

IMPORTANT: 
- Retourne UNIQUEMENT du JSON valide, aucun texte avant ou après
- TOUS les jeux DOIVENT avoir: type_name, question, instructions, metadata, aides
- Le champ "metadata" doit correspondre EXACTEMENT à la structure du type de jeu
- Pour "liens": les tableaux mots/reponses doivent avoir la MÊME taille et liens doit relier chaque mot à SA réponse
- Pour "chronologie": ordre_correct contient les mots dans le bon ordre (même contenu que mots mais réordonné)
- Les aides doivent être progressives (de plus en plus explicites)`;
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

      return {
        subject_id: subjectId,
        game_type_id: gameTypeId,
        name: autoName,
        instructions: rawGame.instructions || null,
        question: rawGame.question || null,
        reponses: null, // On utilise metadata pour les données spécifiques
        aides: rawGame.aides && rawGame.aides.length > 0 ? rawGame.aides : null,
        metadata: rawGame.metadata,
      };
    });
  }

  /**
   * Retourne la description de la structure metadata pour un type de jeu
   */
  private getMetadataStructureDescription(typeName: string): string {
    const structures: Record<string, string> = {
      'case vide':
        '{ debut_phrase: string, fin_phrase: string, reponse_valide: string }',
      'reponse libre': '{ reponse_valide: string }',
      liens: '{ mots: string[], reponses: string[], liens: {mot: string, reponse: string}[] }',
      chronologie: '{ mots: string[], ordre_correct: string[] }',
      qcm: '{ propositions: string[], reponses_valides: string[] }',
    };

    return (
      structures[typeName.toLowerCase()] ||
      '{ structure spécifique au type }'
    );
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

