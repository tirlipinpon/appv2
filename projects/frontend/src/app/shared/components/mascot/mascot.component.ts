import { Component, input, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MascotService } from '../../../core/services/mascot/mascot.service';

@Component({
  selector: 'app-mascot',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mascot-container" [class]="'level-' + (mascotLevel() || 1)">
      <div class="mascot-avatar" [style.background-color]="mascotColor()">
        <div class="mascot-face">
          <div class="mascot-eyes">
            <span class="eye left"></span>
            <span class="eye right"></span>
          </div>
          <div class="mascot-mouth"></div>
        </div>
        <div class="mascot-accessories" *ngIf="mascotAccessories()">
          <span *ngFor="let acc of mascotAccessories()" [class]="'accessory ' + acc">★</span>
        </div>
      </div>
      <div class="mascot-info" *ngIf="showInfo()">
        <div class="mascot-name">{{ mascotName() || 'Mon Ami' }}</div>
        <div class="mascot-level">Niveau {{ mascotLevel() || 1 }}</div>
      </div>
      <div class="mascot-tooltip" *ngIf="tooltip()">
        {{ tooltip() }}
      </div>
    </div>
  `,
  styles: [`
    .mascot-container {
      position: relative;
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
    }

    .mascot-avatar {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      transition: all 0.3s ease;
      animation: bounce 2s infinite;
    }

    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
    }

    .mascot-face {
      position: relative;
      width: 60%;
      height: 60%;
    }

    .mascot-eyes {
      display: flex;
      justify-content: space-around;
      margin-bottom: 0.5rem;
    }

    .eye {
      width: 8px;
      height: 8px;
      background-color: #333;
      border-radius: 50%;
      display: inline-block;
      animation: blink 3s infinite;
    }

    @keyframes blink {
      0%, 90%, 100% { transform: scaleY(1); }
      95% { transform: scaleY(0.1); }
    }

    .mascot-mouth {
      width: 20px;
      height: 10px;
      border: 2px solid #333;
      border-top: none;
      border-radius: 0 0 20px 20px;
      margin: 0 auto;
    }

    .mascot-accessories {
      position: absolute;
      top: -10px;
      right: -10px;
    }

    .accessory {
      display: inline-block;
      font-size: 1.2rem;
      color: var(--theme-star-color, #FFD700);
    }

    .mascot-info {
      text-align: center;
      font-size: 0.875rem;
    }

    .mascot-name {
      font-weight: 600;
      color: var(--theme-text-color, #333);
    }

    .mascot-level {
      font-size: 0.75rem;
      color: var(--theme-primary-color, #4CAF50);
    }

    .mascot-tooltip {
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      background-color: #333;
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-size: 0.875rem;
      white-space: nowrap;
      margin-bottom: 0.5rem;
      opacity: 0;
      animation: fadeIn 0.3s ease forwards;
    }

    @keyframes fadeIn {
      to { opacity: 1; }
    }

    .mascot-tooltip::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 6px solid transparent;
      border-top-color: #333;
    }
  `]
})
export class MascotComponent {
  private readonly mascotService = inject(MascotService);

  childId = input<string | null>(null);
  showInfo = input<boolean>(true);
  tooltip = input<string | null>(null);
  size = input<'small' | 'medium' | 'large'>('medium');

  mascotName = input<string>('Mon Ami');
  mascotLevel = input<number>(1);
  mascotColor = input<string>('#4CAF50');
  mascotAccessories = input<string[]>([]);

  constructor() {
    effect(() => {
      const id = this.childId();
      if (id) {
        this.loadMascotState(id);
      }
    });
  }

  private async loadMascotState(childId: string): Promise<void> {
    const state = await this.mascotService.getMascotState(childId);
    if (state) {
      // Les valeurs seront mises à jour via les inputs si nécessaire
    }
  }
}

