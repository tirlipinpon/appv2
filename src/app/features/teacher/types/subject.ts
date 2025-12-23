export interface Subject {
  id: string;
  name: string;
  description: string | null;
  type: 'scolaire' | 'extra' | 'optionnelle';
  default_age_range: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SubjectUpdate {
  name?: string;
  description?: string | null;
  type?: 'scolaire' | 'extra' | 'optionnelle';
  default_age_range?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface SubjectCategory {
  id: string;
  subject_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubjectCategoryCreate {
  subject_id: string;
  name: string;
  description?: string | null;
}

export interface SubjectCategoryUpdate {
  name?: string;
  description?: string | null;
}

