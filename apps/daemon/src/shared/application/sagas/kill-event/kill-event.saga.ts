/**
 * Kill Event Saga
 *
 * Orchestrates the complex multi-module processing required for player kill events.
 * Ensures transactional consistency across player, weapon, match, and ranking modules
 * with proper compensation handling for failures.
 */

import { BaseSaga } from "../saga.base"
import type { SagaStep, SagaContext } from "../saga.types"
import type { BaseEvent } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IEventBus } from "@/shared/infrastructure/event-bus/event-bus.types"
import type { IPlayerService, PlayerKillEvent } from "@/modules/player/player.types"
import type { IWeaponService, WeaponEvent } from "@/modules/weapon/weapon.types"
import type { IMatchService } from "@/modules/match/match.types"
import type { IRankingService, SkillRating } from "@/modules/ranking/ranking.types"
import type { ISagaMonitor } from "../saga.types"
import { EventType } from "@/shared/types/events"

export class KillEventSaga extends BaseSaga {
  readonly name = "KillEventSaga"

  constructor(
    logger: ILogger,
    eventBus: IEventBus,
    private readonly playerService: IPlayerService,
    private readonly weaponService: IWeaponService,
    private readonly matchService: IMatchService,
    private readonly rankingService: IRankingService,
    monitor?: ISagaMonitor,
  ) {
    super(logger, eventBus, monitor)
    this.initializeSteps()
  }

  protected initializeSteps(): void {
    this.steps = [
      new PlayerKillStep(this.playerService, this.logger),
      new WeaponStatsStep(this.weaponService, this.logger),
      new MatchStatsStep(this.matchService, this.logger),
      new RankingUpdateStep(this.rankingService, this.logger),
    ]
  }

  async execute(event: BaseEvent): Promise<void> {
    if (event.eventType !== EventType.PLAYER_KILL) {
      this.logger.warn(`KillEventSaga called with non-kill event: ${event.eventType}`)
      return
    }

    await super.execute(event)
  }
}

/**
 * Step 1: Process player kill statistics and history
 */
export class PlayerKillStep implements SagaStep {
  readonly name = "PlayerKillStep"

  constructor(
    private readonly playerService: IPlayerService,
    private readonly logger: ILogger,
  ) {}

  async execute(context: SagaContext): Promise<void> {
    const event = context.originalEvent as PlayerKillEvent

    // Store the result for potential compensation
    const result = await this.playerService.handleKillEvent(event)
    context.data.playerKillResult = result
    context.data.playerKillProcessed = true

    this.logger.debug("Player kill step completed", {
      eventId: context.eventId,
      killerId: event.data?.killerId,
      victimId: event.data?.victimId,
    })
  }

  async compensate(context: SagaContext): Promise<void> {
    if (!context.data.playerKillProcessed) {
      return
    }

    try {
      const event = context.originalEvent as PlayerKillEvent
      // Implement compensation logic - reverse the kill statistics
      await this.playerService.compensateKillEvent?.(event.data.killerId, event.data.victimId)

      this.logger.debug("Player kill step compensated", {
        eventId: context.eventId,
      })
    } catch (error) {
      this.logger.error("Failed to compensate player kill step", {
        eventId: context.eventId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

/**
 * Step 2: Update weapon statistics
 */
export class WeaponStatsStep implements SagaStep {
  readonly name = "WeaponStatsStep"

  constructor(
    private readonly weaponService: IWeaponService,
    private readonly logger: ILogger,
  ) {}

  async execute(context: SagaContext): Promise<void> {
    const event = context.originalEvent as WeaponEvent

    await this.weaponService.handleWeaponEvent(event)
    context.data.weaponStatsProcessed = true

    this.logger.debug("Weapon stats step completed", {
      eventId: context.eventId,
      weapon:
        (event.data as Record<string, unknown>)?.weaponCode ||
        (event.data as Record<string, unknown>)?.weapon,
    })
  }

  async compensate(context: SagaContext): Promise<void> {
    if (!context.data.weaponStatsProcessed) {
      return
    }

    try {
      const event = context.originalEvent as WeaponEvent
      // Implement compensation logic - reverse weapon statistics
      await this.weaponService.compensateWeaponEvent?.(event.data.weaponCode, event.data.playerId)

      this.logger.debug("Weapon stats step compensated", {
        eventId: context.eventId,
      })
    } catch (error) {
      this.logger.error("Failed to compensate weapon stats step", {
        eventId: context.eventId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

/**
 * Step 3: Update match statistics
 */
export class MatchStatsStep implements SagaStep {
  readonly name = "MatchStatsStep"

  constructor(
    private readonly matchService: IMatchService,
    private readonly logger: ILogger,
  ) {}

  async execute(context: SagaContext): Promise<void> {
    const event = context.originalEvent

    await this.matchService.handleKillInMatch(event)
    context.data.matchStatsProcessed = true

    this.logger.debug("Match stats step completed", {
      eventId: context.eventId,
      serverId: event.serverId,
    })
  }

  async compensate(context: SagaContext): Promise<void> {
    if (!context.data.matchStatsProcessed) {
      return
    }

    try {
      const event = context.originalEvent
      // Implement compensation logic - reverse match statistics
      const killEvent = event as PlayerKillEvent
      await this.matchService.compensateKillInMatch?.(
        event.serverId,
        killEvent.data.killerId,
        killEvent.data.victimId,
      )

      this.logger.debug("Match stats step compensated", {
        eventId: context.eventId,
      })
    } catch (error) {
      this.logger.error("Failed to compensate match stats step", {
        eventId: context.eventId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

/**
 * Step 4: Update player rankings
 */
export class RankingUpdateStep implements SagaStep {
  readonly name = "RankingUpdateStep"

  constructor(
    private readonly rankingService: IRankingService,
    private readonly logger: ILogger,
  ) {}

  async execute(context: SagaContext): Promise<void> {
    // Store current rankings for compensation
    const killEvent = context.originalEvent as PlayerKillEvent
    const playerIds = [killEvent.data.killerId, killEvent.data.victimId]
    const currentRankings = await this.rankingService.getCurrentRankings?.(playerIds)
    context.data.previousRankings = currentRankings

    await this.rankingService.handleRatingUpdate()
    context.data.rankingUpdateProcessed = true

    this.logger.debug("Ranking update step completed", {
      eventId: context.eventId,
    })
  }

  async compensate(context: SagaContext): Promise<void> {
    if (!context.data.rankingUpdateProcessed) {
      return
    }

    try {
      // Implement compensation logic - restore previous rankings
      const previousRankings = context.data.previousRankings as SkillRating[] | undefined
      if (previousRankings) {
        await this.rankingService.restoreRankings?.(previousRankings)
      }

      this.logger.debug("Ranking update step compensated", {
        eventId: context.eventId,
      })
    } catch (error) {
      this.logger.error("Failed to compensate ranking update step", {
        eventId: context.eventId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}
