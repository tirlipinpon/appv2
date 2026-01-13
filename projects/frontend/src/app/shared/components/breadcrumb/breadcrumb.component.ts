import { Component, input, ChangeDetectionStrategy } from '@angular/core';

export interface BreadcrumbItem {
  label: string;
  action?: () => void;
  isActive?: boolean;
}

@Component({
  selector: 'app-breadcrumb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    @if (items().length > 0) {
      <nav class="breadcrumb">
      @for (item of items(); track $index) {
        @if ($index > 0) {
          <span class="breadcrumb-separator">›</span>
        }
        @if (item.isActive || !item.action) {
          <span class="breadcrumb-item active">{{ item.label }}</span>
        } @else {
          <a 
            class="breadcrumb-item"
            (click)="item.action()"
            (keydown.enter)="item.action()"
            tabindex="0"
            role="button">
            {{ item.label }}
          </a>
        }
      }
      </nav>
    }
  `,
  styles: [`
    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
      font-size: 0.9rem;
    }

    .breadcrumb-item {
      color: var(--theme-primary-color, #4CAF50);
      text-decoration: none;
      cursor: pointer;
      transition: color 0.2s ease, background-color 0.2s ease;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
    }

    .breadcrumb-item:hover {
      color: var(--theme-primary-color-dark, #388e3c);
      background-color: rgba(76, 175, 80, 0.1);
    }

    .breadcrumb-item.active {
      color: var(--theme-text-color, #333);
      cursor: default;
      font-weight: 600;
    }

    .breadcrumb-item.active:hover {
      background-color: transparent;
    }

    .breadcrumb-separator {
      color: #999;
      user-select: none;
    }
  `]
})
export class BreadcrumbComponent {
  items = input.required<BreadcrumbItem[]>();
}
