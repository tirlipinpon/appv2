import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

export interface ActionLink {
  label: string;
  route: string | string[];
  queryParams?: Record<string, any>;
  variant?: 'primary' | 'secondary' | 'add' | 'edit';
  icon?: string;
}

@Component({
  selector: 'app-action-links',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './action-links.component.html',
  styleUrl: './action-links.component.scss'
})
export class ActionLinksComponent {
  @Input({ required: true }) actions: ActionLink[] = [];
}

