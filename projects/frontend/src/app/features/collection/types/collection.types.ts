import { Collectible, ChildCollectible } from '../../../core/types/game.types';

export interface CollectibleWithStatus extends Collectible {
  isUnlocked: boolean;
  unlockedAt?: string;
}

export type CollectionFilter = 'all' | 'unlocked' | 'locked';

