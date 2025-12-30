import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService, Profile } from '../../../../shared';
import { ParentStore } from '../../../parent/store/index';
import { TrackByUtils } from '../../../../shared';

@Component({
  selector: 'app-role-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './role-selector.component.html',
  styleUrl: './role-selector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleSelectorComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
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
        
        // Si un seul rôle, le sélectionner automatiquement et rediriger
        if (this.availableRoles.length === 1) {
          this.selectRole(this.availableRoles[0]);
          return;
        }
        
        // Si plusieurs rôles, NE PAS rediriger automatiquement
        // L'utilisateur doit pouvoir voir et choisir un rôle même s'il y en a un de sauvegardé
        // La redirection automatique ne se fait que si un returnUrl est présent (depuis un guard)
        const returnUrl = this.route.snapshot.queryParams['returnUrl'];
        if (returnUrl) {
          // Si on arrive ici avec un returnUrl, c'est qu'on vient d'un guard
          // Vérifier si un rôle est déjà sélectionné
          const activeRole = this.authService.getActiveRole();
          if (activeRole && this.availableRoles.includes(activeRole)) {
            // Rôle déjà sélectionné, rediriger vers la page demandée
            this.router.navigateByUrl(returnUrl);
            return;
          }
          // Sinon, laisser l'utilisateur choisir (pas de return, afficher la page)
        }
        // Pas de returnUrl = l'utilisateur est arrivé volontairement, afficher la page de sélection
      } else {
        this.router.navigate(['/login']);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      this.router.navigate(['/login']);
    }
  }

  selectRole(role: string) {
    if (this.availableRoles.includes(role)) {
      this.authService.setActiveRole(role);

      if (role === 'parent') {
        this.parentStore.checkParentStatus();
      }

      // Rediriger vers la page demandée ou dashboard
      const returnUrl = this.route.snapshot.queryParams['returnUrl'];
      if (returnUrl) {
        this.router.navigateByUrl(returnUrl);
      } else {
        this.router.navigate(['/dashboard']);
      }
    }
  }
}
