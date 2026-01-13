import { Routes } from '@angular/router';
import { childAuthGuard } from './core/auth/child-auth.guard';

/**
 * Configuration des routes de l'application frontend (enfants)
 * 
 * Toutes les routes sont lazy-loaded pour optimiser le bundle initial.
 * Les routes protégées utilisent childAuthGuard pour vérifier la session enfant.
 */
export const routes: Routes = [
  // Route publique : Connexion enfant (firstname + PIN)
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent),
  },
  // Routes protégées : Nécessitent une session enfant valide
  {
    path: '',
    loadComponent: () => import('./shared/components/app-layout/app-layout.component').then(m => m.AppLayoutComponent),
    canActivate: [childAuthGuard], // Protection globale : vérifie session enfant (JWT, expiration, activité)
    children: [
      // Dashboard : Vue d'ensemble avec statistiques, collectibles récents, mascotte
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      // Subjects : Liste des matières et sous-catégories avec progression (étoiles, pourcentage)
      {
        path: 'subjects',
        loadComponent: () => import('./features/subjects/subjects.component').then(m => m.SubjectsComponent),
      },
      // Collection : Badges débloqués, collectibles, thèmes personnalisables
      {
        path: 'collection',
        loadComponent: () => import('./features/collection/collection.component').then(m => m.CollectionComponent),
      },
      // Settings : Paramètres de l'enfant (thème, sons, tutoriel)
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent),
      },
      // Bonus Games : Jeux bonus débloqués en complétant des matières
      {
        path: 'bonus-games',
        loadComponent: () => import('./features/bonus-games/bonus-games.component').then(m => m.BonusGamesComponent),
      },
      // Game : Interface de jeu interactive (tous types : QCM, Memory, Puzzle, etc.)
      // Paramètre :id = game_id depuis la base de données
      {
        path: 'game/:id',
        loadComponent: () => import('./features/game/game.component').then(m => m.GameComponent),
      },
      // Redirection par défaut vers subjects
      {
        path: '',
        redirectTo: '/subjects',
        pathMatch: 'full',
      },
    ],
  },
  // Route catch-all : Redirige vers login si route inconnue
  {
    path: '**',
    redirectTo: '/login',
  },
];
