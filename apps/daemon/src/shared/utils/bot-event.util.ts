/**
 * Bot-involvement detection for IgnoreBots gating.
 */

import type { BaseEvent, PlayerMeta } from "@/shared/types/events"
import { EventType } from "@/shared/types/events"

interface DualPlayerBotMeta {
  killer?: { isBot?: boolean }
  victim?: { isBot?: boolean }
}

// Scoring events carry killer/victim metas; the whole frag is bot-involved if
// either participant is a bot.
const SCORING_EVENTS: ReadonlySet<EventType> = new Set([
  EventType.PLAYER_KILL,
  EventType.PLAYER_DAMAGE,
  EventType.PLAYER_TEAMKILL,
])

// Presence events carry a single player meta.
const PRESENCE_EVENTS: ReadonlySet<EventType> = new Set([
  EventType.PLAYER_CONNECT,
  EventType.PLAYER_DISCONNECT,
  EventType.PLAYER_ENTRY,
])

/**
 * Whether an event references a bot, for IgnoreBots gating. Scoring events
 * (KILL/DAMAGE/TEAMKILL) are bot-involved when either participant is a bot;
 * presence events (CONNECT/DISCONNECT/ENTRY) when the single player is a bot.
 * Any other event type is never gated and returns false.
 */
export function eventInvolvesBot(event: BaseEvent): boolean {
  if (!event.meta || typeof event.meta !== "object") {
    return false
  }

  if (SCORING_EVENTS.has(event.eventType)) {
    const meta = event.meta as DualPlayerBotMeta
    return Boolean(meta.killer?.isBot || meta.victim?.isBot)
  }

  if (PRESENCE_EVENTS.has(event.eventType)) {
    return Boolean((event.meta as PlayerMeta).isBot)
  }

  return false
}
