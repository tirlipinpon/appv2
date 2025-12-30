import { ApplicationConfig, ErrorHandler, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { GlobalErrorHandler, httpErrorInterceptor, ENVIRONMENT, APP_VERSION_TOKEN } from './shared';
import { environment } from '../environments/environment';
import { APP_VERSION } from './core/version';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(
      withInterceptors([httpErrorInterceptor])
    ),
    {
      provide: ErrorHandler,
      useClass: GlobalErrorHandler
    },
    {
      provide: ENVIRONMENT,
      useValue: environment
    },
    {
      provide: APP_VERSION_TOKEN,
      useValue: APP_VERSION
    }
  ]
};
