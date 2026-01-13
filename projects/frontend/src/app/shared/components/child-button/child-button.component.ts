import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-child-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <button
      [class]="'child-button ' + (variant() || 'primary') + ' ' + (size() || 'medium')"
      [disabled]="disabled()"
      [type]="type() || 'button'"
      (click)="buttonClick.emit($event)">
      <ng-content></ng-content>
    </button>
  `,
  styles: [`
    .child-button {
      border: none;
      border-radius: var(--theme-border-radius, 12px);
      font-family: inherit;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .child-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .child-button:not(:disabled):hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }

    .child-button:not(:disabled):active {
      transform: translateY(0);
    }

    /* Variants */
    .child-button.primary {
      background-color: var(--theme-primary-color, #4CAF50);
      color: white;
    }

    .child-button.secondary {
      background-color: var(--theme-accent-color, #FFC107);
      color: #333;
    }

    .child-button.danger {
      background-color: var(--theme-warn-color, #F44336);
      color: white;
    }

    /* Sizes */
    .child-button.small {
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
    }

    .child-button.medium {
      padding: 0.75rem 1.5rem;
      font-size: 1rem;
    }

    .child-button.large {
      padding: 1rem 2rem;
      font-size: 1.25rem;
    }
  `]
})
export class ChildButtonComponent {
  variant = input<'primary' | 'secondary' | 'danger'>('primary');
  size = input<'small' | 'medium' | 'large'>('medium');
  disabled = input<boolean>(false);
  type = input<'button' | 'submit' | 'reset'>('button');
  buttonClick = output<MouseEvent>();
}

