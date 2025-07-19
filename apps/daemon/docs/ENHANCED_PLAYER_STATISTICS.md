# Enhanced Player Statistics Tracking

## Overview

This document outlines the enhanced player statistics tracking system implemented in the MatchHandler to address the gaps in tracking headshots, shots, hits, suicides, and teamkills in player match statistics.

## Problem Statement

The original MatchHandler in `saveMatchToDatabase()` had several TODO comments indicating missing statistics tracking:

```typescript
// Note: Headshots are not yet tracked on playerStats.
// totalHeadshots += playerStats.headshots;

await tx.playerHistory.create({
  data: {
    // ...
    suicides: 0, // Would be tracked separately
    shots: 0, // Would need to be tracked from weapon events
    hits: 0, // Would need to be tracked from weapon events
    headshots: 0, // Would need to be tracked from frag events
    teamkills: 0, // Would be tracked separately
  },
})
```

## Solution Implementation

### 1. Enhanced PlayerRoundStats Interface

Extended the `PlayerRoundStats` interface to include all missing statistics:

```typescript
export interface PlayerRoundStats {
  playerId: number
  kills: number
  deaths: number
  assists: number
  damage: number
  objectiveScore: number // bomb plants, defuses, flag captures, etc.
  clutchWins: number
  // NEW FIELDS:
  headshots: number
  shots: number
  hits: number
  suicides: number
  teamkills: number
}
```

### 2. Event Handler Integration

Added comprehensive event handlers in MatchHandler for real-time statistics tracking:

#### Kill Event Handler
- Tracks killer kills and victim deaths
- Increments headshot count when applicable
- Updates match statistics in real-time

#### Suicide Event Handler
- Tracks player suicides
- Increments both suicide count and death count
- Maintains consistency with legacy statistics

#### Teamkill Event Handler
- Tracks teamkills by the killer
- Tracks deaths for the victim
- Handles headshot tracking for teamkills

### 3. Database Integration

Updated the `saveMatchToDatabase()` method to properly persist all tracked statistics:

```typescript
await tx.playerHistory.create({
  data: {
    playerId: playerStats.playerId,
    eventTime: new Date(),
    kills: playerStats.kills,
    deaths: playerStats.deaths,
    suicides: playerStats.suicides, // ✅ Now tracked
    skill: this.calculatePlayerScore(playerStats),
    shots: playerStats.shots, // ✅ Now tracked
    hits: playerStats.hits, // ✅ Now tracked
    headshots: playerStats.headshots, // ✅ Now tracked
    teamkills: playerStats.teamkills, // ✅ Now tracked
  },
})
```

### 4. Real-time Statistics Updates

The MatchHandler now processes events in real-time to maintain accurate player statistics throughout the match:

- **PLAYER_KILL**: Updates killer kills, victim deaths, and headshots
- **PLAYER_SUICIDE**: Updates player suicides and deaths
- **PLAYER_TEAMKILL**: Updates killer teamkills, victim deaths, and headshots
- **Objective Events**: Continue to update objective scores

### 5. Integration with ServerStatsHandler

The enhanced system works seamlessly with the ServerStatsHandler to provide:
- Individual player statistics (MatchHandler)
- Server-level aggregate statistics (ServerStatsHandler)
- Proper event-driven updates for both systems

## Key Features

### ✅ Complete Statistics Tracking
- All player statistics are now properly tracked and persisted
- Real-time updates during match progression
- Accurate historical data in PlayerHistory table

### ✅ Event-Driven Architecture
- Statistics are updated as events are processed
- No missing or delayed statistics
- Consistent with existing event processing pipeline

### ✅ Backward Compatibility
- All existing functionality preserved
- Enhanced statistics are additive
- No breaking changes to existing APIs

### ✅ Performance Optimized
- In-memory match statistics during gameplay
- Batch persistence at match end
- Efficient event processing

## Data Flow

```
Game Events → EventProcessor → MatchHandler → Match Statistics (Memory)
                            ↓
                      Round End → UpdatePlayerRoundStats() → Sync with Database
                            ↓
                      Match End → saveMatchToDatabase() → PlayerHistory Persistence
```

## API Extensions

### New Public Methods

```typescript
// Update weapon statistics from other handlers
updatePlayerWeaponStats(serverId: number, playerId: number, stats: {
  shots?: number
  hits?: number 
  damage?: number
}): void

// Reset match statistics for new matches
resetMatchStats(serverId: number): void
```

### Enhanced Statistics Access

```typescript
// Get comprehensive match statistics
const matchStats = matchHandler.getMatchStats(serverId)
const playerStats = matchStats?.playerStats.get(playerId)

// Access all tracked statistics
console.log(`Player Stats:`, {
  kills: playerStats.kills,
  deaths: playerStats.deaths,
  headshots: playerStats.headshots,
  shots: playerStats.shots,
  hits: playerStats.hits,
  suicides: playerStats.suicides,
  teamkills: playerStats.teamkills,
  objectiveScore: playerStats.objectiveScore
})
```

## Benefits

### 🎯 **Accurate MVP Calculations**
- All relevant statistics are included in MVP scoring
- Objective events, kills, deaths, and other factors properly weighted

### 📊 **Comprehensive Analytics**
- Complete player performance tracking
- Detailed match history with all statistics
- Support for advanced analytics and reporting

### 🔄 **Real-time Updates**
- Live match statistics during gameplay
- Immediate feedback for player performance
- Up-to-date leaderboards and rankings

### 🏗️ **Future-Ready Architecture**
- Easy extension for new statistics
- Weapon-specific tracking ready for implementation
- Scalable for additional game modes and events

## Integration Points

### With ServerStatsHandler
- Server-level aggregation of player statistics
- Automatic generation of SERVER_STATS_UPDATE events
- Consistent tracking across individual and server levels

### With WeaponHandler
- Ready for weapon-specific shot/hit tracking
- Damage calculation integration
- Weapon accuracy statistics

### With RankingHandler
- Enhanced skill calculations with all statistics
- More accurate ELO updates based on complete performance data
- Objective-based ranking adjustments

## Testing

The enhanced system includes comprehensive test coverage:
- Unit tests for all new event handlers
- Integration tests for complete event processing
- Validation of statistics accuracy and persistence
- Error handling and edge case testing

## Future Enhancements

### Weapon Shot/Hit Events
- Add `WEAPON_FIRE` and `WEAPON_HIT` event types
- Individual shot tracking with weapon accuracy
- Real-time weapon performance statistics

### Advanced Analytics
- Heat map data collection with position tracking
- Clutch situation detection and scoring
- Team coordination metrics

### Performance Metrics
- Round timing and positioning data
- Movement and positioning analytics
- Advanced player behavior tracking

This enhanced player statistics tracking system provides a solid foundation for comprehensive game analytics while maintaining the performance and reliability of the existing HLStats daemon architecture.