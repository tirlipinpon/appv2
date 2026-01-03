import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppHeaderComponent, ToastComponent, ScrollToTopComponent, ConfirmationDialogComponent } from './shared';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppHeaderComponent, ToastComponent, ScrollToTopComponent, ConfirmationDialogComponent],
  templateUrl: './app.html'
})
export class App {
  protected readonly title = signal('appv2');
}
