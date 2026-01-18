import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { withDevtools } from '@angular-architects/ngrx-toolkit';
import { inject } from '@angular/core';
import { pipe, switchMap, catchError, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { BadgesInfrastructure } from '../components/infrastructure/infrastructure';
import {
  Badge,
  ChildBadge,
  BadgeLevel,
  NewlyUnlockedBadge,
  BadgeWithStatus,
} from '../../../core/types/badge.types';

interface BadgesState {
  badges: Badge[];
  childBadges: ChildBadge[];
  badgeLevels: BadgeLevel[];
  newlyUnlocked: NewlyUnlockedBadge[];
  loading: boolean;
  error: string | null;
}

const initialState: BadgesState = {
  badges: [],
  childBadges: [],
  badgeLevels: [],
  newlyUnlocked: [],
  loading: false,
  error: null,
};

export const BadgesStore = signalStore(
  { providedIn: 'root' },
  withDevtools('badges'),
  withState(initialState),
  withComputed((state) => ({
    // Badges avec statut (débloqué/verrouillé)
    badgesWithStatus: (): BadgeWithStatus[] => {
      const badges = state.badges();
      const childBadges = state.childBadges();
      const badgeLevels = state.badgeLevels();

      return badges.map((badge) => {
        // Trouver le badge débloqué le plus récent pour ce type
        const unlockedBadge = childBadges
          .filter((cb) => cb.badge_id === badge.id)
          .sort((a, b) => new Date(b.unlocked_at).getTime() - new Date(a.unlocked_at).getTime())[0];

        // Trouver le niveau actuel pour ce type de badge
        const badgeLevel = badgeLevels.find((bl) => bl.badge_type === badge.badge_type);

        const badgeWithStatus = {
          ...badge,
          isUnlocked: !!unlockedBadge,
          unlockedAt: unlockedBadge?.unlocked_at,
          level: unlockedBadge?.level,
          value: unlockedBadge?.value,
          currentThreshold: badgeLevel ? badgeLevel.current_level : 1,
        } as BadgeWithStatus;

        // #region agent log
        if (badge.badge_type === 'consecutive_correct' || badge.badge_type === 'daily_streak_responses' || badge.badge_type === 'perfect_games_count') {
          fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'badges/store/index.ts:45',message:'badgesWithStatus computed - badge level assignment',data:{badgeType:badge.badge_type,unlockedBadge_level:unlockedBadge?.level,badgeLevel_current_level:badgeLevel?.current_level,currentThreshold:badgeWithStatus.currentThreshold,isUnlocked:badgeWithStatus.isUnlocked},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        }
        // #endregion

        return badgeWithStatus;
      });
    },
    // Nombre de badges débloqués
    unlockedCount: () => state.childBadges().length,
    // Nombre total de badges
    totalCount: () => state.badges().length,
    // Pourcentage de complétion
    completionPercentage: () => {
      const total = state.badges().length;
      if (total === 0) return 0;
      return Math.round((state.childBadges().length / total) * 100);
    },
  })),
  withMethods((store, infrastructure = inject(BadgesInfrastructure)) => ({
    // Charge tous les badges
    loadBadges: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() =>
          infrastructure.loadAllBadges().then(
            (badges) => {
              patchState(store, { badges, loading: false });
            },
            (error) => {
              patchState(store, { error: error.message, loading: false });
            }
          )
        ),
        catchError((error) => {
          patchState(store, { error: error.message, loading: false });
          return of(null);
        })
      )
    ),
    // Charge les badges d'un enfant
    loadChildBadges: rxMethod<string>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap((childId) =>
          Promise.all([
            infrastructure.loadChildBadges(childId),
            infrastructure.loadBadgeLevels(childId),
          ]).then(
            ([childBadges, badgeLevels]) => {
              patchState(store, {
                childBadges,
                badgeLevels,
                loading: false,
              });
            },
            (error) => {
              patchState(store, { error: error.message, loading: false });
            }
          )
        ),
        catchError((error) => {
          patchState(store, { error: error.message, loading: false });
          return of(null);
        })
      )
    ),
    // Vérifie les nouveaux badges débloqués
    checkNewBadges: rxMethod<{ childId: string; gameAttemptId: string }>(
      pipe(
        switchMap(({ childId, gameAttemptId }) =>
          infrastructure.checkNewBadges(childId, gameAttemptId).then(
            (newlyUnlocked) => {
              patchState(store, { newlyUnlocked });
              // Recharger les badges de l'enfant ET les niveaux de badges pour mettre à jour l'état
              return Promise.all([
                infrastructure.loadChildBadges(childId),
                infrastructure.loadBadgeLevels(childId),
              ]).then(([childBadges, badgeLevels]) => {
                patchState(store, { childBadges, badgeLevels });
              });
            },
            (error) => {
              console.error('[BadgesStore] Erreur lors de la vérification des nouveaux badges:', error);
              patchState(store, { error: error.message });
            }
          )
        ),
        catchError((error) => {
          patchState(store, { error: error.message });
          return of(null);
        })
      )
    ),
    // Réinitialise les nouveaux badges débloqués (après affichage de la notification)
    clearNewlyUnlocked: () => {
      patchState(store, { newlyUnlocked: [] });
    },
  }))
);
