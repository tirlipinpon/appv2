import { Component, inject, OnInit, OnDestroy, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { AuthService, Profile } from '../../services/auth/auth.service';
import { ParentService } from '../../../features/parent/services/parent/parent.service';
import { TeacherService } from '../../../features/teacher/services/teacher/teacher.service';
import { filter, Subscription } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import type { User } from '@supabase/supabase-js';
import type { Parent } from '../../../features/parent/types/parent';
import type { Teacher } from '../../../features/teacher/types/teacher';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.scss'
})
export class AppHeaderComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly parentService = inject(ParentService);
  private readonly teacherService = inject(TeacherService);
  
  profile = signal<Profile | null>(null);
  currentUser = signal<User | null>(null);
  activeRole = signal<string | null>(null);
  currentRoute = signal<string>('');
  isMenuOpen = signal(false);
  parentProfile = signal<Parent | null>(null);
  teacherProfile = signal<Teacher | null>(null);
  
  private profileSubscription?: Subscription;
  private userSubscription?: Subscription;
  private routerSubscription?: Subscription;
  private isLoadingParent = false;
  private isLoadingTeacher = false;
  
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
    const authServiceRole = this.authService.activeRole$();
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
      console.log('[Header] Utilisateur non authentifié, nettoyage des profils');
      this.parentProfile.set(null);
      this.teacherProfile.set(null);
      this.isLoadingParent = false;
      this.isLoadingTeacher = false;
      return;
    }

    if (effectiveRole === 'parent') {
      console.log('[Header] Rôle parent détecté, chargement du profil parent');
      // Nettoyer le profil professeur si on passe en mode parent
      this.teacherProfile.set(null);
      this.isLoadingTeacher = false;
      void this.loadParentProfile();
    } else if (effectiveRole === 'prof') {
      console.log('[Header] Rôle prof détecté, chargement du profil professeur');
      // Nettoyer le profil parent si on passe en mode professeur
      this.parentProfile.set(null);
      this.isLoadingParent = false;
      void this.loadTeacherProfile();
    } else {
      console.log('[Header] Aucun rôle spécifique détecté, nettoyage des profils');
      // Si aucun rôle spécifique, nettoyer les profils
      this.parentProfile.set(null);
      this.teacherProfile.set(null);
      this.isLoadingParent = false;
      this.isLoadingTeacher = false;
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
      
      // Forcer le chargement du profil approprié selon le rôle
      if (role === 'parent') {
        await this.loadParentProfile();
      } else if (role === 'prof') {
        await this.loadTeacherProfile();
      }
    } else {
      // S'assurer que le profil est null si l'utilisateur n'est pas connecté
      this.profile.set(null);
      this.activeRole.set(null);
    }
    
    // Écouter les changements d'utilisateur (session)
    this.userSubscription = this.authService.currentUser$.subscribe(user => {
      this.currentUser.set(user);
      // Si l'utilisateur se déconnecte, réinitialiser le profil
      if (!user) {
        this.profile.set(null);
        this.activeRole.set(null);
        this.parentProfile.set(null);
        this.teacherProfile.set(null);
        this.isLoadingParent = false;
        this.isLoadingTeacher = false;
      }
    });
    
    // Écouter les changements de profil
    this.profileSubscription = this.authService.currentProfile$.subscribe(profile => {
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
        this.parentProfile.set(null);
        this.teacherProfile.set(null);
        this.isLoadingParent = false;
        this.isLoadingTeacher = false;
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
   * Charge le profil parent si nécessaire
   */
  private async loadParentProfile(): Promise<void> {
    // Éviter les chargements multiples simultanés
    if (this.isLoadingParent) {
      console.log('[Header] Chargement parent déjà en cours, ignoré');
      return;
    }

    console.log('[Header] Début du chargement du profil parent');
    this.isLoadingParent = true;
    try {
      const parent = await firstValueFrom(this.parentService.getParentProfile());
      console.log('[Header] Profil parent chargé:', parent);
      this.parentProfile.set(parent);
      
      if (!parent) {
        console.warn('[Header] Aucun profil parent trouvé en base de données');
      } else if (!parent.fullname) {
        console.warn('[Header] Profil parent trouvé mais sans nom complet (fullname)');
      }
    } catch (error) {
      console.error('[Header] Erreur lors du chargement du profil parent:', error);
      this.parentProfile.set(null);
    } finally {
      this.isLoadingParent = false;
    }
  }

  /**
   * Charge le profil professeur si nécessaire
   */
  private async loadTeacherProfile(): Promise<void> {
    // Éviter les chargements multiples simultanés
    if (this.isLoadingTeacher) {
      console.log('[Header] Chargement professeur déjà en cours, ignoré');
      return;
    }

    console.log('[Header] Début du chargement du profil professeur');
    this.isLoadingTeacher = true;
    try {
      const teacher = await firstValueFrom(this.teacherService.getTeacherProfile());
      console.log('[Header] Profil professeur chargé:', teacher);
      this.teacherProfile.set(teacher);
      
      if (!teacher) {
        console.warn('[Header] Aucun profil professeur trouvé en base de données');
      } else if (!teacher.fullname) {
        console.warn('[Header] Profil professeur trouvé mais sans nom complet (fullname)');
      }
    } catch (error) {
      console.error('[Header] Erreur lors du chargement du profil professeur:', error);
      this.teacherProfile.set(null);
    } finally {
      this.isLoadingTeacher = false;
    }
  }
}
