import { Component, signal, ChangeDetectionStrategy, OnDestroy, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SessionStarService } from './core/services/session-star/session-star.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App implements OnDestroy {
  protected readonly title = signal('frontend');
  private readonly sessionStarService = inject(SessionStarService);

  ngOnDestroy(): void {
    // Nettoyer le setInterval de clignotement des étoiles à la fin de la session
    this.sessionStarService.stopBlinking();
  }
}
