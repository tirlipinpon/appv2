export interface Teacher {
  id: string;
  profile_id: string;
  fullname: string | null;
  bio: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeacherUpdate {
  fullname?: string | null;
  bio?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
}

