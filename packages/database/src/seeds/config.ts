export interface SeedConfig {
  clans: {
    count: number;
  };
  players: {
    count: number;
    clanDistribution?: {
      withClan: number; // percentage (0-1) of players that should have a clan
      withoutClan: number; // percentage (0-1) of players without clan
    };
  };
  playerUniqueIds: {
    additionalIdsPerPlayer?: number; // how many additional Steam IDs per player (for cross-game play)
    multiGamePlayersPercentage?: number; // percentage (0-1) of players that play multiple games
  };
}

export const DEFAULT_SEED_CONFIG: SeedConfig = {
  clans: {
    count: 20,
  },
  players: {
    count: 500,
    clanDistribution: {
      withClan: 0.7, // 70% of players have a clan
      withoutClan: 0.3, // 30% are solo players
    },
  },
  playerUniqueIds: {
    additionalIdsPerPlayer: 2,
    multiGamePlayersPercentage: 0.3, // 30% of players play multiple games
  },
};

// Environment-specific configs
export const CONFIGS = {
  development: DEFAULT_SEED_CONFIG,
  test: {
    ...DEFAULT_SEED_CONFIG,
    clans: { ...DEFAULT_SEED_CONFIG.clans, count: 5 },
    players: { ...DEFAULT_SEED_CONFIG.players, count: 20 },
  },
  production: {
    ...DEFAULT_SEED_CONFIG,
    clans: { ...DEFAULT_SEED_CONFIG.clans, count: 50 },
    players: { ...DEFAULT_SEED_CONFIG.players, count: 2000 },
  },
} as const;

export function getSeedConfig(): SeedConfig {
  const env = process.env.NODE_ENV || "development";
  return CONFIGS[env as keyof typeof CONFIGS] || DEFAULT_SEED_CONFIG;
}
