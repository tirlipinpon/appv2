import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      <h1>Tableau de bord</h1>
      <p>Bienvenue sur ton tableau de bord !</p>
    </div>
  `,
  styles: [`
    .dashboard-container {
      padding: 2rem;
    }
  `]
})
export class DashboardComponent {}

