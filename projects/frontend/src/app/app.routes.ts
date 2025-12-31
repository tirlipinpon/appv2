import { Routes } from '@angular/router';
import { childAuthGuard } from './core/auth/child-auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () => import('./shared/components/app-layout/app-layout.component').then(m => m.AppLayoutComponent),
    canActivate: [childAuthGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'subjects',
        loadComponent: () => import('./features/subjects/subjects.component').then(m => m.SubjectsComponent),
      },
      {
        path: 'collection',
        loadComponent: () => import('./features/collection/collection.component').then(m => m.CollectionComponent),
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent),
      },
      {
        path: 'bonus-games',
        loadComponent: () => import('./features/bonus-games/bonus-games.component').then(m => m.BonusGamesComponent),
      },
      {
        path: 'game/:id',
        loadComponent: () => import('./features/game/game.component').then(m => m.GameComponent),
      },
      {
        path: '',
        redirectTo: '/dashboard',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '**',
    redirectTo: '/login',
  },
];
