import { trigger, transition, style, animate, keyframes, state } from '@angular/animations';

/**
 * Animations pour l'application enfant
 */

// Animation de fade in/out
export const fadeInOut = trigger('fadeInOut', [
  transition(':enter', [
    style({ opacity: 0 }),
    animate('300ms ease-in', style({ opacity: 1 })),
  ]),
  transition(':leave', [
    animate('300ms ease-out', style({ opacity: 0 })),
  ]),
]);

// Animation de slide depuis le bas
export const slideUp = trigger('slideUp', [
  transition(':enter', [
    style({ transform: 'translateY(20px)', opacity: 0 }),
    animate('400ms ease-out', style({ transform: 'translateY(0)', opacity: 1 })),
  ]),
]);

// Animation de bounce pour les succès
export const bounce = trigger('bounce', [
  transition('* => bounce', [
    animate(
      '600ms ease-in-out',
      keyframes([
        style({ transform: 'scale(1)', offset: 0 }),
        style({ transform: 'scale(1.2)', offset: 0.3 }),
        style({ transform: 'scale(0.9)', offset: 0.6 }),
        style({ transform: 'scale(1)', offset: 1 }),
      ])
    ),
  ]),
]);

// Animation de pulse
export const pulse = trigger('pulse', [
  state('normal', style({ transform: 'scale(1)' })),
  state('pulse', style({ transform: 'scale(1.1)' })),
  transition('normal => pulse', [
    animate('300ms ease-in-out'),
  ]),
  transition('pulse => normal', [
    animate('300ms ease-in-out'),
  ]),
]);

// Animation de déblocage (collectible, thème, etc.)
export const unlock = trigger('unlock', [
  transition(':enter', [
    style({ transform: 'scale(0) rotate(0deg)', opacity: 0 }),
    animate(
      '600ms cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      keyframes([
        style({ transform: 'scale(0.5) rotate(180deg)', opacity: 0.5, offset: 0.3 }),
        style({ transform: 'scale(1.2) rotate(360deg)', opacity: 1, offset: 0.7 }),
        style({ transform: 'scale(1) rotate(360deg)', opacity: 1, offset: 1 }),
      ])
    ),
  ]),
]);

// Animation de shake pour les erreurs
export const shake = trigger('shake', [
  transition('* => shake', [
    animate(
      '500ms ease-in-out',
      keyframes([
        style({ transform: 'translateX(0)', offset: 0 }),
        style({ transform: 'translateX(-10px)', offset: 0.1 }),
        style({ transform: 'translateX(10px)', offset: 0.2 }),
        style({ transform: 'translateX(-10px)', offset: 0.3 }),
        style({ transform: 'translateX(10px)', offset: 0.4 }),
        style({ transform: 'translateX(-10px)', offset: 0.5 }),
        style({ transform: 'translateX(10px)', offset: 0.6 }),
        style({ transform: 'translateX(-10px)', offset: 0.7 }),
        style({ transform: 'translateX(10px)', offset: 0.8 }),
        style({ transform: 'translateX(-10px)', offset: 0.9 }),
        style({ transform: 'translateX(0)', offset: 1 }),
      ])
    ),
  ]),
]);

// Animation de star fill (pour les étoiles)
export const starFill = trigger('starFill', [
  transition('empty => filled', [
    style({ transform: 'scale(0)' }),
    animate(
      '400ms cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      keyframes([
        style({ transform: 'scale(1.5)', offset: 0.5 }),
        style({ transform: 'scale(1)', offset: 1 }),
      ])
    ),
  ]),
]);

// Animation de progress bar fill
export const progressFill = trigger('progressFill', [
  transition('* => *', [
    style({ width: '0%' }),
    animate('800ms ease-out'),
  ]),
]);

