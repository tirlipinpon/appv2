import { Component, Input, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

export interface ActionLink {
  label: string;
  route?: string | string[];
  queryParams?: Record<string, unknown>;
  action?: () => void;
  variant?: 'primary' | 'secondary' | 'add' | 'edit';
  icon?: string;
}

@Component({
  selector: 'app-action-links',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './action-links.component.html',
  styleUrls: ['./action-links.component.scss']
})
export class ActionLinksComponent {
  private readonly cdr = inject(ChangeDetectorRef);
  
  @Input({ required: true }) actions: ActionLink[] = [];
  
  handleAction(action: (() => void) | undefined, event: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (action) {
      action();
      // Forcer la détection de changement après l'action
      setTimeout(() => {
        this.cdr.detectChanges();
      }, 0);
    }
  }

  trackByAction(index: number, action: ActionLink): string | number {
    if (action.route) {
      return Array.isArray(action.route) ? action.route.join('|') : action.route;
    }
    return action.label ?? index;
  }
}
