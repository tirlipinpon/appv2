import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-star-rating',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <div class="star-rating">
      @for (star of starsArray(); track $index; let i = $index) {
        <span
          class="star"
          [class.filled]="i < rating()"
          [class.half]="i === rating() - 0.5">
          ★
        </span>
      }
      @if (showText()) {
        <span class="rating-text">
          {{ rating() }}/{{ maxStars() }}
        </span>
      }
    </div>
  `,
  styles: [`
    .star-rating {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }

    .star {
      font-size: 1.5rem;
      color: var(--theme-empty-star-color, #e0e0e0);
      transition: all 0.2s ease;
      display: inline-block;
    }

    .star.filled {
      color: var(--theme-star-color, #FFD700);
      text-shadow: 0 0 4px rgba(255, 215, 0, 0.5);
    }

    .star.half {
      background: linear-gradient(
        90deg,
        var(--theme-star-color, #FFD700) 50%,
        var(--theme-empty-star-color, #e0e0e0) 50%
      );
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .rating-text {
      margin-left: 0.5rem;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--theme-text-color, #333);
    }
  `]
})
export class StarRatingComponent {
  rating = input<number>(0);
  maxStars = input<number>(3);
  showText = input<boolean>(false);

  starsArray = computed(() => {
    return Array(this.maxStars()).fill(0);
  });
}

