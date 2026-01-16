import { Injectable, inject } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '@shared/tokens/supabase-client.token';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  // Injection du client Supabase singleton (créé une seule fois dans app.config.ts)
  private readonly supabase = inject(SUPABASE_CLIENT);

  get client(): SupabaseClient {
    return this.supabase;
  }
}
