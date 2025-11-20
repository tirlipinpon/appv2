import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService, Profile } from '../../../../services/auth/auth.service';
import { ParentStore } from '../../../parent/store/index';
import { TrackByUtils } from '../../../../shared/utils/track-by.util';

@Component({
  selector: 'app-role-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './role-selector.component.html',
  styleUrl: './role-selector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
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

  // TrackBy pour optimiser *ngFor
  readonly trackByRole = TrackByUtils.byValue;

  async ngOnInit() {
    try {
      this.profile = this.authService.getCurrentProfile();
      
      if (!this.profile) {
        this.profile = await this.authService.getProfile();
      }
      
      if (this.profile) {
        this.availableRoles = this.profile.roles;
      } else {
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
      
      if (role === 'parent') {
        this.parentStore.checkParentStatus();
      }
      
      this.router.navigate(['/dashboard']);
    }
  }
}
