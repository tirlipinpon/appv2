import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-signup-landing',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './signup-landing.component.html',
  styleUrl: './signup-landing.component.scss'
})
export class SignupLandingComponent {
  private readonly router = inject(Router);

  goToParentSignup() {
    this.router.navigate(['/signup/parent']);
  }

  goToProfSignup() {
    this.router.navigate(['/signup/prof']);
  }
}
