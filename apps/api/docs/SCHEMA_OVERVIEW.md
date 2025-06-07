# GraphQL Schema Overview

This document provides an overview of the complete GraphQL API schema for HLStatsNext.

## Core Entities

### Player

- **Fields**: ID, Steam ID, name, skill, statistics, clan information, location data
- **Relations**: Clan, Country, Game, Awards, History
- **Queries**: `players`, `player`, `topPlayers`, `playerBySteamId`
- **Mutations**: `createPlayer`, `updatePlayerStats`

### Game

- **Fields**: Code, name, hidden status, engine type
- **Relations**: Players, Clans, Servers
- **Queries**: `games`, `game`
- **Mutations**: `updateGame`

### Server

- **Fields**: Address, port, name, game, statistics, location
- **Relations**: Game, Events, Configurations
- **Queries**: `servers`, `server`, `gameServers`
- **Mutations**: `updateServer`

### Clan

- **Fields**: ID, tag, name, homepage, game
- **Relations**: Players, Game
- **Queries**: `clans`, `clan`, `gameClans`
- **Mutations**: `updateClan`

### Country

- **Fields**: Flag code, name
- **Relations**: Players
- **Queries**: `countries`, `country`

## Game Mechanics

### Award

- **Fields**: ID, type, game, code, name, verb, winners
- **Relations**: Players (daily/global winners), PlayerAwards
- **Queries**: `awards`, `award`, `gameAwards`
- **Mutations**: `createAward`, `updateAward`, `deleteAward`

### Action

- **Fields**: ID, game, code, rewards, team, description, flags
- **Relations**: Events (PlayerActions, TeamBonuses)
- **Queries**: `actions`, `action`, `gameActions`
- **Mutations**: `createAction`, `updateAction`, `deleteAction`

### Weapon

- **Fields**: ID, game, code, name, modifier, kills, headshots
- **Computed Fields**: `headshotRatio`, `effectiveness`
- **Queries**: `weapons`, `weapon`, `gameWeapons`, `weaponStatistics`
- **Mutations**: `createWeapon`, `updateWeapon`, `deleteWeapon`

### Role

- **Fields**: ID, game, code, name, hidden, picked, kills, deaths
- **Computed Fields**: `killDeathRatio`
- **Queries**: `roles`, `role`, `gameRoles`, `roleStatistics`
- **Mutations**: `createRole`, `updateRole`, `deleteRole`

### Rank

- **Fields**: ID, image, kill range, rank name, game
- **Queries**: `gameRanks`, `rank`, `playerRank`
- **Mutations**: `createRank`, `updateRank`, `deleteRank`

## Pagination

All list queries support pagination with the following pattern:

```graphql
type PaginatedResult {
  items: [EntityType!]!
  total: Int!
  page: Int!
  totalPages: Int!
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
}
```

## Error Handling

The API follows GraphQL best practices for error handling:

- **Expected errors**: Return as GraphQL errors with specific error codes
- **Unexpected errors**: Automatically masked in production
- **Error codes**: `NOT_FOUND`, `BAD_USER_INPUT`, `UNAUTHORIZED`, `INTERNAL_SERVER_ERROR`

## Input Types

### Filters

Most queries support filtering:

- `game`: Filter by game code
- `page`: Pagination page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

### Mutations

All mutation inputs follow the pattern:

- `CreateInput`: Required fields for creating new entities
- `UpdateInput`: Optional fields for updating existing entities

## Computed Fields

Many entities include computed fields that provide derived statistics:

- Player: `killDeathRatio`, `accuracy`, `headshotRatio`
- Weapon: `headshotRatio`, `effectiveness`
- Role: `killDeathRatio`

## Real-time Features

The schema is prepared for real-time updates through GraphQL subscriptions:

- Live player statistics
- Server status updates
- Game events

## Type Safety

The entire schema is built with TypeScript and Prisma integration:

- Automatic type generation from database schema
- Type-safe resolvers and inputs
- Prisma-generated filters and inputs preferred over custom types

## Health Check

Basic health check query available:

```graphql
query {
  health {
    status
    timestamp
    version
  }
}
```
