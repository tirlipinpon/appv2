import { Component, inject, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ChildAuthService } from '../../../core/auth/child-auth.service';
import { BadgeNotificationService } from '../../../core/services/badges/badge-notification.service';
import { BadgeNotificationModalComponent } from '../badge-notification-modal/badge-notification-modal.component';

@Component({
  selector: 'app-app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, BadgeNotificationModalComponent],
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
      
      <!-- Modal de notification de badge -->
      <app-badge-notification-modal
        *ngIf="currentBadge()"
        [visible]="badgeNotification.isNotificationVisible()"
        [badgeName]="currentBadge()!.badge_name"
        [badgeType]="currentBadge()!.badge_type"
        [level]="currentBadge()!.level"
        [value]="currentBadge()!.value"
        [description]="currentBadge()!.description"
        (continueClick)="onBadgeNotificationContinue()">
      </app-badge-notification-modal>
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
      flex-wrap: wrap;
    }
    nav a {
      color: var(--theme-header-text);
      text-decoration: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      font-size: 0.875rem;
    }
    nav a.active {
      background-color: rgba(255, 255, 255, 0.2);
    }
    .app-main {
      flex: 1;
      padding: 1rem;
    }
    @media (min-width: 768px) {
      .app-main {
        padding: 2rem;
      }
      nav a {
        font-size: 1rem;
      }
    }
    @media (max-width: 767px) {
      .app-header {
        flex-direction: column;
        gap: 1rem;
      }
      nav {
        justify-content: center;
        width: 100%;
      }
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
  private readonly router = inject(Router);
  protected readonly badgeNotification = inject(BadgeNotificationService);

  // Badge actuellement affiché
  currentBadge = computed(() => {
    const badge = this.badgeNotification.getCurrentBadge();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app-layout.component.ts:108',message:'currentBadge COMPUTED',data:{hasBadge:!!badge,badgeId:badge?.badge_id,badgeName:badge?.badge_name,isVisible:this.badgeNotification.isNotificationVisible()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
    // #endregion
    return badge;
  });

  constructor() {
    // Surveiller les changements de badge
    effect(() => {
      const badge = this.currentBadge();
      const isVisible = this.badgeNotification.isNotificationVisible();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app-layout.component.ts:115',message:'currentBadge EFFECT',data:{hasBadge:!!badge,badgeId:badge?.badge_id,isVisible},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
      // #endregion
    });
  }

  /**
   * Gère la déconnexion de l'utilisateur
   * Nettoie complètement la session et redirige explicitement vers la page de connexion
   */
  async onLogout(): Promise<void> {
    // Déconnexion complète (nettoie session, intervalles, etc.)
    await this.authService.logout();
    
    // Redirection explicite vers la page de connexion
    // Utiliser replaceUrl pour éviter de pouvoir revenir en arrière
    await this.router.navigate(['/login'], {
      replaceUrl: true,
    });
  }

  /**
   * Gère le clic sur le bouton "Continuer" de la modal de badge
   */
  onBadgeNotificationContinue(): void {
    this.badgeNotification.closeCurrentNotification();
  }
}

