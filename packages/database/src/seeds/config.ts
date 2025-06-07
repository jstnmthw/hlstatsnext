import { merge } from "ts-deepmerge";

export interface SeedConfig {
  clans: {
    count: number;
    maxMembers: number;
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
    multiGamePlayersPercentage: number; // percentage (0-1) of players that play multiple games
  };
  servers: {
    count: number;
  };
  teams: {
    count: number;
  };
  weapons: {
    count: number;
  };
  actions: {
    count: number;
  };
  ranks: {
    count: number;
  };
  awards: {
    count: number;
  };
}

const baseConfig: SeedConfig = {
  clans: {
    count: 20,
    maxMembers: 15,
  },
  players: {
    count: 250,
    clanDistribution: {
      withClan: 0.7, // 70% of players have a clan
      withoutClan: 0.3, // 30% are solo players
    },
  },
  playerUniqueIds: {
    additionalIdsPerPlayer: 2,
    multiGamePlayersPercentage: 0.3, // 30% of players play multiple games
  },
  servers: {
    count: 15,
  },
  teams: {
    count: 10,
  },
  weapons: {
    count: 25,
  },
  actions: {
    count: 30,
  },
  ranks: {
    count: 10,
  },
  awards: {
    count: 50,
  },
};

const productionConfig: Partial<SeedConfig> = {
  clans: {
    count: 5,
    maxMembers: 5,
  },
  players: {
    count: 50,
  },
  servers: {
    count: 5,
  },
};

// Environment-specific configs
export const CONFIGS = {
  development: baseConfig,
  test: {
    ...baseConfig,
    clans: { ...baseConfig.clans, count: 5 },
    players: { ...baseConfig.players, count: 20 },
  },
  production: {
    ...baseConfig,
    clans: { ...baseConfig.clans, count: 50 },
    players: { ...baseConfig.players, count: 2000 },
  },
} as const;

export function getSeedConfig(): SeedConfig {
  const env = process.env.NODE_ENV || "development";
  if (env === "production") {
    return merge(baseConfig, productionConfig) as SeedConfig;
  }
  return CONFIGS[env as keyof typeof CONFIGS] || baseConfig;
}
