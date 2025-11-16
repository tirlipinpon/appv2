import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { SupabaseService } from '../../services/supabase/supabase.service';
import type { PostgrestError } from '@supabase/supabase-js';

export interface SchoolYear {
	id: string;
	school_id: string;
	label: string;
	order_index: number;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

@Injectable({
	providedIn: 'root',
})
export class SchoolYearService {
	private readonly supabaseService = inject(SupabaseService);

	getSchoolYearsBySchool(schoolId: string): Observable<{ schoolYears: SchoolYear[]; error: PostgrestError | null }> {
		return from(
			this.supabaseService.client
				.from('school_years')
				.select('*')
				.eq('school_id', schoolId)
				.eq('is_active', true)
				.order('order_index', { ascending: true })
		).pipe(
			map(({ data, error }) => ({
				schoolYears: (data as SchoolYear[]) || [],
				error: error || null,
			}))
		);
	}
}


