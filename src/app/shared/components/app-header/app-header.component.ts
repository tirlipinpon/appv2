import { Component, inject, OnInit, OnDestroy, computed, signal, effect, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { getAuthService } from '../../services/auth/auth-service.factory';
import type { Profile } from '../../services/auth/auth.service';
import { ParentStore } from '../../../features/parent/store/index';
import { TeacherStore } from '../../../features/teacher/store/index';
import { filter, Subscription } from 'rxjs';
import type { User } from '@supabase/supabase-js';
import { APP_VERSION } from '../../../core/version';

export interface HeaderNavItem {
  label: string;
  route: string | string[];
  queryParams?: Record<string, unknown>;
  icon?: string;
  visible?: () => boolean;
  exact?: boolean;
}

export interface HeaderConfig {
  brandTitle: string;
  brandRoute?: string | string[];
  navItems?: HeaderNavItem[];
  showUserInfo?: boolean;
  showRoleBadge?: boolean;
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.scss'
})
export class AppHeaderComponent implements OnInit, OnDestroy {
  private readonly authService = getAuthService();
  private readonly router = inject(Router);
  private readonly parentStore = inject(ParentStore);
  private readonly teacherStore = inject(TeacherStore);
  
  // Inputs pour la configuration générique
  @Input() config?: HeaderConfig;
  @Input() navItems?: HeaderNavItem[];
  @Input() brandTitle?: string;
  @Input() brandRoute?: string | string[];
  @Input() showUserInfo = true;
  @Input() showRoleBadge = true;
  
  profile = signal<Profile | null>(null);
  currentUser = signal<User | null>(null);
  activeRole = signal<string | null>(null);
  currentRoute = signal<string>('');
  isMenuOpen = signal(false);
  
  // Utiliser les stores directement pour les profils
  readonly parentProfile = computed(() => this.parentStore.parent());
  readonly teacherProfile = computed(() => this.teacherStore.teacher());
  
  private profileSubscription?: Subscription;
  private userSubscription?: Subscription;
  private routerSubscription?: Subscription;
  
  // Computed pour les éléments de navigation visibles
  readonly visibleNavItems = computed(() => {
    const items = this.navItems || this.getDefaultNavItems();
    return items.filter(item => {
      if (item.visible) {
        return item.visible();
      }
      return true;
    });
  });
  
  // Computed pour le titre de la marque
  readonly displayBrandTitle = computed(() => {
    return this.brandTitle || this.config?.brandTitle || '📚 App Éducative';
  });
  
  // Computed pour la version de l'application
  readonly appVersion = computed(() => {
    return APP_VERSION;
  });
  
  // Computed pour la route de la marque
  readonly displayBrandRoute = computed(() => {
    return this.brandRoute || this.config?.brandRoute || '/dashboard';
  });
  
  readonly isAuthenticated = computed(() => {
    // Vérifier à la fois l'utilisateur ET le profil pour s'assurer que l'utilisateur est vraiment connecté
    return this.currentUser() !== null && this.profile() !== null;
  });
  readonly hasMultipleRoles = computed(() => {
    const p = this.profile();
    return p ? p.roles.length > 1 : false;
  });
  readonly activeRoleLabel = computed(() => {
    const role = this.activeRole();
    if (!role) return null;
    
    const roleLabels: Record<string, string> = {
      'parent': 'Parent',
      'prof': 'Professeur',
      'admin': 'Administrateur'
    };
    
    return roleLabels[role] || role.charAt(0).toUpperCase() + role.slice(1);
  });
  readonly displayName = computed(() => {
    const role = this.activeRole();
    const p = this.profile();
    
    // Si aucun rôle actif défini mais que l'utilisateur a des rôles, utiliser le premier rôle disponible
    const effectiveRole = role || (p?.roles && p.roles.length > 0 ? p.roles[0] : null);
    
    // Si le rôle est parent, utiliser le nom complet du parent
    if (effectiveRole === 'parent') {
      const parent = this.parentProfile();
      return parent?.fullname || p?.display_name || p?.id || 'Utilisateur';
    }
    
    // Si le rôle est prof, utiliser le nom complet du professeur
    if (effectiveRole === 'prof') {
      const teacher = this.teacherProfile();
      return teacher?.fullname || p?.display_name || p?.id || 'Utilisateur';
    }
    
    // Par défaut, utiliser display_name ou id
    return p?.display_name || p?.id || 'Utilisateur';
  });

