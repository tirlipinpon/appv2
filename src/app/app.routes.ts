import { Routes } from '@angular/router';
import { authGuard } from './features/login/guards/auth.guard';
import { roleGuard } from './features/login/guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'auth/confirm',
    loadComponent: () => import('./features/login/components/auth-confirm/auth-confirm.component').then(m => m.AuthConfirmComponent)
  },
  {
    path: 'signup',
    loadComponent: () => import('./features/login/components/signup-landing/signup-landing.component').then(m => m.SignupLandingComponent)
  },
  {
    path: 'signup/parent',
    loadComponent: () => import('./features/login/components/signup-parent/signup-parent.component').then(m => m.SignupParentComponent)
  },
  {
    path: 'signup/prof',
    loadComponent: () => import('./features/login/components/signup-prof/signup-prof.component').then(m => m.SignupProfComponent)
  },
  {
    path: 'select-role',
    loadComponent: () => import('./features/login/components/role-selector/role-selector.component').then(m => m.RoleSelectorComponent),
    canActivate: [authGuard]
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];
