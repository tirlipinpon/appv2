import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-progress-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <div class="progress-bar-container">
      @if (label()) {
        <div class="progress-bar-label">
          {{ label() }} 
          <span class="progress-percentage">&nbsp; {{ percentage() }}%</span>
        </div>
      }
      <div class="progress-bar-wrapper">
        <div
          class="progress-bar-fill"
          [style.width.%]="percentage()"
          [class]="'variant-' + (variant() || 'primary')">
        </div>
      </div>
    </div>
  `,
  styles: [`
    .progress-bar-container {
      width: 100%;
    }

    .progress-bar-label {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
      font-size: 0.875rem;
      font-weight: 600;
    }

    .progress-percentage {
      color: var(--theme-primary-color, #4CAF50);
      font-weight: 700;
    }

    .progress-bar-wrapper {
      width: 100%;
      height: 1rem;
      background-color: #e0e0e0;
      border-radius: 999px;
      overflow: hidden;
      position: relative;
    }

    .progress-bar-fill {
      height: 100%;
      border-radius: 999px;
      transition: width 0.3s ease;
      position: relative;
    }

    .progress-bar-fill.variant-primary {
      background: linear-gradient(90deg, var(--theme-primary-color, #4CAF50), #66BB6A);
    }

    .progress-bar-fill.variant-secondary {
      background: linear-gradient(90deg, var(--theme-accent-color, #FFC107), #FFD54F);
    }

    .progress-bar-fill.variant-success {
      background: linear-gradient(90deg, #4CAF50, #66BB6A);
    }

    .progress-bar-fill::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(255, 255, 255, 0.3),
        transparent
      );
      animation: shimmer 2s infinite;
    }

    @keyframes shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }
  `]
})
export class ProgressBarComponent {
  value = input<number>(0);
  max = input<number>(100);
  label = input<string>('');
  variant = input<'primary' | 'secondary' | 'success'>('primary');

  percentage = computed(() => {
    const val = this.value();
    const maxVal = this.max();
    if (maxVal === 0) return 0;
    return Math.min(100, Math.max(0, Math.round((val / maxVal) * 100)));
  });
}