  // Effect pour synchroniser le rôle actif depuis AuthService
  private readonly activeRoleSyncEffect = effect(() => {
    // Lire le rôle actif depuis AuthService (cela crée une dépendance réactive)
    const authServiceRole = this.authService.getActiveRole();
    const currentRole = this.activeRole();
    
    console.log('[Header] Synchronisation rôle actif:', { 
      authServiceRole, 
      currentRole,
      areEqual: authServiceRole === currentRole 
    });
    
    // Mettre à jour le signal local seulement si différent
    if (authServiceRole !== currentRole) {
      console.log('[Header] Mise à jour du rôle actif:', authServiceRole);
      this.activeRole.set(authServiceRole);
    }
  }, { allowSignalWrites: true });

  // Effect pour charger les profils selon le rôle actif
  private readonly roleWatcher = effect(() => {
    const isAuth = this.isAuthenticated();
    const role = this.activeRole();
    const p = this.profile();
    
    // Si aucun rôle actif défini mais que l'utilisateur a des rôles, utiliser le premier rôle disponible
    const effectiveRole = role || (p?.roles && p.roles.length > 0 ? p.roles[0] : null);
    
    console.log('[Header] Effect déclenché:', { isAuth, role, effectiveRole, roles: p?.roles });
    
    if (!isAuth) {
      console.log('[Header] Utilisateur non authentifié');
      return;
    }

    if (effectiveRole === 'parent') {
      console.log('[Header] Rôle parent détecté, chargement du profil parent');
      // Charger le profil parent via le store (utilise le cache si déjà initialisé)
      if (!this.parentStore.checkIsInitialized()) {
        this.parentStore.loadParentProfile();
      }
    } else if (effectiveRole === 'prof') {
      console.log('[Header] Rôle prof détecté, chargement du profil professeur');
      // Charger le profil professeur via le store (utilise le cache si déjà initialisé)
      if (!this.teacherStore.checkIsInitialized()) {
        this.teacherStore.loadTeacherProfile();
      }
    }
  }, { allowSignalWrites: true });

