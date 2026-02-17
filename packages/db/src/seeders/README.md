# HLStatsNext Database Seeders

This directory contains database seeders for the HLStatsNext application. The seeders generate realistic test data using Faker.js.

## 🎯 **Quick Start**

```bash
# Run all seeders
npm run db:seed

# Run specific seeder
npx tsx packages/db/src/seeds/clans.ts
```

## 📁 **Files Overview**

- **`config.ts`** - Seeding configuration with environment-specific counts
- **`utils.ts`** - Faker.js utilities for generating game data
- **`clans.ts`** - Clan seeding logic
- **`players.ts`** - Player seeding logic
- **`player-unique-ids.ts`** - Steam ID seeding logic
- **`index.ts`** - Main seed orchestrator

## ⚙️ **Configuration**

The seeding configuration is environment-aware:

```typescript
// Development (default)
- 20 clans
- 500 players
- Random game distribution

// Test
- 5 clans
- 20 players

// Production
- 50 clans
- 2000 players
```

### Player Distribution

- **70%** of players have clans
- **30%** are solo players
- **30%** play multiple games (additional Steam IDs)

## 🎮 **Game Selection**

The seeders randomly distribute entities across **all available games** in the database. No complex distribution configuration - simple and effective.

## 🔄 **Seeding Process**

1. **Clans** - Created with realistic names, tags, and random game assignment
2. **Players** - Generated with game-specific stats, location data, and clan membership
3. **Steam IDs** - Additional identifiers for cross-game play simulation

## 📊 **Data Generation**

Uses game-specific stat profiles:

- **Counter-Strike**: Accuracy-focused stats
- **Team Fortress 2**: Team-play oriented stats
- **Default**: Balanced stats for other games

## 🚀 **Performance**

- **Batch processing** (100 entities per batch)
- **Progress tracking** with console output
- **Relationship-aware** (clans before players, players before Steam IDs)

## 🔧 **Customization**

Modify `config.ts` to adjust:

- Entity counts per environment
- Clan membership percentages
- Additional Steam IDs per player

## 📈 **Output Example**

```
🎮 Starting database seeding...
Environment: development
📊 Creating 20 clans randomly distributed across 29 games
✅ Created 20 clans (expected: 20)
📊 Creating 500 players randomly across 29 games with 20 clans available
🔗 350 players will have clans, 150 will be solo
✅ Created 500 players (expected: 500)
🆔 Creating Steam IDs for 500 players (30% multi-game)
✅ Created 500 Steam IDs (expected: 500)
```

The seeders provide complete statistics including game distribution and clan membership breakdowns.
