import { Routes } from '@angular/router';
import { authGuard } from './guards/auth-guard';
import { roleGuard } from './guards/role-guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./components/login/login').then(m => m.LoginComponent)
  },
  {
    path: 'signup',
    loadComponent: () => import('./components/signup-landing/signup-landing').then(m => m.SignupLandingComponent)
  },
  {
    path: 'signup/parent',
    loadComponent: () => import('./components/signup-parent/signup-parent').then(m => m.SignupParentComponent)
  },
  {
    path: 'signup/prof',
    loadComponent: () => import('./components/signup-prof/signup-prof').then(m => m.SignupProfComponent)
  },
  {
    path: 'select-role',
    loadComponent: () => import('./components/role-selector/role-selector').then(m => m.RoleSelectorComponent),
    canActivate: [authGuard]
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./components/dashboard/dashboard').then(m => m.DashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];
