export interface School {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  created_at: string;
  updated_at: string;
}

export interface SchoolCreate {
  name: string;
  address?: string | null;
  city?: string | null;
}

