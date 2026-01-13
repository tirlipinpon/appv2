import { Routes } from '@angular/router';
import { authGuard } from './features/login/guards/auth.guard';
import { childParentGuard } from './features/child/guards/child-parent.guard';

/**
 * Configuration des routes de l'application admin (parents/profs/admins)
 * 
 * Toutes les routes sont lazy-loaded pour optimiser le bundle initial.
 * Les routes protégées utilisent authGuard pour vérifier l'authentification Supabase.
 * Certaines routes utilisent childParentGuard pour vérifier la relation parent/enfant.
 */
export const routes: Routes = [
  // Redirection par défaut vers dashboard
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },
  // Routes publiques : Authentification et inscription
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent)
  },
  // Confirmation d'email après inscription (lien Supabase)
  {
    path: 'auth/confirm',
    loadComponent: () => import('./features/login/components/auth-confirm/auth-confirm.component').then(m => m.AuthConfirmComponent)
  },
  // Réinitialisation de mot de passe
  {
    path: 'auth/reset',
    loadComponent: () =>
      import('./features/login/components/password-reset/password-reset.component').then(m => m.PasswordResetComponent)
  },
  // Page d'atterrissage pour l'inscription (choix parent/prof)
  {
    path: 'signup',
    loadComponent: () => import('./features/login/components/signup-landing/signup-landing.component').then(m => m.SignupLandingComponent)
  },
  // Inscription parent (data.role = 'parent')
  {
    path: 'signup/parent',
    loadComponent: () =>
      import('./features/login/components/signup-role/signup-role.component').then(m => m.SignupRoleComponent),
    data: { role: 'parent' }
  },
  // Inscription professeur (data.role = 'prof')
  {
    path: 'signup/prof',
    loadComponent: () =>
      import('./features/login/components/signup-role/signup-role.component').then(m => m.SignupRoleComponent),
    data: { role: 'prof' }
  },
  // Routes protégées : Nécessitent une authentification Supabase valide
  // Sélecteur de rôle pour utilisateurs multi-rôles (parent + prof)
  {
    path: 'select-role',
    loadComponent: () => import('./features/login/components/role-selector/role-selector.component').then(m => m.RoleSelectorComponent),
    canActivate: [authGuard] // Vérifie authentification Supabase
  },
  // Dashboard : Vue d'ensemble selon le rôle (parent, prof, admin)
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard] // Protection : authentification requise
  },
  // Profil parent : Gestion du profil et des enfants
  {
    path: 'parent-profile',
    loadComponent: () => import('./features/parent/parent.component').then(m => m.ParentComponent),
    canActivate: [authGuard] // Protection : authentification requise
  },
  // Profil enfant (sans ID) : Profil de l'enfant par défaut
  {
    path: 'child-profile',
    loadComponent: () => import('./features/child/child.component').then(m => m.ChildComponent),
    canActivate: [authGuard] // Protection : authentification requise
  },
  // Profil enfant spécifique (avec ID) : Gestion détaillée d'un enfant
  // Paramètre :id = child_id depuis la base de données
  {
    path: 'child-profile/:id',
    loadComponent: () => import('./features/child/child.component').then(m => m.ChildComponent),
    canActivate: [authGuard] // Protection : authentification requise
  },
  // Profil professeur : Gestion du profil et création de contenu pédagogique
  {
    path: 'teacher-profile',
    loadComponent: () => import('./features/teacher/teacher.component').then(m => m.TeacherComponent),
    canActivate: [authGuard] // Protection : authentification requise
  },
  // Affectations professeur : Gestion des affectations (matière, classe, niveau)
  {
    path: 'teacher-assignments',
    loadComponent: () => import('./features/teacher/components/assignments/assignments.component').then(m => m.AssignmentsComponent),
    canActivate: [authGuard] // Protection : authentification requise
  },
  // Matières professeur : Liste des matières enseignées
  {
    path: 'teacher-subjects',
    loadComponent: () => import('./features/teacher/components/subjects/subjects.component').then(m => m.SubjectsComponent),
    canActivate: [authGuard] // Protection : authentification requise
  },
  // Détail d'une matière (avec ID) : Sous-catégories et jeux
  // Paramètre :id = subject_id depuis la base de données
  {
    path: 'teacher-subjects/:id',
    loadComponent: () => import('./features/teacher/components/subjects/subjects.component').then(m => m.SubjectsComponent),
    canActivate: [authGuard] // Protection : authentification requise
  },
  // Jeux d'une matière (avec ID) : Création et gestion de jeux
  // Paramètre :id = subject_id depuis la base de données
  {
    path: 'teacher-subjects/:id/games',
    loadComponent: () => import('./features/teacher/components/games/games.component').then(m => m.GamesComponent),
    canActivate: [authGuard] // Protection : authentification requise
  },
  // Matières d'un enfant (avec childId) : Gestion des matières activées pour un enfant
  // Paramètre :childId = child_id depuis la base de données
  // Protection double : authentification + vérification parent/enfant
  {
    path: 'child-subjects/:childId',
    loadComponent: () => import('./features/child/components/subjects/child-subjects.component').then(m => m.ChildSubjectsComponent),
    canActivate: [authGuard, childParentGuard] // Protection : authentification + relation parent/enfant
  },
  // Route catch-all : Redirige vers dashboard si route inconnue
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];
