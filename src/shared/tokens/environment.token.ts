import { InjectionToken } from '@angular/core';

export interface Environment {
  production: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  deepseek?: {
    model?: string;
  };
  deepseekProxy?: {
    url?: string;
  };
  customAuthEnabled?: boolean;
}

export const ENVIRONMENT = new InjectionToken<Environment>('ENVIRONMENT');
