import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { TeacherService } from '../../services/teacher/teacher.service';
import type { Teacher, TeacherUpdate } from '../../types/teacher';
import type { PostgrestError } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class Infrastructure {
  private readonly teacherService = inject(TeacherService);

  getTeacherProfile(): Observable<Teacher | null> {
    return this.teacherService.getTeacherProfile();
  }

  updateTeacherProfile(updates: TeacherUpdate): Observable<{ teacher: Teacher | null; error: PostgrestError | null }> {
    return this.teacherService.updateTeacherProfile(updates);
  }

  createTeacherProfile(profileData: Omit<Teacher, 'id' | 'profile_id' | 'created_at' | 'updated_at'>): Observable<{ teacher: Teacher | null; error: PostgrestError | null }> {
    return this.teacherService.createTeacherProfile(profileData);
  }
}

