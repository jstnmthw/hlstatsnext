// Public: the homepage statistics card.
import "server-only"

import { query } from "@/lib/apollo-client"
import { graphql } from "@/lib/gql"
import type { GeneralStats } from "@/lib/stats"

const generalStatsQuery = graphql(`
  query GetGeneralStats {
    countPlayer
    countClan
    countGame
    countServer
    getTotalKills
    findFirstEventFrag(orderBy: [{ eventTime: desc }]) {
      eventTime
    }
    findUniqueOption(where: { keyname: "DeleteDays" }) {
      value
    }
  }
`)

export async function generalStats(): Promise<GeneralStats> {
  const { data } = await query({ query: generalStatsQuery })
  return {
    players: data?.countPlayer ?? 0,
    clans: data?.countClan ?? 0,
    games: data?.countGame ?? 0,
    servers: data?.countServer ?? 0,
    totalKills: data?.getTotalKills ?? 0,
    lastKillTime: (data?.findFirstEventFrag?.eventTime as string | null | undefined) ?? null,
    deleteDays: data?.findUniqueOption?.value ?? "N/A",
  }
}
