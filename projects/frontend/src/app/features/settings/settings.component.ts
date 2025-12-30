import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="settings-container">
      <h1>Paramètres</h1>
      <p>Gère tes paramètres ici !</p>
    </div>
  `,
  styles: [`
    .settings-container {
      padding: 2rem;
    }
  `]
})
export class SettingsComponent {}

