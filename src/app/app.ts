import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppHeaderComponent } from './shared/components/app-header/app-header.component';
import { ToastComponent } from './shared/components/toast/toast.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppHeaderComponent, ToastComponent],
  templateUrl: './app.html'
})
export class App {
  protected readonly title = signal('appv2');
}
