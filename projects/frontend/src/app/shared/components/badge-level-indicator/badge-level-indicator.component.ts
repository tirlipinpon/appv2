import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-badge-level-indicator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <div
      class="badge-level-indicator"
      [class]="'level-' + level()"
      [style.background-color]="levelColor()"
      [style.border-color]="levelBorderColor()">
      <span class="level-number">{{ level() }}</span>
    </div>
  `,
  styles: [`
    .badge-level-indicator {
      position: absolute;
      top: -8px;
      right: -8px;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 3px solid;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      z-index: 10;
      transition: all 0.3s ease;
    }

    .badge-level-indicator:hover {
      transform: scale(1.1);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    }

    .level-number {
      font-size: 0.875rem;
      font-weight: 700;
      color: white;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
      line-height: 1;
    }

    /* Couleurs selon le niveau */
    .level-1 {
      background: linear-gradient(135deg, #9e9e9e, #757575);
      border-color: #616161;
    }

    .level-2 {
      background: linear-gradient(135deg, #4caf50, #388e3c);
      border-color: #2e7d32;
    }

    .level-3 {
      background: linear-gradient(135deg, #2196f3, #1976d2);
      border-color: #1565c0;
    }

    .level-4 {
      background: linear-gradient(135deg, #9c27b0, #7b1fa2);
      border-color: #6a1b9a;
    }

    .level-5 {
      background: linear-gradient(135deg, #ff9800, #f57c00);
      border-color: #e65100;
    }

    .level-6 {
      background: linear-gradient(135deg, #f44336, #d32f2f);
      border-color: #c62828;
    }

    /* Niveaux supérieurs - or/diamant */
    .level-7,
    .level-8,
    .level-9,
    .level-10 {
      background: linear-gradient(135deg, #ffd700, #ffa500);
      border-color: #ff8c00;
      box-shadow: 0 2px 8px rgba(255, 215, 0, 0.5);
    }

    /* Niveaux très élevés - effet spécial */
    .level-11,
    .level-12,
    .level-13,
    .level-14,
    .level-15 {
      background: linear-gradient(135deg, #e0e0e0, #bdbdbd);
      border-color: #9e9e9e;
      box-shadow: 0 2px 8px rgba(224, 224, 224, 0.6);
      animation: shimmer 2s ease-in-out infinite;
    }

    @keyframes shimmer {
      0%, 100% {
        box-shadow: 0 2px 8px rgba(224, 224, 224, 0.6);
      }
      50% {
        box-shadow: 0 2px 12px rgba(255, 255, 255, 0.8);
      }
    }
  `]
})
export class BadgeLevelIndicatorComponent {
  level = input.required<number>();

  // Couleur de fond calculée selon le niveau
  levelColor = computed(() => {
    const lvl = this.level();
    if (lvl <= 1) return '#757575'; // Gris
    if (lvl === 2) return '#388e3c'; // Vert
    if (lvl === 3) return '#1976d2'; // Bleu
    if (lvl === 4) return '#7b1fa2'; // Violet
    if (lvl === 5) return '#f57c00'; // Orange
    if (lvl === 6) return '#d32f2f'; // Rouge
    if (lvl <= 10) return '#ffa500'; // Or
    return '#bdbdbd'; // Argent/Diamant
  });

  // Couleur de bordure calculée selon le niveau
  levelBorderColor = computed(() => {
    const lvl = this.level();
    if (lvl <= 1) return '#616161';
    if (lvl === 2) return '#2e7d32';
    if (lvl === 3) return '#1565c0';
    if (lvl === 4) return '#6a1b9a';
    if (lvl === 5) return '#e65100';
    if (lvl === 6) return '#c62828';
    if (lvl <= 10) return '#ff8c00';
    return '#9e9e9e';
  });
}
