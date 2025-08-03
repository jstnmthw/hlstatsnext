# Player Rankings System - HLStats Daemon

## Overview

The HLStats Daemon implements a sophisticated ELO-based rating system for tracking player skill across Half-Life engine games. This system goes beyond simple kill/death ratios to provide dynamic skill assessments that adapt to player performance over time.

## Core Philosophy

### Skill-Based Progression

- **Dynamic Rating**: Player skill is represented as a numerical rating that changes based on performance
- **Opponent Strength**: Defeating stronger opponents yields more rating points than defeating weaker ones
- **Weapon Difficulty**: Different weapons have different skill multipliers (AWP snipes vs spray weapons)
- **Context Awareness**: Headshots, teamwork, and round outcomes all factor into rating changes

### Fairness & Balance

- **New Player Protection**: Higher volatility for new players allows faster skill discovery
- **Rating Bounds**: Floor (100) and ceiling (3000) prevent extreme values
- **Diminishing Returns**: High-rated players gain/lose points more slowly to maintain stability
- **Anti-Inflation**: System designed to maintain average ratings around 1000

---

## Mathematical Foundation

### Base ELO Formula

The system uses a modified ELO rating system similar to chess but adapted for FPS gameplay:

```
Expected Score (E) = 1 / (1 + 10^((OpponentRating - PlayerRating) / 400))
New Rating = Current Rating + K × (Actual Score - Expected Score)
```

### Key Parameters

| Parameter          | Value | Purpose                             |
| ------------------ | ----- | ----------------------------------- |
| Default Rating     | 1000  | Starting point for new players      |
| K-Factor (Base)    | 32    | Controls rating volatility          |
| Rating Floor       | 100   | Minimum possible rating             |
| Rating Ceiling     | 3000  | Maximum possible rating             |
| Volatility Divisor | 400   | Controls expected score sensitivity |

---

## Rating Adjustments

### Dynamic K-Factor

The K-factor (rating change multiplier) adjusts based on player experience:

```typescript
// New players (0-10 games): K × 1.5 = 48
// Learning players (10-50 games): K × 1.2 = 38.4
// Experienced players (50+ games): K × 1.0 = 32
// Elite players (2000+ rating): K × 0.8 = 25.6
```

**Rationale**: New players need faster rating discovery, while experienced players require stability.

### Weapon Skill Multipliers

Different weapons have different skill requirements and corresponding multipliers:

| Weapon Category  | Multiplier | Examples      | Reasoning                              |
| ---------------- | ---------- | ------------- | -------------------------------------- |
| Precision Rifles | 1.4        | AWP, Scout    | High skill ceiling, one-shot potential |
| Assault Rifles   | 1.0        | AK-47, M4A1   | Balanced weapons, baseline multiplier  |
| SMGs             | 0.9        | MP5, UMP      | Easier spray patterns, close range     |
| Pistols          | 0.8        | Deagle, Glock | Limited damage, situational            |
| Knife/Melee      | 2.0        | Knife         | Extreme difficulty, high risk          |

### Headshot Bonus

Headshot kills receive a 20% bonus multiplier (1.2×) to encourage precision aiming.

---

## Event-Based Rating Changes

### Kill Events

When Player A kills Player B:

1. **Calculate Expected Outcome**:

   ```
   Expected = 1 / (1 + 10^((RatingB - RatingA) / 400))
   ```

2. **Apply Modifiers**:

   ```
   BaseChange = K-Factor × (1 - Expected)
   WeaponModifier = BaseChange × WeaponMultiplier
   HeadshotModifier = WeaponModifier × (Headshot ? 1.2 : 1.0)
   FinalChange = min(HeadshotModifier, 50) // Cap gains at 50
   ```

3. **Update Ratings**:
   ```
   KillerNewRating = clamp(KillerRating + FinalChange, 100, 3000)
   VictimNewRating = clamp(VictimRating - (FinalChange × 0.8), 100, 3000)
   ```

**Note**: Victims lose 80% of what killers gain to create slight rating inflation, encouraging active play.

### Suicide Events

Self-inflicted deaths result in skill penalties:

```typescript
SuicidePenalty = -5 points (flat)
NewRating = max(CurrentRating - 5, 100) // Respect rating floor
```

### Teamkill Events

Team killing carries heavier penalties to discourage griefing:

```typescript
TeamkillPenalty = -10 points (for killer)
VictimCompensation = +2 points (for victim)
```

### Round-Based Adjustments

**Team Victory Bonus**: All players on winning team receive small bonuses based on:

- Round duration (longer rounds = more skill demonstrated)
- Personal contribution (kills, objectives)
- Team coordination metrics

**Participation Reward**: Players who complete rounds without disconnecting receive small bonuses to encourage consistent play.

---

## Special Cases & Edge Conditions

### Bot Interactions

Bot kills/deaths are handled differently based on configuration:

- **logBots = false**: Bot interactions ignored completely
- **logBots = true**: Bot interactions count but with reduced impact (0.5× multiplier)

**Rationale**: Bots provide practice but shouldn't heavily influence competitive ratings.

### New Player Calibration

New players (< 10 games) experience:

- **Accelerated Learning**: 1.5× K-factor for faster skill discovery
- **Wider Rating Bands**: Can gain/lose up to 75 points per game
- **Confidence Building**: Small win bonus to encourage continued play

### High-Rated Player Protection

Players above 2000 rating receive:

