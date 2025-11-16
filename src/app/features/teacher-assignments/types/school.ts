export interface School {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SchoolUpdate {
  name?: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface SchoolYear {
  id: string;
  school_id: string;
  label: string;
  order_index: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SchoolYearUpdate {
  label?: string;
  order_index?: number | null;
  is_active?: boolean;
}


