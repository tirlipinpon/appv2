export interface GameType {
  id: string;
  name: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  icon?: string | null;
  color_code?: string | null;
  created_at: string;
  updated_at: string;
}

