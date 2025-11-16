import { Injectable, inject } from '@angular/core';
import { TeacherStore } from '../../store/index';
import type { Teacher, TeacherUpdate } from '../../types/teacher';

@Injectable({
  providedIn: 'root',
})
export class Application {
  private readonly store = inject(TeacherStore);

  loadTeacherProfile(): void {
    this.store.loadTeacherProfile();
  }

  updateTeacherProfile(updates: Partial<TeacherUpdate>): void {
    this.store.updateTeacherProfile(updates as TeacherUpdate);
  }

  createTeacherProfile(profileData: Omit<Teacher, 'id' | 'profile_id' | 'created_at' | 'updated_at'>): void {
    this.store.createTeacherProfile(profileData);
  }
}

