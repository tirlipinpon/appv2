import { Routes } from '@angular/router';
import { authGuard } from './features/login/guards/auth.guard';

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
    path: 'auth/reset',
    loadComponent: () =>
      import('./features/login/components/password-reset/password-reset.component').then(m => m.PasswordResetComponent)
  },
  {
    path: 'signup',
    loadComponent: () => import('./features/login/components/signup-landing/signup-landing.component').then(m => m.SignupLandingComponent)
  },
  {
    path: 'signup/parent',
    loadComponent: () =>
      import('./features/login/components/signup-role/signup-role.component').then(m => m.SignupRoleComponent),
    data: { role: 'parent' }
  },
  {
    path: 'signup/prof',
    loadComponent: () =>
      import('./features/login/components/signup-role/signup-role.component').then(m => m.SignupRoleComponent),
    data: { role: 'prof' }
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
    path: 'parent',
    loadComponent: () => import('./features/parent/parent.component').then(m => m.ParentComponent),
    canActivate: [authGuard]
  },
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];
