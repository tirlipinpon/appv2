import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-collection',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="collection-container">
      <h1>Ma Collection</h1>
      <p>Voici tous tes objets débloqués !</p>
    </div>
  `,
  styles: [`
    .collection-container {
      padding: 2rem;
    }
  `]
})
export class CollectionComponent {}

