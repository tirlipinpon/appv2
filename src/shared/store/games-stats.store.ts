import { inject, untracked } from '@angular/core';
import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of, forkJoin, Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';

export interface GameStats {
  stats: Record<string, number>;
  total: number;
  timestamp: number;
}

export interface GamesStatsState {
  // Cache avec clé composite: `${childId}:subject:${subjectId}` ou `${childId}:category:${categoryId}`
  // Pour admin (sans enfant): `subject:${subjectId}` ou `category:${categoryId}`
  statsByKey: Record<string, GameStats>;
  // Clés en cours de chargement pour éviter les appels multiples
  loadingKeys: Set<string>;
}

const initialState: GamesStatsState = {
  statsByKey: {},
  loadingKeys: new Set(),
};

// TTL par défaut : 5 minutes
const DEFAULT_TTL = 5 * 60 * 1000;

/**
 * Store partagé pour gérer les statistiques de jeux avec cache intelligent
 * Utilisable par frontend et admin
 */
export const GamesStatsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => {
    // Map pour stocker les Observables en cours de chargement (déduplication)
    const loadingObservables = new Map<string, Observable<unknown>>();

    // Fonctions helper pour générer les clés
    const getSubjectKey = (childId: string | null | undefined, subjectId: string): string => {
      if (childId) {
        return `${childId}:subject:${subjectId}`;
      }
      return `subject:${subjectId}`;
    };

    const getCategoryKey = (childId: string | null | undefined, categoryId: string): string => {
      if (childId) {
        return `${childId}:category:${categoryId}`;
      }
      return `category:${categoryId}`;
    };

    let getStatsCallCount = 0;
    const getStats = (key: string): GameStats | null => {
      getStatsCallCount++;
      // Limiter les logs pour éviter la surcharge
      if (getStatsCallCount <= 100 || getStatsCallCount % 1000 === 0) {
        try {
          fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'games-stats.store.ts:55',message:'GETSTATS_CALL',data:{key,callCount:getStatsCallCount},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        } catch {}
      }
      
      // Utiliser untracked() pour lire le signal sans créer de dépendance réactive
      // Cela évite les boucles infinies quand getStats est appelé depuis un template
      const stats = untracked(() => store.statsByKey())[key];
      if (!stats) return null;
      
      // Vérifier si le cache n'a pas expiré
      // NE PAS modifier l'état ici pour éviter les boucles infinies
      // Le cache expiré sera simplement ignoré jusqu'à ce qu'il soit rechargé
      const now = Date.now();
      if (now - stats.timestamp >= DEFAULT_TTL) {
        // Cache expiré, retourner null sans modifier l'état
        // La modification de l'état se fera uniquement lors du prochain chargement
        return null;
      }
      
      return stats;
    };

    return {
      /**
       * Génère une clé de cache pour une matière
       */
      getSubjectKey,

      /**
       * Génère une clé de cache pour une catégorie
       */
      getCategoryKey,

      /**
       * Récupère les stats depuis le cache
       */
      getStats,

      /**
       * Charge les stats pour une matière (avec déduplication)
       */
      loadStatsForSubject: rxMethod<{
        subjectId: string;
        childId?: string | null;
        loader: () => Observable<{ stats: Record<string, number>; total: number; error: unknown | null }>;
      }>(
        pipe(
          switchMap(({ subjectId, childId, loader }) => {
            const key = getSubjectKey(childId, subjectId);
            
            // Si déjà en cache et valide, retourner immédiatement
            // Utiliser untracked() pour éviter les dépendances réactives
            const cached = untracked(() => getStats(key));
            if (cached) {
              return of(null);
            }

            // Si déjà en cours de chargement, partager l'Observable
            const existingLoading = loadingObservables.get(key);
            if (existingLoading) {
              return existingLoading;
            }

            // Marquer comme en chargement
            const currentLoading = new Set(store.loadingKeys());
            currentLoading.add(key);
            patchState(store, { loadingKeys: currentLoading });

            // Créer l'Observable avec shareReplay pour le partager
            const loading$ = loader().pipe(
              tap((result: { stats: Record<string, number>; total: number; error: unknown | null }) => {
                // Retirer de la liste des chargements
                const updatedLoading = new Set(store.loadingKeys());
                updatedLoading.delete(key);
                patchState(store, { loadingKeys: updatedLoading });
                loadingObservables.delete(key);

                if (!result.error && result.stats) {
                  // Mettre en cache
                  const currentStats = { ...store.statsByKey() };
                  currentStats[key] = {
                    stats: result.stats,
                    total: result.total,
                    timestamp: Date.now(),
                  };
                  try {
                    fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'games-stats.store.ts:220',message:'PATCHSTATE_CATEGORY',data:{key},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                  } catch {}
                  patchState(store, { statsByKey: currentStats });
                }
              }),
              catchError((error) => {
                // Retirer de la liste des chargements en cas d'erreur
                const updatedLoading = new Set(store.loadingKeys());
                updatedLoading.delete(key);
                patchState(store, { loadingKeys: updatedLoading });
                loadingObservables.delete(key);
                return of(null);
              }),
              shareReplay(1)
            );

            loadingObservables.set(key, loading$);
            return loading$;
          })
        )
      ),

      /**
       * Charge les stats pour une catégorie (avec déduplication)
       */
      loadStatsForCategory: rxMethod<{
        categoryId: string;
        childId?: string | null;
        loader: () => Observable<{ stats: Record<string, number>; total: number; error: unknown | null }>;
      }>(
        pipe(
          switchMap(({ categoryId, childId, loader }) => {
            const key = getCategoryKey(childId, categoryId);
            
            // Si déjà en cache et valide, retourner immédiatement
            // Utiliser untracked() pour éviter les dépendances réactives
            const cached = untracked(() => getStats(key));
            if (cached) {
              return of(null);
            }

            // Si déjà en cours de chargement, partager l'Observable
            const existingLoading = loadingObservables.get(key);
            if (existingLoading) {
              return existingLoading;
            }

            // Marquer comme en chargement
            const currentLoading = new Set(store.loadingKeys());
            currentLoading.add(key);
            patchState(store, { loadingKeys: currentLoading });

            // Créer l'Observable avec shareReplay pour le partager
            const loading$ = loader().pipe(
              tap((result: { stats: Record<string, number>; total: number; error: unknown | null }) => {
                // Retirer de la liste des chargements
                const updatedLoading = new Set(store.loadingKeys());
                updatedLoading.delete(key);
                patchState(store, { loadingKeys: updatedLoading });
                loadingObservables.delete(key);

                if (!result.error && result.stats) {
                  // Mettre en cache
                  const currentStats = { ...store.statsByKey() };
                  currentStats[key] = {
                    stats: result.stats,
                    total: result.total,
                    timestamp: Date.now(),
                  };
                  try {
                    fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'games-stats.store.ts:220',message:'PATCHSTATE_CATEGORY',data:{key},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                  } catch {}
                  patchState(store, { statsByKey: currentStats });
                }
              }),
              catchError((error) => {
                // Retirer de la liste des chargements en cas d'erreur
                const updatedLoading = new Set(store.loadingKeys());
                updatedLoading.delete(key);
                patchState(store, { loadingKeys: updatedLoading });
                loadingObservables.delete(key);
                return of(null);
              }),
              shareReplay(1)
            );

            loadingObservables.set(key, loading$);
            return loading$;
          })
        )
      ),

      /**
       * Charge les stats en batch pour plusieurs matières/catégories
       */
      loadStatsBatch: rxMethod<{
        requests: Array<{
          type: 'subject' | 'category';
          id: string;
          childId?: string | null;
          loader: () => Observable<{ stats: Record<string, number>; total: number; error: unknown | null }>;
        }>;
      }>(
        pipe(
          // Déduplication : créer une clé unique pour cette requête batch
          // pour éviter les appels multiples avec les mêmes paramètres
          switchMap(({ requests }) => {
            // Créer une clé unique pour cette requête batch basée sur les IDs
            const requestKeys = requests.map(req => {
              const key = req.type === 'subject'
                ? getSubjectKey(req.childId, req.id)
                : getCategoryKey(req.childId, req.id);
              return key;
            }).sort().join(',');
            
            // Vérifier si cette requête batch est déjà en cours de chargement
            const batchKey = `batch:${requestKeys}`;
            const existingBatch = loadingObservables.get(batchKey);
            if (existingBatch) {
              // Déjà en cours de chargement, retourner l'Observable existant
              return existingBatch;
            }
            
            // Log pour debug
            try {
              fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'games-stats.store.ts:240',message:'LOADSTATSBATCH_ENTRY',data:{requestsCount:requests.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'K'})}).catch(()=>{});
            } catch {}
            
            // Filtrer les requêtes qui ne sont pas déjà en cache
            // Lire statsByKey une seule fois avec untracked() pour éviter les dépendances réactives
            const statsByKeySnapshot = untracked(() => store.statsByKey());
            const now = Date.now();
            const requestsToLoad = requests.filter((req) => {
              const key = req.type === 'subject'
                ? getSubjectKey(req.childId, req.id)
                : getCategoryKey(req.childId, req.id);
              // Vérifier directement depuis le snapshot au lieu d'appeler getStats
              const cached = statsByKeySnapshot[key];
              if (!cached) return true;
              // Vérifier si le cache n'a pas expiré
              if (now - cached.timestamp >= DEFAULT_TTL) return true;
              return false;
            });

            if (requestsToLoad.length === 0) {
              return of(null);
            }

            // Charger toutes les requêtes en parallèle
            const loaders$ = requestsToLoad.map((req) => {
              const key = req.type === 'subject'
                ? getSubjectKey(req.childId, req.id)
                : getCategoryKey(req.childId, req.id);
              
              // Marquer comme en chargement
              const currentLoading = new Set(store.loadingKeys());
              currentLoading.add(key);
              patchState(store, { loadingKeys: currentLoading });

              return req.loader().pipe(
                tap((result: { stats: Record<string, number>; total: number; error: unknown | null }) => {
                  // Retirer de la liste des chargements
                  const updatedLoading = new Set(store.loadingKeys());
                  updatedLoading.delete(key);
                  patchState(store, { loadingKeys: updatedLoading });

                  if (!result.error && result.stats) {
                    // Mettre en cache
                    const currentStats = { ...store.statsByKey() };
                    currentStats[key] = {
                      stats: result.stats,
                      total: result.total,
                      timestamp: Date.now(),
                    };
                    patchState(store, { statsByKey: currentStats });
                  }
                }),
                catchError((error) => {
                  // Retirer de la liste des chargements en cas d'erreur
                  const updatedLoading = new Set(store.loadingKeys());
                  updatedLoading.delete(key);
                  patchState(store, { loadingKeys: updatedLoading });
                  return of({ stats: {}, total: 0, error });
                })
              );
            });

            // Créer l'Observable batch avec shareReplay pour le partager
            const batch$ = forkJoin(loaders$).pipe(
              tap(() => {
                // Retirer le batch de la liste des chargements
                loadingObservables.delete(batchKey);
              }),
              catchError((error) => {
                // Retirer le batch de la liste des chargements en cas d'erreur
                loadingObservables.delete(batchKey);
                return of(null);
              }),
              shareReplay(1)
            );

            // Stocker l'Observable batch pour la déduplication
            loadingObservables.set(batchKey, batch$);
            return batch$;
          })
        )
      ),

      /**
       * Invalide le cache pour une clé spécifique
       */
      invalidateCache: (key: string) => {
        const currentStats = { ...store.statsByKey() };
        delete currentStats[key];
        patchState(store, { statsByKey: currentStats });
      },

      /**
       * Invalide le cache pour un enfant (frontend)
       */
      invalidateCacheForChild: (childId: string) => {
        const currentStats = { ...store.statsByKey() };
        Object.keys(currentStats).forEach((key) => {
          if (key.startsWith(`${childId}:`)) {
            delete currentStats[key];
          }
        });
        patchState(store, { statsByKey: currentStats });
      },

      /**
       * Invalide le cache pour une matière
       */
      invalidateCacheForSubject: (subjectId: string, childId?: string | null) => {
        const key = getSubjectKey(childId, subjectId);
        const currentStats = { ...store.statsByKey() };
        delete currentStats[key];
        patchState(store, { statsByKey: currentStats });
      },

      /**
       * Invalide le cache pour une catégorie
       */
      invalidateCacheForCategory: (categoryId: string, childId?: string | null) => {
        const key = getCategoryKey(childId, categoryId);
        const currentStats = { ...store.statsByKey() };
        delete currentStats[key];
        patchState(store, { statsByKey: currentStats });
      },

      /**
       * Vide tout le cache
       */
      clearCache: () => {
        patchState(store, { statsByKey: {}, loadingKeys: new Set() });
        loadingObservables.clear();
      },
    };
  })
);
