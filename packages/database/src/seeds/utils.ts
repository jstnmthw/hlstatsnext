import { faker } from "@faker-js/faker";

export interface GameStats {
  skill: number;
  kills: number;
  deaths: number;
  headshots: number;
  shots: number;
  hits: number;
  connection_time: number;
}

export interface PlayerData {
  lastName: string;
  fullName?: string;
  email?: string;
  homepage?: string;
  city: string;
  state: string;
  country: string;
  lat: number;
  lng: number;
  last_event: number;
  createdate: number;
}

// Game-specific stat generators
const GAME_STAT_PROFILES = {
  css: {
    // Counter-Strike: Source
    skillRange: [800, 2000],
    killDeathRatio: [0.8, 2.5],
    headshotPercentage: [0.15, 0.45],
    accuracyPercentage: [0.25, 0.55],
  },
  csgo: {
    // Counter-Strike: Global Offensive
    skillRange: [600, 1800],
    killDeathRatio: [0.7, 2.2],
    headshotPercentage: [0.2, 0.5],
    accuracyPercentage: [0.3, 0.6],
  },
  tf: {
    // Team Fortress 2
    skillRange: [900, 1600],
    killDeathRatio: [0.9, 2.0],
    headshotPercentage: [0.05, 0.25], // Lower headshots due to variety of classes
    accuracyPercentage: [0.2, 0.5],
  },
  tfc: {
    // Team Fortress Classic
    skillRange: [950, 1700],
    killDeathRatio: [0.8, 2.1],
    headshotPercentage: [0.08, 0.3],
    accuracyPercentage: [0.22, 0.52],
  },
  dods: {
    // Day of Defeat: Source
    skillRange: [850, 1550],
    killDeathRatio: [0.75, 1.8],
    headshotPercentage: [0.12, 0.35],
    accuracyPercentage: [0.28, 0.48],
  },
} as const;

export function generateGameStats(gameCode: string): GameStats {
  const profile =
    GAME_STAT_PROFILES[gameCode as keyof typeof GAME_STAT_PROFILES] ||
    GAME_STAT_PROFILES.css;

  const skill = faker.number.int({
    min: profile.skillRange[0],
    max: profile.skillRange[1],
  });

  const kills = faker.number.int({ min: 100, max: 5000 });
  const kdRatio = faker.number.float({
    min: profile.killDeathRatio[0],
    max: profile.killDeathRatio[1],
    fractionDigits: 2,
  });
  const deaths = Math.max(1, Math.round(kills / kdRatio));

  const headshotPercentage = faker.number.float({
    min: profile.headshotPercentage[0],
    max: profile.headshotPercentage[1],
    fractionDigits: 3,
  });
  const headshots = Math.round(kills * headshotPercentage);

  const accuracyPercentage = faker.number.float({
    min: profile.accuracyPercentage[0],
    max: profile.accuracyPercentage[1],
    fractionDigits: 3,
  });
  const hits = faker.number.int({ min: kills * 2, max: kills * 8 });
  const shots = Math.round(hits / accuracyPercentage);

  const connection_time = faker.number.int({ min: 3600, max: 500000 }); // 1 hour to ~138 hours

  return {
    skill,
    kills,
    deaths,
    headshots,
    shots,
    hits,
    connection_time,
  };
}

export function generatePlayerData(): PlayerData {
  const firstName = faker.person.firstName();
  const lastName = faker.internet.username();
  const fullName = faker.datatype.boolean()
    ? `${firstName} "${lastName}" ${faker.person.lastName()}`
    : undefined;

  const city = faker.location.city();
  const state = faker.location.state();
  const country = faker.location.country();
  const lat = faker.location.latitude();
  const lng = faker.location.longitude();

  const email = faker.datatype.boolean(0.7)
    ? faker.internet.email()
    : undefined;
  const homepage = faker.datatype.boolean(0.3)
    ? faker.internet.url()
    : undefined;

  const createdate =
    faker.date
      .between({
        from: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
        to: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      })
      .getTime() / 1000;

  const last_event =
    faker.date
      .between({
        from: new Date(createdate * 1000),
        to: new Date(),
      })
      .getTime() / 1000;

  return {
    lastName,
    fullName,
    email,
    homepage,
    city,
    state,
    country,
    lat,
    lng,
    last_event: Math.floor(last_event),
    createdate: Math.floor(createdate),
  };
}

export function generateClanData(): {
  tag: string;
  name: string;
  homepage?: string;
  mapregion: string;
} {
  const tag = `[${faker.string.alpha({ length: { min: 2, max: 4 }, casing: "upper" })}]`;
  const name = faker.company.name();
  const homepage = faker.datatype.boolean(0.4)
    ? faker.internet.url()
    : undefined;

  const regions = [
    "North America",
    "Europe",
    "Asia",
    "South America",
    "Oceania",
    "Africa",
  ];
  const mapregion = faker.helpers.arrayElement(regions);

  return {
    tag,
    name,
    homepage,
    mapregion,
  };
}

export function generateSteamId(): string {
  const universe = 0; // Always 0 for Steam
  const accountType = faker.datatype.boolean() ? 0 : 1; // 0 or 1
  const accountId = faker.number.int({ min: 1000000, max: 999999999 });

  return `STEAM_${universe}:${accountType}:${accountId}`;
}

export function weightedRandomChoice<T>(items: T[], weights: number[]): T {
  if (items.length !== weights.length || items.length === 0) {
    throw new Error(
      "Items and weights arrays must have the same length and not be empty"
    );
  }

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let random = faker.number.float({ min: 0, max: totalWeight });

  for (let i = 0; i < items.length; i++) {
    random -= weights[i]!;
    if (random <= 0) {
      return items[i]!;
    }
  }

  return items[items.length - 1]!; // Fallback
}

export function distributeByPercentages<T>(
  items: T[],
  total: number,
  distribution: Record<string, number>,
  getKey: (item: T) => string
): T[] {
  const result: T[] = [];
  const remainingItems = [...items];

  if (remainingItems.length === 0) {
    return result;
  }

  for (const [key, percentage] of Object.entries(distribution)) {
    const count = Math.round(total * percentage);
    const matchingItems = remainingItems.filter((item) => getKey(item) === key);

    for (let i = 0; i < count && matchingItems.length > 0; i++) {
      const randomIndex = faker.number.int({
        min: 0,
        max: matchingItems.length - 1,
      });
      const randomItem = matchingItems[randomIndex]!; // We know this exists due to length check
      result.push(randomItem);
    }
  }

  // Fill remaining slots with random items
  while (result.length < total && remainingItems.length > 0) {
    const randomIndex = faker.number.int({
      min: 0,
      max: remainingItems.length - 1,
    });
    const randomItem = remainingItems[randomIndex]!; // We know this exists due to length check
    result.push(randomItem);
  }

  return result.slice(0, total);
}
