/**
 * Database Test Fixtures
 * 
 * Provides test data seeding and cleanup utilities.
 */

// Mock test data using generic types to avoid import issues
export const testPlayers = [
  {
    playerId: 1,
    lastName: 'TestPlayer1',
    game: 'csgo',
    skill: 1000,
    kills: 0,
    deaths: 0,
    suicides: 0,
    teamkills: 0,
    headshots: 0,
    shots: 0,
    hits: 0,
    kill_streak: 0,
    death_streak: 0,
    connection_time: 0,
    hideranking: 0,
    last_event: Math.floor(Date.now() / 1000),
  },
  {
    playerId: 2,
    lastName: 'TestPlayer2',
    game: 'csgo',
    skill: 1200,
    kills: 10,
    deaths: 5,
    suicides: 0,
    teamkills: 0,
    headshots: 3,
    shots: 50,
    hits: 25,
    kill_streak: 3,
    death_streak: 0,
    connection_time: 3600,
    hideranking: 0,
    last_event: Math.floor(Date.now() / 1000),
  },
]

export const testServers = [
  {
    serverId: 1,
    name: 'Test Server 1',
    address: '127.0.0.1',
    port: 27015,
    game: 'csgo',
    players: 0,
    max_players: 32,
    status: 1,
  },
]

export const testEvents = [
  {
    id: 1,
    serverId: 1,
    playerId: 1,
    eventType: 'player_connect',
    eventTime: new Date(),
    data: JSON.stringify({
      playerId: 1,
      steamId: '12345678901234567',
      playerName: 'TestPlayer1',
      ipAddress: '127.0.0.1:27005',
    }),
  },
]

/**
 * Seeds the test database with initial data
 */
export async function seedTestDatabase(): Promise<void> {
  // In a real implementation, this would use the actual database client
  // For now, this is a placeholder that would be implemented with actual Prisma operations
  console.log('Seeding test database with mock data')
}

/**
 * Cleans up the test database
 */
export async function cleanupDatabase(): Promise<void> {
  // In a real implementation, this would clean up the actual database
  // For now, this is a placeholder
  console.log('Cleaning up test database')
}