- **Reduced Volatility**: 0.8× K-factor for rating stability
- **Elite Matchmaking**: Special consideration for opponent selection
- **Decay Protection**: Ratings decay slowly during inactivity

### Rating Floor Protection

The 100-point floor ensures:

- **No Permanent Damage**: Players can always recover from bad streaks
- **Continued Engagement**: Prevents players from being "locked out" of competitive play
- **Smurf Detection**: Extremely low ratings flag potential new accounts

---

## Confidence & Volatility Tracking

### Confidence Intervals

Each player has a confidence value representing rating uncertainty:

```typescript
interface SkillRating {
  rating: number // Current skill estimate
  confidence: number // Standard deviation (starts at 350)
  volatility: number // Rating change tendency (default 0.06)
  gamesPlayed: number // Total games for experience tracking
}
```

### Confidence Decay

- **High Confidence**: Established players with many games (low standard deviation)
- **Low Confidence**: New or returning players (high standard deviation)
- **Confidence Building**: Decreases with consistent play, increases during inactivity

---

## Implementation Examples

### Example 1: Even Match Kill

```
Player A: 1500 rating, 100 games played
Player B: 1450 rating, 80 games played
Weapon: AK-47 (1.0× multiplier)
Headshot: Yes (1.2× bonus)

Expected = 1 / (1 + 10^((1450-1500)/400)) = 0.57
K-Factor = 32 (both experienced)
BaseChange = 32 × (1 - 0.57) = 13.76
WeaponChange = 13.76 × 1.0 = 13.76
FinalChange = 13.76 × 1.2 = 16.51

Result:
Player A: 1500 + 17 = 1517 (+17)
Player B: 1450 - 14 = 1436 (-14)
```

### Example 2: Upset Victory

```
Player A: 800 rating, 5 games played (new player)
Player B: 1800 rating, 500 games played (veteran)
Weapon: AWP (1.4× multiplier)
Headshot: Yes (1.2× bonus)

Expected = 1 / (1 + 10^((1800-800)/400)) = 0.01
K-Factor A = 32 × 1.5 = 48 (new player)
K-Factor B = 32 × 0.8 = 25.6 (high rated)

BaseChange = 48 × (1 - 0.01) = 47.52
WeaponChange = 47.52 × 1.4 = 66.53
FinalChange = min(66.53 × 1.2, 50) = 50 (capped)

Result:
Player A: 800 + 50 = 850 (+50)
Player B: 1800 - 40 = 1760 (-40)
```

---

## Performance Metrics & Analytics

### Rating Distribution Goals

Target distribution across the player base:

| Rating Range | Percentile | Skill Level  | Description                 |
| ------------ | ---------- | ------------ | --------------------------- |
| 2500+        | Top 1%     | Elite        | Professional/semi-pro level |
| 2000-2499    | Top 5%     | Expert       | Highly skilled veterans     |
| 1500-1999    | Top 25%    | Advanced     | Above average players       |
| 1000-1499    | 25-75%     | Intermediate | Average skill range         |
| 500-999      | Bottom 25% | Novice       | Learning players            |
| 100-499      | Bottom 5%  | Beginner     | New or struggling players   |

### System Health Indicators

Monitor these metrics to ensure rating system health:

- **Average Rating**: Should hover around 1000
- **Rating Inflation**: Monthly change in median rating
- **Volatility Index**: Average rating change per game
- **Confidence Distribution**: Spread of confidence values
- **Participation Rates**: Players by rating bracket

---

## Future Enhancements

### Planned Features

1. **Map-Specific Ratings**: Separate skill tracking per map
2. **Role-Based Adjustments**: Different calculations for AWPers, entry fraggers, etc.
3. **Team Rating**: Clan/team-based ELO calculations
4. **Seasonal Resets**: Periodic soft resets with rank rewards
5. **Machine Learning**: AI-driven skill prediction models

### Advanced Metrics Under Consideration

- **Clutch Performance**: Extra points for 1vN situations
- **Economy Impact**: Rating changes based on round economic value
- **Consistency Index**: Reward for stable performance over streaks
- **Positioning Score**: Map control and tactical positioning factors
- **Communication Bonus**: Team coordination through voice/chat

---

## Technical Implementation Notes

### Database Schema

The rating system integrates with the legacy HLStatsX schema:

```sql
-- Core player rating stored in existing skill column
UPDATE hlstats_Players
SET skill = new_rating,
    skillChange = rating_delta,
    lastSkillChange = GETDATE()
WHERE playerId = ?
```

### Performance Considerations

- **Batch Updates**: Rating calculations processed in batches for efficiency
- **Caching Strategy**: Frequently accessed ratings cached in Redis
- **Historical Tracking**: Rating changes logged for analysis and rollback
- **Concurrent Safety**: Rating updates use database transactions

### Error Handling

- **Rating Bounds**: All calculations respect min/max rating limits
- **Data Validation**: Input sanitization prevents rating manipulation
- **Rollback Capability**: Invalid rating changes can be reverted
- **Audit Trail**: All rating modifications logged with context

---

## Conclusion

The HLStats Daemon rating system provides a sophisticated, fair, and engaging skill assessment mechanism that encourages competitive play while maintaining long-term stability. By combining traditional ELO mathematics with FPS-specific modifications, it creates meaningful progression for players of all skill levels.

Regular monitoring and adjustment ensure the rating system continues to accurately reflect player skill as the game and community evolve.
