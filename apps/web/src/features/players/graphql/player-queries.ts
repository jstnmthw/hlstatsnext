import type { WhereFilter } from "@/features/common/graphql/pagination"
import { graphql } from "@/lib/gql"

// Public leaderboards hide bot players by default. Pass showBots=true (e.g. a
// ?showBots=true URL param) to include them — bots are still tracked and ranked
// when a server's IgnoreBots is off; this only governs the default view.
export function withHumanFilter(
  where: WhereFilter | undefined,
  showBots: boolean,
): WhereFilter | undefined {
  if (showBots) return where
  return { ...(where ?? {}), isBot: { equals: false } }
}

/** Public player listing — must not select PII (no email, lastAddress, etc). */
export const GET_PUBLIC_PLAYERS_WITH_PAGINATION = graphql(`
  query GetPublicPlayersWithPagination(
    $take: Int
    $skip: Int
    $orderBy: [PlayerOrderByWithRelationInput!]
    $where: PlayerWhereInput
  ) {
    findManyPlayer(take: $take, skip: $skip, orderBy: $orderBy, where: $where) {
      playerId
      lastName
      skill
      kills
      deaths
      country
      flag
      lastEvent
      lastSkillChange
    }
  }
`)

export const GET_PUBLIC_PLAYER_COUNT = graphql(`
  query GetPublicPlayerCount($where: PlayerWhereInput) {
    countPlayer(where: $where)
  }
`)
