import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-subjects',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="subjects-container">
      <h1>Matières</h1>
      <p>Choisis une matière pour commencer !</p>
    </div>
  `,
  styles: [`
    .subjects-container {
      padding: 2rem;
    }
  `]
})
export class SubjectsComponent {}

