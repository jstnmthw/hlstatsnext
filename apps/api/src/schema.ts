export const typeDefs = /* GraphQL */ `
  type Query {
    hello: String!
    health: HealthStatus!

    # Game queries
    games(includeHidden: Boolean): [Game!]!
    game(id: ID!): Game
    gameByCode(code: String!): Game
    gameStats(gameId: ID!): GameStats

    # Player queries
    players(
      filters: PlayerFilters
      sort: PlayerSortInput
      pagination: PaginationInput
    ): PlayerConnection!
    player(id: ID!): Player
    playerBySteamId(steamId: String!, gameId: ID): Player
    playerStats(playerId: ID!): PlayerStats
    topPlayers(gameId: ID!, limit: Int): [Player!]!

    # Clan queries
    clans(filters: ClanFilters): [Clan!]!
    clan(id: ID!): Clan
    clanStats(clanId: ID!): ClanStats
    topClans(gameId: ID!, limit: Int): [ClanWithAvgSkill!]!

    # Country queries
    countries: [Country!]!
    country(id: ID!): Country
  }

  type Mutation {
    # Player mutations
    createPlayer(input: CreatePlayerInput!): Player!
    updatePlayerStats(input: UpdatePlayerStatsInput!): Player
  }

  # Subscription support for real-time updates
  type Subscription {
    playerUpdated(gameId: ID!): Player!
    gameStatsUpdated(gameId: ID!): GameStats!
  }

  # Core Types
  type Game {
    id: ID!
    code: String!
    name: String!
    realGame: String!
    hidden: Boolean!
    legacyCode: String
    playerCount: Int!
    clanCount: Int!
    createdAt: String!
    updatedAt: String!
  }

  type Country {
    id: ID!
    code: String!
    name: String!
    createdAt: String!
    updatedAt: String!
  }

  type Clan {
    id: ID!
    tag: String!
    name: String!
    homepage: String
    game: Game!
    hidden: Boolean!
    mapRegion: String
    players: [Player!]!
    playerCount: Int!
    legacyId: Int
    createdAt: String!
    updatedAt: String!
  }

  type Player {
    id: ID!
    lastName: String!
    fullName: String
    email: String
    homepage: String
    game: Game!
    country: Country
    clan: Clan
    lastAddress: String
    city: String
    state: String
    latitude: Float
    longitude: Float
    skill: Int!
    kills: Int!
    deaths: Int!
    suicides: Int!
    shots: Int!
    hits: Int!
    headshots: Int!
    teamkills: Int!
    killStreak: Int!
    deathStreak: Int!
    activity: Int!
    hideRanking: Boolean!
    displayEvents: Boolean!
    blockAvatar: Boolean!
    connectionTime: Int!
    lastEvent: Int!
    lastSkillChange: Int!
    icq: Int
    mmrank: Int
    uniqueIds: [PlayerUniqueId!]!
    legacyId: Int
    createdAt: String!
    updatedAt: String!

    # Computed fields (calculated by resolvers)
    killDeathRatio: Float!
    accuracy: Float!
    headshotRatio: Float!
  }

  type PlayerUniqueId {
    id: ID!
    uniqueId: String!
    gameId: String!
    mergeId: String
    legacyPlayerId: Int
    createdAt: String!
    updatedAt: String!
  }

  # Statistics Types
  type GameStats {
    totalPlayers: Int!
    activePlayers: Int!
    totalKills: Int!
    totalDeaths: Int!
    averageSkill: Int!
    topPlayers: [Player!]!
  }

  type PlayerStats {
    player: Player!
    killDeathRatio: Float!
    accuracy: Float!
    headshotRatio: Float!
    rank: Int
  }

  type ClanStats {
    clan: Clan!
    totalKills: Int!
    totalDeaths: Int!
    averageSkill: Int!
    topPlayer: Player
    killDeathRatio: Float!
  }

  type ClanWithAvgSkill {
    id: ID!
    tag: String!
    name: String!
    homepage: String
    game: Game!
    hidden: Boolean!
    mapRegion: String
    players: [Player!]!
    playerCount: Int!
    averageSkill: Int!
    legacyId: Int
    createdAt: String!
    updatedAt: String!
  }

  # Connection Type for Pagination
  type PlayerConnection {
    players: [Player!]!
    total: Int!
    page: Int!
    totalPages: Int!
  }

  # Input Types
  input PlayerFilters {
    gameId: ID
    clanId: ID
    countryId: ID
    hideRanking: Boolean
    minSkill: Int
    maxSkill: Int
    minKills: Int
    search: String
  }

  input PlayerSortInput {
    field: PlayerSortField!
    direction: SortDirection!
  }

  input PaginationInput {
    page: Int
    limit: Int
  }

  input ClanFilters {
    gameId: ID
    hidden: Boolean
    search: String
  }

  input CreatePlayerInput {
    lastName: String!
    steamId: String!
    gameId: ID!
    fullName: String
    email: String
    homepage: String
    clanId: ID
    countryId: ID
    city: String
    state: String
    lastAddress: String
  }

  input UpdatePlayerStatsInput {
    steamId: String!
    gameId: ID!
    kills: Int
    deaths: Int
    suicides: Int
    shots: Int
    hits: Int
    headshots: Int
    teamkills: Int
    skill: Int
    connectionTime: Int
    lastEvent: Int
  }

  # Enums
  enum PlayerSortField {
    SKILL
    KILLS
    DEATHS
    HEADSHOTS
    CONNECTION_TIME
    CREATED_AT
  }

  enum SortDirection {
    ASC
    DESC
  }

  type HealthStatus {
    status: String!
    timestamp: String!
    version: String!
  }
`;
