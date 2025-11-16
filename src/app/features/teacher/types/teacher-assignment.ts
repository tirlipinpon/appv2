export interface TeacherAssignment {
  id: string;
  teacher_id: string;
  school_id: string | null;
  school_year_id: string | null;
  school_level: string | null;
  class_id: string | null;
  subject_id: string;
  roles: string[];
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeacherAssignmentCreate {
  teacher_id: string;
  school_id?: string | null;
  school_level?: string | null;
  class_id?: string | null;
  subject_id: string;
  roles?: string[];
  start_date?: string | null;
  end_date?: string | null;
}

export interface TeacherAssignmentUpdate {
  school_id?: string | null;
  school_year_id?: string | null;
  school_level?: string | null;
  class_id?: string | null;
  subject_id?: string;
  roles?: string[];
  start_date?: string | null;
  end_date?: string | null;
}

