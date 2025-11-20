import { Component, inject, OnInit, OnDestroy, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { AuthService, Profile } from '../../services/auth/auth.service';
import { filter, Subscription } from 'rxjs';
import type { User } from '@supabase/supabase-js';

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
  
  profile = signal<Profile | null>(null);
  currentUser = signal<User | null>(null);
  activeRole = signal<string | null>(null);
  currentRoute = signal<string>('');
  isMenuOpen = signal(false);
  
  private profileSubscription?: Subscription;
  private userSubscription?: Subscription;
  private routerSubscription?: Subscription;
  
  readonly isAuthenticated = computed(() => {
    // Vérifier à la fois l'utilisateur ET le profil pour s'assurer que l'utilisateur est vraiment connecté
    return this.currentUser() !== null && this.profile() !== null;
  });
  readonly hasMultipleRoles = computed(() => {
    const p = this.profile();
    return p ? p.roles.length > 1 : false;
  });
  readonly displayName = computed(() => {
    const p = this.profile();
    return p?.display_name || p?.id || 'Utilisateur';
  });

  async ngOnInit() {
    // Vérifier d'abord si l'utilisateur est connecté avant de charger le profil
    const user = this.authService.getCurrentUser();
    this.currentUser.set(user);
    
    // Ne charger le profil que si l'utilisateur est connecté
    if (user) {
      this.profile.set(await this.authService.getProfile());
      this.activeRole.set(this.authService.getActiveRole());
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
      }
    });
    
    // Écouter les changements de profil
    this.profileSubscription = this.authService.currentProfile$.subscribe(profile => {
      // Ne mettre à jour le profil que si l'utilisateur est connecté
      if (this.currentUser()) {
        this.profile.set(profile);
        this.activeRole.set(this.authService.getActiveRole());
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
}
