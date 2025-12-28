import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppHeaderComponent } from './shared/components/app-header/app-header.component';
import { ToastComponent } from './shared/components/toast/toast.component';
import { ScrollToTopComponent } from './shared/components/scroll-to-top/scroll-to-top.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppHeaderComponent, ToastComponent, ScrollToTopComponent],
  templateUrl: './app.html'
})
export class App {
  protected readonly title = signal('appv2');
}
