export interface ChildSession {
  child_id: string;
  firstname: string | null;
  school_level: string | null;
  parent_id: string;
  school_id: string | null;
  avatar_url: string | null;
  avatar_seed: string | null;
  avatar_style: string | null;
  createdAt: number; // Timestamp de création de la session (millisecondes)
  lastActivity: number; // Timestamp de la dernière activité (millisecondes)
}

