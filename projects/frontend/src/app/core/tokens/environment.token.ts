import { InjectionToken } from '@angular/core';

export interface Environment {
  production: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export const ENVIRONMENT = new InjectionToken<Environment>('ENVIRONMENT');

