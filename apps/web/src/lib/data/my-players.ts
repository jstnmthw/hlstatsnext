import "server-only"

import { getClient, query } from "@/lib/apollo-client"
import type { MutationOutcome } from "@/lib/data/outcome"
import { graphql } from "@/lib/gql"
import type { MyPlayer, MyPlayerPreferences, MyPlayersOverview } from "@/lib/my-players"
import { claimPlayersBySteamId } from "@repo/auth/claims"
import { getAuth } from "@repo/auth/server"
import { requireAuth, requirePermission } from "@repo/auth/session"
import { headers } from "next/headers"

const myPlayersQuery = graphql(`
  query MyPlayers {
    myPlayers {
      playerId
      lastName
      game
      skill
      kills
      deaths
      lastEvent
      hideRanking
      displayEvents
      blockAvatar
    }
  }
`)

const updateMyPlayerMutation = graphql(`
  mutation UpdateMyPlayer($playerId: Int!, $data: UpdateMyPlayerInput!) {
    updateMyPlayer(playerId: $playerId, data: $data) {
      playerId
      hideRanking
      displayEvents
      blockAvatar
    }
  }
`)

export async function myPlayers(): Promise<MyPlayersOverview> {
  const session = await requireAuth()

  const accounts = await getAuth().api.listUserAccounts({ headers: await headers() })
  const steam = accounts.find((account) => account.providerId === "steam")
  // Opening the page claims again, so players from games played since the
  // Steam link appear without another sign-in.
  if (steam) {
    await claimPlayersBySteamId(session.user.id, steam.accountId)
  }

  const { data } = await query({ query: myPlayersQuery, fetchPolicy: "network-only" })
  // Every field is nullable in the schema, as Pothos defaults to; a player
  // without an id cannot be shown or updated, so it is dropped.
  const players: MyPlayer[] = (data?.myPlayers ?? []).flatMap((player) =>
    player.playerId == null
      ? []
      : [
          {
            playerId: player.playerId,
            lastName: player.lastName ?? "",
            game: player.game ?? "",
            skill: player.skill ?? 0,
            kills: player.kills ?? 0,
            deaths: player.deaths ?? 0,
            lastEvent: (player.lastEvent as string | null | undefined) ?? null,
            hideRanking: player.hideRanking === 1,
            displayEvents: player.displayEvents === 1,
            blockAvatar: player.blockAvatar === 1,
          },
        ],
  )

  return { players, steamLinked: steam !== undefined }
}

export async function updateMyPlayer(
  playerId: number,
  preferences: MyPlayerPreferences,
): Promise<MutationOutcome> {
  await requirePermission({ player: ["update-own"] })

  const result = await getClient().mutate({
    mutation: updateMyPlayerMutation,
    variables: { playerId, data: preferences },
  })
  return { ok: Boolean(result.data?.updateMyPlayer), message: null }
}
