import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppHeaderComponent, ToastComponent, ScrollToTopComponent } from './shared';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppHeaderComponent, ToastComponent, ScrollToTopComponent],
  templateUrl: './app.html'
})
export class App {
  protected readonly title = signal('appv2');
}