  async ngOnInit() {
    // Vérifier d'abord si l'utilisateur est connecté avant de charger le profil
    const user = this.authService.getCurrentUser();
    this.currentUser.set(user);
    
    // Ne charger le profil que si l'utilisateur est connecté
    if (user) {
      const profile = await this.authService.getProfile();
      this.profile.set(profile);
      let role = this.authService.getActiveRole();
      
      // Si aucun rôle actif défini mais que l'utilisateur a des rôles, utiliser le premier rôle disponible
      if (!role && profile?.roles && profile.roles.length > 0) {
        role = profile.roles[0];
        console.log('[Header] Aucun rôle actif défini, utilisation du premier rôle disponible:', role);
      }
      
      this.activeRole.set(role);
      
      // Charger le profil approprié selon le rôle via les stores
      if (role === 'parent') {
        if (!this.parentStore.checkIsInitialized()) {
          this.parentStore.loadParentProfile();
        }
      } else if (role === 'prof') {
        if (!this.teacherStore.checkIsInitialized()) {
          this.teacherStore.loadTeacherProfile();
        }
      }
    } else {
      // S'assurer que le profil est null si l'utilisateur n'est pas connecté
      this.profile.set(null);
      this.activeRole.set(null);
    }
    
    // Écouter les changements d'utilisateur (session)
    this.userSubscription = this.authService.currentUser$.subscribe((user: User | null) => {
      this.currentUser.set(user);
      // Si l'utilisateur se déconnecte, réinitialiser le profil
      if (!user) {
        this.profile.set(null);
        this.activeRole.set(null);
      }
    });
    
    // Écouter les changements de profil
    this.profileSubscription = this.authService.currentProfile$.subscribe((profile: Profile | null) => {
      // Ne mettre à jour le profil que si l'utilisateur est connecté
      if (this.currentUser()) {
        this.profile.set(profile);
        
        // Ne pas écraser le rôle actif ici, l'effect activeRoleSyncEffect s'en charge
        // On vérifie juste si le rôle actif est toujours valide
        const currentRole = this.activeRole();
        const authServiceRole = this.authService.getActiveRole();
        
        // Si aucun rôle actif défini mais que l'utilisateur a des rôles, utiliser le premier rôle disponible
        if (!authServiceRole && !currentRole && profile?.roles && profile.roles.length > 0) {
          const firstRole = profile.roles[0];
          console.log('[Header] Aucun rôle actif défini dans la subscription, utilisation du premier rôle disponible:', firstRole);
          // L'effect se chargera de synchroniser, mais on peut aussi le définir directement dans AuthService
          this.authService.setActiveRole(firstRole);
        }
        
        console.log('[Header] Profil changé:', { 
          hasProfile: !!profile, 
          currentRole,
          authServiceRole,
          roles: profile?.roles 
        });
      } else {
        // Si l'utilisateur n'est pas connecté, s'assurer que le profil est null
        this.profile.set(null);
        this.activeRole.set(null);
      }
    });
    
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.currentRoute.set(event.url);
        this.isMenuOpen.set(false);
      });
    
    this.currentRoute.set(this.router.url);
  }

  ngOnDestroy() {
    this.profileSubscription?.unsubscribe();
    this.userSubscription?.unsubscribe();
    this.routerSubscription?.unsubscribe();
  }

  async logout() {
    await this.authService.signOut();
    this.router.navigate(['/login']);
  }

  toggleMenu() {
    this.isMenuOpen.update(open => !open);
  }

  closeMenu() {
    this.isMenuOpen.set(false);
  }

  /**
   * Génère les éléments de navigation par défaut basés sur le rôle actif
   */
  private getDefaultNavItems(): HeaderNavItem[] {
    const items: HeaderNavItem[] = [];
    
    if (!this.isAuthenticated()) {
      return items;
    }

    // Tableau de bord - toujours visible si authentifié
    items.push({
      label: 'Tableau de bord',
      route: '/dashboard',
      icon: '🏠',
      visible: () => this.isAuthenticated()
    });

    // Éléments spécifiques au rôle parent
    if (this.activeRole() === 'parent') {
      items.push({
        label: 'Mon profil parent',
        route: '/parent-profile',
        icon: '👤',
        visible: () => this.isAuthenticated() && this.activeRole() === 'parent'
      });
      items.push({
        label: 'Ajouter un enfant',
        route: '/child-profile',
        icon: '➕',
        visible: () => this.isAuthenticated() && this.activeRole() === 'parent'
      });
    }

    // Éléments spécifiques au rôle professeur
    if (this.activeRole() === 'prof') {
      items.push({
        label: 'Mon profil professeur',
        route: '/teacher-profile',
        icon: '👨‍🏫',
        visible: () => this.isAuthenticated() && this.activeRole() === 'prof'
      });
      items.push({
        label: 'Mes affectations',
        route: '/teacher-assignments',
        queryParams: { add: 'true' },
        icon: '📚',
        visible: () => this.isAuthenticated() && this.activeRole() === 'prof'
      });
    }

    // Changer de rôle - visible si plusieurs rôles
    items.push({
      label: 'Changer de rôle',
      route: '/select-role',
      icon: '🔄',
      visible: () => this.isAuthenticated() && this.hasMultipleRoles()
    });

    return items;
  }

}
