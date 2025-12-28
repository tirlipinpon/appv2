import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-scroll-to-top',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scroll-to-top.component.html',
  styleUrls: ['./scroll-to-top.component.scss']
})
export class ScrollToTopComponent implements OnInit, OnDestroy {
  readonly showButton = signal<boolean>(false);
  private scrollHandler: (() => void) | null = null;

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      this.scrollHandler = () => {
        const scrollY = window.scrollY || document.documentElement.scrollTop;
        this.showButton.set(scrollY > 300); // Afficher le bouton après 300px de scroll
      };
      window.addEventListener('scroll', this.scrollHandler, { passive: true });
    }
  }

  ngOnDestroy(): void {
    if (this.scrollHandler && typeof window !== 'undefined') {
      window.removeEventListener('scroll', this.scrollHandler);
    }
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

