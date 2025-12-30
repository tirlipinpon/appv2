import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ChildAuthService } from '../../../core/auth/child-auth.service';

@Component({
  selector: 'app-app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-layout">
      <header class="app-header">
        <h1>Mon Application</h1>
        <nav>
          <a routerLink="/dashboard" routerLinkActive="active">Tableau de bord</a>
          <a routerLink="/subjects" routerLinkActive="active">Matières</a>
          <a routerLink="/collection" routerLinkActive="active">Collection</a>
          <a routerLink="/settings" routerLinkActive="active">Paramètres</a>
        </nav>
        <button (click)="onLogout()">Déconnexion</button>
      </header>
      <main class="app-main">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .app-layout {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .app-header {
      background-color: var(--theme-header-bg);
      color: var(--theme-header-text);
      padding: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    nav {
      display: flex;
      gap: 1rem;
    }
    nav a {
      color: var(--theme-header-text);
      text-decoration: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
    }
    nav a.active {
      background-color: rgba(255, 255, 255, 0.2);
    }
    .app-main {
      flex: 1;
      padding: 2rem;
    }
    button {
      padding: 0.5rem 1rem;
      background-color: var(--theme-warn-color);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
  `]
})
export class AppLayoutComponent {
  private readonly authService = inject(ChildAuthService);

  onLogout(): void {
    this.authService.logout();
  }
}

