import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService, Profile } from '../../../../services/auth/auth.service';

@Component({
  selector: 'app-role-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './role-selector.component.html',
  styleUrl: './role-selector.component.scss'
})
export class RoleSelectorComponent implements OnInit {
  profile: Profile | null = null;
  availableRoles: string[] = [];
  roleLabels: { [key: string]: string } = {
    'parent': 'Parent',
    'prof': 'Professeur',
    'admin': 'Administrateur'
  };
  roleIcons: { [key: string]: string } = {
    'parent': '👨‍👩‍👧‍👦',
    'prof': '👨‍🏫',
    'admin': '👤'
  };
  roleDescriptions: { [key: string]: string } = {
    'parent': 'Gérer le parcours éducatif de vos enfants',
    'prof': 'Accompagner et valider l\'évolution de vos élèves',
    'admin': 'Administrer l\'application'
  };

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async ngOnInit() {
    this.profile = await this.authService.getProfile();
    if (this.profile) {
      this.availableRoles = this.profile.roles;
    } else {
      // Si pas de profil, rediriger vers login
      this.router.navigate(['/login']);
    }
  }

  selectRole(role: string) {
    if (this.availableRoles.includes(role)) {
      this.authService.setActiveRole(role);
      this.router.navigate(['/dashboard']);
    }
  }
}
