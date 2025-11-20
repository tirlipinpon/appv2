import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService, Profile } from '../../../../services/auth/auth.service';
import { ParentStore } from '../../../parent/store/index';

@Component({
  selector: 'app-role-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './role-selector.component.html',
  styleUrl: './role-selector.component.scss'
})
export class RoleSelectorComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly parentStore = inject(ParentStore);
  profile: Profile | null = null;
  availableRoles: string[] = [];
  roleLabels: Record<string, string> = {
    'parent': 'Parent',
    'prof': 'Professeur',
    'admin': 'Administrateur'
  };
  roleIcons: Record<string, string> = {
    'parent': '👨‍👩‍👧‍👦',
    'prof': '👨‍🏫',
    'admin': '👤'
  };
  roleDescriptions: Record<string, string> = {
    'parent': 'Gérer le parcours éducatif de vos enfants',
    'prof': 'Accompagner et valider l\'évolution de vos élèves',
    'admin': 'Administrer l\'application'
  };

  async ngOnInit() {
    // Utiliser getCurrentProfile() d'abord pour éviter les appels API inutiles
    // Si le profil n'est pas encore chargé, utiliser getProfile() qui a un cache
    try {
      // Vérifier d'abord si le profil est déjà chargé
      this.profile = this.authService.getCurrentProfile();
      
      if (!this.profile) {
        // Si le profil n'est pas chargé, utiliser getProfile() qui a un cache
        // pour éviter les appels multiples simultanés
        this.profile = await this.authService.getProfile();
      }
      
      if (this.profile) {
        this.availableRoles = this.profile.roles;
      } else {
        // Si pas de profil, rediriger vers login
        this.router.navigate(['/login']);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      this.router.navigate(['/login']);
    }
  }

  ngOnDestroy(): void {
    // Cleanup si nécessaire
  }

  selectRole(role: string) {
    if (this.availableRoles.includes(role)) {
      this.authService.setActiveRole(role);
      
      // Si le rôle sélectionné est parent, vérifier le statut du profil
      if (role === 'parent') {
        this.parentStore.checkParentStatus();
      }
      
      this.router.navigate(['/dashboard']);
    }
  }
}
