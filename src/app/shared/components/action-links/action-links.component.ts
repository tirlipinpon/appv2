import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

export interface ActionLink {
  label: string;
  route: string | string[];
  queryParams?: Record<string, unknown>;
  variant?: 'primary' | 'secondary' | 'add' | 'edit';
  icon?: string;
}

@Component({
  selector: 'app-action-links',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './action-links.component.html',
  styleUrls: ['./action-links.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActionLinksComponent {
  @Input({ required: true }) actions: ActionLink[] = [];

  trackByAction(index: number, action: ActionLink): string | number {
    return Array.isArray(action.route) ? action.route.join('|') : action.route ?? index;
  }
}
