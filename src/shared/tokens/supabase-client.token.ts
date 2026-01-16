import { InjectionToken } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Token d'injection pour le client Supabase singleton
 * Utilisé pour partager une seule instance de SupabaseClient dans toute l'application
 * et éviter les conflits de lock entre plusieurs instances
 */
export const SUPABASE_CLIENT = new InjectionToken<SupabaseClient>('SUPABASE_CLIENT');
