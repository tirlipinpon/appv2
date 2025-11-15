export interface Child {
  id: string;
  parent_id: string;
  firstname: string | null;
  lastname: string | null;
  birthdate: string | null;
  gender: string | null;
  school_level: string | null;
  notes: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChildUpdate {
  firstname?: string | null;
  lastname?: string | null;
  birthdate?: string | null;
  gender?: string | null;
  school_level?: string | null;
  notes?: string | null;
  avatar_url?: string | null;
}

