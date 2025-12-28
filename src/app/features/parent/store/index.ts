import { inject, Injector } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { withDevtools } from "@angular-architects/ngrx-toolkit";
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of } from 'rxjs';
import { Parent, ParentUpdate } from '../types/parent';
import { Infrastructure } from '../components/infrastructure/infrastructure';
import { ProfileSyncService } from '../../../shared/services/synchronization/profile-sync.service';
import { ChildrenStore } from '../../../shared/store/children.store';
import { AuthService } from '../../../shared/services/auth/auth.service';

export interface ParentStatus {
  isProfileComplete: boolean;
  hasChildrenEnrolled: boolean;
}

export interface ParentState {
  parent: Parent | null;
  isLoading: boolean;
  error: string[];
  status: ParentStatus | null;
  isInitialized: boolean;
}

const initialState: ParentState = {
  parent: null,
  isLoading: false,
  error: [],
  status: null,
  isInitialized: false,
};

export const ParentStore = signalStore(
  { providedIn: 'root' },
  withDevtools('parent'),
  withState(initialState),
  withComputed((store) => ({
    hasParent: () => store.parent() !== null,
    hasError: () => store.error().length > 0,
    isProfileComplete: () => store.status()?.isProfileComplete ?? false,
    hasChildrenEnrolled: () => store.status()?.hasChildrenEnrolled ?? false,
  })),
  withMethods((store, infrastructure = inject(Infrastructure), injector = inject(Injector)) => {
    // Obtenir ChildrenStore de manière lazy pour éviter les dépendances circulaires
    const getChildrenStore = (): any => {
      try {
        return injector.get(ChildrenStore, null);
      } catch {
        return null;
      }
    };
    
    // Obtenir AuthService de manière lazy
    const getAuthService = (): AuthService | null => {
      try {
        return injector.get(AuthService, null);
      } catch {
        return null;
      }
    };
    
    return {
    /**
     * Charge le profil parent
     */
    loadParentProfile: rxMethod<void>(
      pipe(
        switchMap(() => {
          // Si déjà initialisé, retourner immédiatement
          if (store.isInitialized()) {
            return of(null);
          }
          
          patchState(store, { isLoading: true, error: [] });
          return infrastructure.getParentProfile().pipe(
            tap((parent) => {
              patchState(store, { parent, isLoading: false, isInitialized: true });
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du chargement du profil parent';
              patchState(store, { error: [errorMessage], isLoading: false });
              return of(null);
            })
          );
        })
      )
    ),

    /**
     * Met à jour le profil parent
     */
    updateParentProfile: rxMethod<ParentUpdate>(
      pipe(
        tap(() => {
          patchState(store, { isLoading: true, error: [] });
        }),
        switchMap((updates) =>
          infrastructure.updateParentProfile(updates).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors de la mise à jour du profil parent';
                patchState(store, { error: [errorMessage], isLoading: false });
              } else if (result.parent) {
                patchState(store, { parent: result.parent, isLoading: false });
                // Synchroniser avec teacher si l'utilisateur a les deux rôles (lazy injection)
                try {
                  const profileSync = injector.get(ProfileSyncService, null);
                  if (profileSync) {
                    profileSync.syncAfterUpdate('parent', updates);
                  }
                } catch {
                  // Ignorer si ProfileSyncService n'est pas disponible
                }
              } else {
                patchState(store, { isLoading: false });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la mise à jour du profil parent';
              patchState(store, { error: [errorMessage], isLoading: false });
              return of({ parent: null, error });
            })
          )
        )
      )
    ),

    /**
     * Définit le parent (méthode utilitaire pour mise à jour manuelle)
     */
    setParent: (parent: Parent | null) => {
      patchState(store, { parent, isLoading: false });
    },

    /**
     * Définit une erreur (méthode utilitaire pour mise à jour manuelle)
     */
    setError: (error: string) => {
      patchState(store, { error: [error], isLoading: false });
    },

    /**
     * Efface les erreurs
     */
    clearError: () => {
      patchState(store, { error: [] });
    },

    /**
     * Vérifie le statut du profil parent (profil complété et enfants inscrits)
     * Utilise le cache ChildrenStore si disponible pour éviter les appels API répétés
     */
    checkParentStatus: rxMethod<void>(
      pipe(
        switchMap(() => {
          const currentParent = store.parent();
          if (!currentParent) {
            // Pas de parent, retourner un statut par défaut
            patchState(store, { 
              status: { isProfileComplete: false, hasChildrenEnrolled: false },
              isLoading: false 
            });
            return of(null);
          }
          
          // Vérifier si on peut utiliser le cache ChildrenStore
          const childrenStore = getChildrenStore();
          const authService = getAuthService();
          
          if (childrenStore && authService) {
            const user = authService.getCurrentUser();
            if (user && user.id === currentParent.profile_id) {
              // Utiliser le cache ChildrenStore
              const children = childrenStore.children();
              const hasChildrenEnrolled = children.length > 0;
              const isProfileComplete = currentParent.fullname !== null && 
                                       currentParent.fullname.trim() !== '' &&
                                       currentParent.phone !== null && 
                                       currentParent.phone.trim() !== '';
              
              patchState(store, { 
                status: { isProfileComplete, hasChildrenEnrolled },
                isLoading: false 
              });
              return of(null);
            }
          }
          
          // Fallback: utiliser l'infrastructure si le cache n'est pas disponible
          patchState(store, { isLoading: true, error: [] });
          return infrastructure.checkParentStatus().pipe(
            tap((status) => {
              patchState(store, { status, isLoading: false });
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la vérification du statut';
              patchState(store, { error: [errorMessage], isLoading: false });
              return of(null);
            })
          );
        })
      )
    ),

    /**
     * Marque le store comme initialisé
     */
    markAsInitialized: () => {
      patchState(store, { isInitialized: true });
    },

    /**
     * Vérifie si le store est initialisé
     */
    checkIsInitialized: () => {
      return store.isInitialized();
    },

    /**
     * Réinitialise le flag d'initialisation
     */
    resetInitialization: () => {
      patchState(store, { isInitialized: false });
    },

    /**
     * Crée un profil parent
     */
    createParentProfile: rxMethod<Omit<Parent, 'id' | 'profile_id' | 'created_at' | 'updated_at'>>(
      pipe(
        tap(() => {
          patchState(store, { isLoading: true, error: [] });
        }),
        switchMap((profileData) =>
          infrastructure.createParentProfile(profileData).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors de la création du profil parent';
                patchState(store, { error: [errorMessage], isLoading: false });
              } else if (result.parent) {
                patchState(store, { parent: result.parent, isLoading: false, isInitialized: true });
                // Synchroniser avec teacher si l'utilisateur a les deux rôles (lazy injection)
                try {
                  const profileSync = injector.get(ProfileSyncService, null);
                  if (profileSync) {
                    profileSync.syncAfterUpdate('parent', profileData);
                  }
                } catch {
                  // Ignorer si ProfileSyncService n'est pas disponible
                }
              } else {
                patchState(store, { isLoading: false });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la création du profil parent';
              patchState(store, { error: [errorMessage], isLoading: false });
              return of({ parent: null, error });
            })
          )
        )
      )
    ),
    };
  })
);


