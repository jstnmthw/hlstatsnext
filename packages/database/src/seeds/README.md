# Database Seeding System

This directory contains a configurable, dynamic seeding system that uses Faker.js to generate realistic test data for the HLStatsNext database.

## Features

- **Configurable**: Easily adjust how many records to create for each model
- **Dynamic**: Uses Faker.js to generate realistic, varied data
- **Relationship-aware**: Maintains proper relationships between clans, players, and games
- **Environment-specific**: Different configurations for development, test, and production
- **Batch processing**: Efficient bulk operations for large datasets
- **Distribution control**: Control how data is distributed across games and clans
- **Realistic game stats**: Game-specific stat profiles (e.g., CS:Source vs Team Fortress)

## Configuration

### Environment-based Configuration

The seeding system automatically selects configuration based on `NODE_ENV`:

- **development**: 20 clans, 500 players (default)
- **test**: 5 clans, 20 players (for fast testing)
- **production**: 50 clans, 2000 players (for realistic datasets)

### Customizing Configuration

Edit `config.ts` to modify the seeding behavior:

```typescript
export const DEFAULT_SEED_CONFIG: SeedConfig = {
  clans: {
    count: 20, // Number of clans to create
    gamesDistribution: {
      css: 0.4, // 40% Counter-Strike: Source
      tf: 0.3, // 30% Team Fortress 2
      tfc: 0.2, // 20% Team Fortress Classic
      csgo: 0.1, // 10% CS:GO
    },
  },
  players: {
    count: 500, // Number of players to create
    clanDistribution: {
      withClan: 0.7, // 70% of players have a clan
      withoutClan: 0.3, // 30% are solo players
    },
    gamesDistribution: {
      css: 0.35, // 35% Counter-Strike: Source
      tf: 0.25, // 25% Team Fortress 2
      tfc: 0.15, // 15% Team Fortress Classic
      csgo: 0.15, // 15% CS:GO
      dods: 0.1, // 10% Day of Defeat: Source
    },
  },
  playerUniqueIds: {
    additionalIdsPerPlayer: 2, // Max additional Steam IDs per player
    multiGamePlayersPercentage: 0.3, // 30% of players play multiple games
  },
};
```

## Game-Specific Statistics

The system generates realistic statistics based on the game type:

### Counter-Strike: Source (`css`)

- Skill range: 800-2000
- K/D ratio: 0.8-2.5
- Headshot percentage: 15%-45%
- Accuracy: 25%-55%

### Team Fortress 2 (`tf`)

- Skill range: 900-1600
- K/D ratio: 0.9-2.0
- Headshot percentage: 5%-25% (lower due to class variety)
- Accuracy: 20%-50%

### Team Fortress Classic (`tfc`)

- Skill range: 950-1700
- K/D ratio: 0.8-2.1
- Headshot percentage: 8%-30%
- Accuracy: 22%-52%

## Usage

### Basic Seeding

```bash
# Use development config (20 clans, 500 players)
pnpm run db:seed

# Use test config (5 clans, 20 players)
NODE_ENV=test pnpm run db:seed

# Use production config (50 clans, 2000 players)
NODE_ENV=production pnpm run db:seed
```

### Custom Environment Variables

You can also set custom values via environment variables:

```bash
CLAN_COUNT=100 PLAYER_COUNT=5000 pnpm run db:seed
```

## Generated Data

### Clans

- **Tag**: Random 2-4 letter clan tags (e.g., `[RED]`, `[FIRE]`)
- **Name**: Realistic company names as clan names
- **Homepage**: Optional clan websites (40% chance)
- **Region**: Distributed across global regions
- **Game**: Distributed according to configuration

### Players

- **Names**: Realistic gaming usernames and full names
- **Email**: Optional email addresses (70% chance)
- **Homepage**: Optional personal websites (30% chance)
- **Location**: Random cities, states, countries with coordinates
- **Stats**: Game-specific realistic kill/death ratios, accuracy, etc.
- **Clan membership**: Distributed according to configuration
- **Activity**: Realistic creation dates and last seen times

### Steam IDs

- **Format**: Valid Steam ID format (`STEAM_0:X:XXXXXXXX`)
- **Cross-game**: Some players have IDs in multiple games
- **Uniqueness**: Each Steam ID + game combination is unique

## File Structure

```
seeds/
├── config.ts              # Configuration system
├── utils.ts               # Faker utilities and game stat profiles
├── clans.ts               # Clan seeding logic
├── players.ts             # Player seeding logic
├── player-unique-ids.ts   # Steam ID seeding logic
├── index.ts               # Exports
└── README.md              # This file
```

## Performance

- **Batch processing**: Operations are batched for optimal database performance
- **Progress tracking**: Real-time progress updates during seeding
- **Memory efficient**: Processes data in chunks to avoid memory issues
- **Transaction safety**: Uses upsert operations to safely re-run seeds

## Example Output

```
🌱 Starting database seeding...
⚙️ Using development configuration:
   Clans: 20
   Players: 500
   Multi-game players: 30%

🏰 Step 1: Seeding clans...
📊 Creating 20 clans distributed across 29 games
✅ Created 20 clans
📈 Clan distribution by game:
   css (Counter-Strike: Source): 8 clans (40%)
   tf (Team Fortress 2): 6 clans (30%)
   tfc (Team Fortress Classic): 4 clans (20%)
   csgo (Counter-Strike: Global Offensive): 2 clans (10%)

👥 Step 2: Seeding players...
📊 Creating 500 players with 20 clans available
🔗 350 players will have clans, 150 will be solo
⚡ Created 100/500 players...
⚡ Created 200/500 players...
⚡ Created 300/500 players...
⚡ Created 400/500 players...
✅ Created 500 players

🆔 Step 3: Seeding player unique IDs...
🎮 Creating Steam IDs for 500 players across 29 games
🔄 150 players will have cross-game Steam IDs
✅ Created 500 primary Steam IDs
🔄 Created 287 additional cross-game Steam IDs
✅ Created 787 total Steam IDs

🎉 Database seeding completed successfully in 12s!

📊 Final database statistics:
   Total clans: 20
   Total players: 500
   Total Steam IDs: 787
```
