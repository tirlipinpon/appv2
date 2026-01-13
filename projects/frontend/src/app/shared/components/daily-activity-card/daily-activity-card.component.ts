import {
  Component,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import { DailyActivityStatus } from '../../../core/types/daily-activity.types';
import { formatMinutes, formatGames, getStatusLabel } from '../../utils/daily-activity.util';
import { CommonModule } from '@angular/common';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { BadgeVisualComponent } from '../badge-visual/badge-visual.component';

@Component({
  selector: 'app-daily-activity-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatProgressBarModule, BadgeVisualComponent],
  template: `
    <div class="daily-activity-card" [class]="'status-' + status().status">
      <div class="card-header">
        <h2>🎯 Mon Activité Aujourd'hui</h2>
        <div class="status-badge" [class]="'status-' + status().status">
          {{ getStatusLabel(status().status) }}
        </div>
      </div>

      <div class="card-content">
        <!-- Statistiques principales -->
        <div class="stats-row">
          <div class="stat-item">
            <div class="stat-icon">⏱️</div>
            <div class="stat-value">{{ formatMinutes(status().totalActiveMinutes) }}</div>
            <div class="stat-label">Temps de jeu</div>
          </div>
          <div class="stat-item">
            <div class="stat-icon">🎮</div>
            <div class="stat-value">{{ formatGames(status().totalGamesCompleted) }}</div>
            <div class="stat-label">Jeux complétés</div>
          </div>
          <div class="stat-item">
            <div class="stat-icon">⭐</div>
            <div class="stat-value">Niveau {{ status().maxLevelToday || 0 }}</div>
            <div class="stat-label">Niveau atteint</div>
          </div>
        </div>

        <!-- Progress bar vers le prochain niveau -->
        @if (status().maxLevelToday > 0 || status().status === 'in_progress') {
          <div class="progress-section">
            <div class="progress-header">
              <span class="progress-label">Progression vers le niveau {{ status().nextLevelTarget.level }}</span>
              <span class="progress-percentage">{{ status().progressPercentage }}%</span>
            </div>
            <mat-progress-bar
              mode="determinate"
              [value]="status().progressPercentage"
              [class]="'progress-' + status().status">
            </mat-progress-bar>
            <div class="progress-details">
              <span class="progress-item">
                {{ formatMinutes(status().nextLevelTarget.minutesRemaining) }} restantes
              </span>
              <span class="progress-item">
                {{ formatGames(status().nextLevelTarget.gamesRemaining) }} restants
              </span>
            </div>
          </div>
        }

        <!-- Badges débloqués aujourd'hui -->
        @if (status().levelsUnlockedToday.length > 0) {
          <div class="unlocked-levels">
            <h3>Niveaux débloqués aujourd'hui</h3>
            <div class="levels-grid">
              @for (level of status().levelsUnlockedToday; track level) {
                <div class="level-badge">
                  <app-badge-visual
                    [badgeType]="'daily_activity'"
                    [level]="level"
                    [isUnlocked]="true"
                    size="small"
                    [showIcon]="false">
                  </app-badge-visual>
                  <span class="level-number">N{{ level }}</span>
                </div>
              }
            </div>
          </div>
        }

        <!-- Message d'encouragement -->
        @if (status().status === 'not_started') {
          <div class="encouragement-message">
            <p>🎮 Commence à jouer pour débloquer ton premier niveau !</p>
            <p class="requirement">Objectif : {{ formatMinutes(10) }} et {{ formatGames(3) }}</p>
          </div>
        } @else if (status().status === 'in_progress') {
          <div class="encouragement-message">
            <p>💪 Continue comme ça ! Tu es sur la bonne voie.</p>
          </div>
        } @else if (status().status === 'active') {
          <div class="encouragement-message success">
            <p>🎉 Excellent ! Tu as débloqué le niveau {{ status().maxLevelToday }} aujourd'hui !</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .daily-activity-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      color: white;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .card-header h2 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
    }

    .status-badge {
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.875rem;
      font-weight: 600;
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
    }

    .status-badge.status-active {
      background: rgba(76, 175, 80, 0.3);
    }

    .status-badge.status-in_progress {
      background: rgba(255, 193, 7, 0.3);
    }

    .status-badge.status-not_started {
      background: rgba(158, 158, 158, 0.3);
    }

    .stats-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    .stat-item {
      text-align: center;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      padding: 16px;
    }

    .stat-icon {
      font-size: 2rem;
      margin-bottom: 8px;
    }

    .stat-value {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .stat-label {
      font-size: 0.875rem;
      opacity: 0.9;
    }

    .progress-section {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
    }

    .progress-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .progress-label {
      font-size: 0.875rem;
      font-weight: 600;
    }

    .progress-percentage {
      font-size: 1rem;
      font-weight: 700;
    }

    ::ng-deep .mat-mdc-progress-bar {
      height: 8px;
      border-radius: 4px;
      overflow: hidden;
    }

    ::ng-deep .mat-mdc-progress-bar .mdc-linear-progress__buffer {
      background-color: rgba(255, 255, 255, 0.2);
    }

    ::ng-deep .mat-mdc-progress-bar .mdc-linear-progress__bar-inner {
      background-color: #4caf50;
    }

    .progress-details {
      display: flex;
      justify-content: space-around;
      margin-top: 12px;
      font-size: 0.875rem;
      opacity: 0.9;
    }

    .progress-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .unlocked-levels {
      margin-bottom: 20px;
    }

    .unlocked-levels h3 {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 12px;
    }

    .levels-grid {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .level-badge {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .level-number {
      font-size: 0.75rem;
      font-weight: 600;
      opacity: 0.9;
    }

    .encouragement-message {
      text-align: center;
      padding: 16px;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      margin-top: 16px;
    }

    .encouragement-message p {
      margin: 0 0 8px 0;
      font-size: 1rem;
      font-weight: 600;
    }

    .encouragement-message.success {
      background: rgba(76, 175, 80, 0.2);
    }

    .requirement {
      font-size: 0.875rem;
      opacity: 0.9;
      font-weight: 400;
    }

    @media (max-width: 768px) {
      .stats-row {
        grid-template-columns: 1fr;
      }

      .card-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
      }
    }
  `],
})
export class DailyActivityCardComponent {
  status = input.required<DailyActivityStatus>();

  // Utiliser les fonctions utilitaires
  formatMinutes = formatMinutes;
  formatGames = formatGames;
  getStatusLabel = getStatusLabel;

  constructor() {
  }
}
