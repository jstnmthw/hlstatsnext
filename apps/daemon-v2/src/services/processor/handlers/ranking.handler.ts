/**
 * Ranking Event Handler
 *
 * Processes events that affect player rankings and skill ratings,
 * implementing ELO-style rating calculations and leaderboard management.
 */

import type {
  GameEvent,
  PlayerKillEvent,
  RoundEndEvent,
} from "~/types/common/events.types.js";
import type { DatabaseClient } from "~/database/client.js";

export interface SkillRating {
  playerId: number;
  rating: number;
  confidence: number;
  volatility: number;
  gamesPlayed: number;
}

export interface RatingChange {
  playerId: number;
  oldRating: number;
  newRating: number;
  change: number;
  reason: string;
}

export interface HandlerResult {
  success: boolean;
  error?: string;
  ratingChanges?: RatingChange[];
}

export class RankingHandler {
  constructor(private db: DatabaseClient) {}

  private readonly DEFAULT_RATING = 1000;
  private readonly K_FACTOR = 32;
  private readonly RATING_FLOOR = 100;
  private readonly RATING_CEILING = 3000;

  async handleEvent(event: GameEvent): Promise<HandlerResult> {
    switch (event.eventType) {
      case "PLAYER_KILL":
        return this.handleKillRating(event as PlayerKillEvent);

      case "ROUND_END":
        return this.handleRoundRating(event as RoundEndEvent);

      default:
        return { success: true }; // Event not handled by this handler
    }
  }

  private async handleKillRating(
    event: PlayerKillEvent
  ): Promise<HandlerResult> {
    const { killerId, victimId, headshot, weapon } = event.data;

    try {
      // TODO: Get current ratings from database
      const killerRating = await this.getPlayerRating(killerId);
      const victimRating = await this.getPlayerRating(victimId);

      // Calculate rating changes for kill/death
      const changes = this.calculateKillRatingChange(
        killerRating,
        victimRating,
        { headshot, weapon }
      );

      console.log(
        `Rating change for kill: Killer ${killerId} (+${changes.killer}), Victim ${victimId} (${changes.victim})`
      );

      return {
        success: true,
        ratingChanges: [
          {
            playerId: killerId,
            oldRating: killerRating.rating,
            newRating: killerRating.rating + changes.killer,
            change: changes.killer,
            reason: `Kill with ${weapon}${headshot ? " (headshot)" : ""}`,
          },
          {
            playerId: victimId,
            oldRating: victimRating.rating,
            newRating: victimRating.rating + changes.victim,
            change: changes.victim,
            reason: `Death to ${weapon}${headshot ? " (headshot)" : ""}`,
          },
        ],
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Rating calculation error",
      };
    }
  }

  private async handleRoundRating(
    event: RoundEndEvent
  ): Promise<HandlerResult> {
    const { winningTeam, duration } = event.data;
    const serverId = event.serverId;

    try {
      // TODO: Get all players who participated in the round
      // TODO: Calculate team-based rating adjustments
      // TODO: Apply bonus for round participation

      console.log(
        `Round rating update for server ${serverId}: ${winningTeam} team won (${duration}s)`
      );

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Round rating error",
      };
    }
  }

  private calculateKillRatingChange(
    killer: SkillRating,
    victim: SkillRating,
    context: { headshot: boolean; weapon: string }
  ): { killer: number; victim: number } {
    // Expected probability of killer winning
    const expectedKiller =
      1 / (1 + Math.pow(10, (victim.rating - killer.rating) / 400));

    // Base K-factor adjusted by confidence and game experience
    const killerK = this.getAdjustedKFactor(killer);
    const victimK = this.getAdjustedKFactor(victim);

    // Weapon and headshot modifiers
    const weaponMultiplier = this.getWeaponSkillMultiplier(context.weapon);
    const headshotBonus = context.headshot ? 1.2 : 1.0;

    // Calculate rating changes
    const killerChange = Math.round(
      killerK * (1 - expectedKiller) * weaponMultiplier * headshotBonus
    );
    const victimChange = Math.round(victimK * (0 - (1 - expectedKiller)) * 0.8); // Smaller penalty

    return {
      killer: Math.min(killerChange, 50), // Cap gains
      victim: Math.max(victimChange, -40), // Cap losses
    };
  }

  private getAdjustedKFactor(player: SkillRating): number {
    // Higher K-factor for new players (less confidence)
    if (player.gamesPlayed < 10) return this.K_FACTOR * 1.5;
    if (player.gamesPlayed < 50) return this.K_FACTOR * 1.2;
    if (player.rating > 2000) return this.K_FACTOR * 0.8; // Slower changes for high-rated players

    return this.K_FACTOR;
  }

  private getWeaponSkillMultiplier(weapon: string): number {
    // Skill-based weapon multipliers
    const skillWeapons: Record<string, number> = {
      awp: 1.3, // Sniper rifles require more skill
      deagle: 1.2, // High-skill pistol
      ak47: 1.1, // Slightly higher skill rifle
      m4a1: 1.0, // Standard rifle
      knife: 1.5, // Melee kills are impressive
      grenade: 1.3, // Grenade kills require timing
      glock: 0.9, // Lower skill weapons
      p90: 0.8, // "Spray and pray" weapons
    };

    return skillWeapons[weapon.toLowerCase()] || 1.0;
  }

  private async getPlayerRating(playerId: number): Promise<SkillRating> {
    // TODO: Fetch from database, implement caching
    // For now, return default rating
    return {
      playerId,
      rating: this.DEFAULT_RATING,
      confidence: 350, // Standard deviation
      volatility: 0.06,
      gamesPlayed: 0,
    };
  }

  private clampRating(rating: number): number {
    return Math.max(this.RATING_FLOOR, Math.min(this.RATING_CEILING, rating));
  }

  /**
   * Calculate expected match outcome between two players
   */
  public calculateExpectedScore(ratingA: number, ratingB: number): number {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  }

  /**
   * Update player rating based on match outcome
   */
  public async updatePlayerRating(
    playerId: number,
    actualScore: number,
    expectedScore: number
  ): Promise<SkillRating> {
    const currentRating = await this.getPlayerRating(playerId);
    const kFactor = this.getAdjustedKFactor(currentRating);

    const newRating = this.clampRating(
      currentRating.rating + kFactor * (actualScore - expectedScore)
    );

    return {
      ...currentRating,
      rating: newRating,
      gamesPlayed: currentRating.gamesPlayed + 1,
    };
  }
}
