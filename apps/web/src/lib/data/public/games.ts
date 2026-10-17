// Public: the games index. Hidden games are filtered out by the query itself.
import "server-only"

import { query } from "@/lib/apollo-client"
import type { PublicGame } from "@/lib/games"
import { graphql } from "@/lib/gql"

const publicGames = graphql(`
  query GetPublicGames {
    findManyGame(where: { hidden: { equals: "0" } }) {
      code
      name
      realgame
    }
  }
`)

export async function listPublicGames(): Promise<PublicGame[]> {
  const { data } = await query({ query: publicGames })
  return data?.findManyGame ?? []
}
