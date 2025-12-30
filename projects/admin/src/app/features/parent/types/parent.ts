export interface Parent {

  id: string;

  profile_id: string;

  fullname: string | null;

  phone: string | null;

  address: string | null;

  city: string | null;

  country: string | null;

  preferences: Record<string, unknown>;

  avatar_url: string | null;

  created_at: string;

  updated_at: string;

}



export interface ParentUpdate {

  fullname?: string | null;

  phone?: string | null;

  address?: string | null;

  city?: string | null;

  country?: string | null;

  preferences?: Record<string, unknown>;

  avatar_url?: string | null;

}



