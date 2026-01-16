import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection, inject } from '@angular/core';
import { provideRouter, PreloadAllModules, withPreloading } from '@angular/router';
import { createClient } from '@supabase/supabase-js';

import { routes } from './app.routes';
import { ENVIRONMENT } from '@shared/tokens/environment.token';
import { SUPABASE_CLIENT } from '@shared/tokens/supabase-client.token';
import { environment } from '../environments/environment';
import type { Environment } from '@shared/tokens/environment.token';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withPreloading(PreloadAllModules) // Preload all lazy-loaded modules
    ),
    {
      provide: ENVIRONMENT,
      useValue: environment
    },
    {
      provide: SUPABASE_CLIENT,
      useFactory: () => {
        const env = inject<Environment>(ENVIRONMENT);
        if (!env?.supabaseUrl || !env?.supabaseAnonKey) {
          throw new Error('Configuration Supabase manquante. Vérifiez que ENVIRONMENT est fourni avec supabaseUrl et supabaseAnonKey.');
        }
        return createClient(env.supabaseUrl, env.supabaseAnonKey);
      },
      deps: [ENVIRONMENT]
    }
  ]
};
