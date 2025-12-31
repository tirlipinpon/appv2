export interface Subject {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface SubjectCategory {
  id: string;
  subject_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface SubjectWithCategories extends Subject {
  categories: SubjectCategoryWithProgress[];
}

export interface SubjectCategoryWithProgress extends SubjectCategory {
  progress?: {
    completed: boolean;
    stars_count: number;
    completion_percentage: number;
    last_played_at?: string;
  };
}

