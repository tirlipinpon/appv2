import { Injectable, inject } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ENVIRONMENT } from '@shared/tokens/environment.token';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private readonly environment = inject(ENVIRONMENT, { optional: true });
  private supabase: SupabaseClient;

  constructor() {
    if (!this.environment) {
      throw new Error('ENVIRONMENT token must be provided. Please provide it in your app.config.ts');
    }
    this.supabase = createClient(this.environment.supabaseUrl, this.environment.supabaseAnonKey);
  }

  get client(): SupabaseClient {
    return this.supabase;
  }
}
