// Shared mock data for public pages.
// Replace with real GraphQL queries when the API is ready.

export interface MockServer {
  serverId: number
  name: string
  address: string
  port: number
  game: string
  activePlayers: number
  maxPlayers: number
  activeMap: string
  lastEvent: Date | null
  city: string
  country: string
}

export interface MockGame {
  code: string
  name: string
  realgame: string
}

export interface MockPlayer {
  playerId: number
  lastName: string
  skill: number
  kills: number
  deaths: number
  headshots: number
  country: string
  lastEvent: Date | null
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const now = new Date()
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000)

export const MOCK_SERVERS: MockServer[] = [
  {
    serverId: 1,
    name: "Dust2 24/7 | Competitive",
    address: "192.168.1.10",
    port: 27015,
    game: "css",
    activePlayers: 18,
    maxPlayers: 24,
    activeMap: "de_dust2",
    lastEvent: minutesAgo(1),
    city: "Chicago",
    country: "US",
  },
  {
    serverId: 2,
    name: "Office Fun | Casual",
    address: "192.168.1.11",
    port: 27015,
    game: "css",
    activePlayers: 12,
    maxPlayers: 20,
    activeMap: "cs_office",
    lastEvent: minutesAgo(2),
    city: "Dallas",
    country: "US",
  },
  {
    serverId: 3,
    name: "AWP Lego | Sniper Only",
    address: "192.168.1.12",
    port: 27015,
    game: "css",
    activePlayers: 8,
    maxPlayers: 16,
    activeMap: "awp_lego_2",
    lastEvent: minutesAgo(3),
    city: "Frankfurt",
    country: "DE",
  },
  {
    serverId: 4,
    name: "2Fort | 24/7",
    address: "192.168.1.13",
    port: 27015,
    game: "tf",
    activePlayers: 22,
    maxPlayers: 32,
    activeMap: "ctf_2fort",
    lastEvent: minutesAgo(1),
    city: "Los Angeles",
    country: "US",
  },
  {
    serverId: 5,
    name: "Deathmatch FFA",
    address: "192.168.1.14",
    port: 27015,
    game: "csgo",
    activePlayers: 0,
    maxPlayers: 16,
    activeMap: "de_mirage",
    lastEvent: minutesAgo(120),
    city: "London",
    country: "GB",
  },
  {
    serverId: 6,
    name: "Surf Beginners",
    address: "192.168.1.15",
    port: 27015,
    game: "css",
    activePlayers: 6,
    maxPlayers: 24,
    activeMap: "surf_beginner",
    lastEvent: minutesAgo(4),
    city: "Sydney",
    country: "AU",
  },
]

export const MOCK_GAMES: MockGame[] = [
  { code: "css", name: "Counter-Strike: Source", realgame: "Source" },
  { code: "csgo", name: "Counter-Strike: Global Offensive", realgame: "Source" },
  { code: "tf", name: "Team Fortress 2", realgame: "Source" },
  { code: "dod", name: "Day of Defeat: Source", realgame: "Source" },
  { code: "l4d", name: "Left 4 Dead 2", realgame: "Source" },
]

export const MOCK_PLAYERS: MockPlayer[] = [
  {
    playerId: 1,
    lastName: "FragMaster",
    skill: 1842,
    kills: 12450,
    deaths: 4320,
    headshots: 5100,
    country: "US",
    lastEvent: minutesAgo(5),
  },
  {
    playerId: 2,
    lastName: "HeadshotKing",
    skill: 1756,
    kills: 10890,
    deaths: 4100,
    headshots: 6200,
    country: "DE",
    lastEvent: minutesAgo(12),
  },
  {
    playerId: 3,
    lastName: "SniperElite",
    skill: 1698,
    kills: 9200,
    deaths: 3800,
    headshots: 5800,
    country: "SE",
    lastEvent: minutesAgo(20),
  },
  {
    playerId: 4,
    lastName: "RushB",
    skill: 1623,
    kills: 8750,
    deaths: 4500,
    headshots: 3100,
    country: "RU",
    lastEvent: minutesAgo(8),
  },
  {
    playerId: 5,
    lastName: "NadeKing",
    skill: 1580,
    kills: 7600,
    deaths: 3900,
    headshots: 2800,
    country: "PL",
    lastEvent: minutesAgo(45),
  },
  {
    playerId: 6,
    lastName: "Camper_Pro",
    skill: 1510,
    kills: 6800,
    deaths: 3200,
    headshots: 3400,
    country: "BR",
    lastEvent: minutesAgo(60),
  },
  {
    playerId: 7,
    lastName: "FlashBang",
    skill: 1455,
    kills: 6200,
    deaths: 3600,
    headshots: 2500,
    country: "CA",
    lastEvent: minutesAgo(90),
  },
  {
    playerId: 8,
    lastName: "Wallbanger",
    skill: 1398,
    kills: 5500,
    deaths: 3400,
    headshots: 2200,
    country: "FR",
    lastEvent: minutesAgo(180),
  },
  {
    playerId: 9,
    lastName: "OneDeag",
    skill: 1320,
    kills: 4800,
    deaths: 3100,
    headshots: 2900,
    country: "GB",
    lastEvent: minutesAgo(200),
  },
  {
    playerId: 10,
    lastName: "NoScope360",
    skill: 1250,
    kills: 4200,
    deaths: 3500,
    headshots: 1800,
    country: "AU",
    lastEvent: minutesAgo(300),
  },
]

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function getServerById(id: number): MockServer | undefined {
  return MOCK_SERVERS.find((s) => s.serverId === id)
}

export function getGameByCode(code: string): MockGame | undefined {
  return MOCK_GAMES.find((g) => g.code === code)
}

export function getPlayerById(id: number): MockPlayer | undefined {
  return MOCK_PLAYERS.find((p) => p.playerId === id)
}

export function isOnline(lastEvent: Date | null): boolean {
  if (!lastEvent) return false
  const diff = Date.now() - new Date(lastEvent).getTime()
  return diff < 5 * 60_000
}
