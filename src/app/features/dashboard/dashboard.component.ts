import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService, Profile } from '../../services/auth/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  profile: Profile | null = null;
  activeRole: string | null = null;

  async ngOnInit() {
    this.profile = await this.authService.getProfile();
    this.activeRole = this.authService.getActiveRole();
  }

  async logout() {
    await this.authService.signOut();
  }
}
