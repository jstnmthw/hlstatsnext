// Public: the server list and the homepage widget. The API already strips
// credentials from these fields, so nothing here needs a session.
import "server-only"

import {
  buildCountVariables,
  buildPaginationVariables,
  type PaginationParams,
} from "@/features/common/graphql/pagination"
import { query } from "@/lib/apollo-client"
import { graphql } from "@/lib/gql"
import { SortOrder } from "@/lib/gql/graphql"
import type { PublicServerItem } from "@/lib/servers"

const publicServersWithPagination = graphql(`
  query GetPublicServersWithPagination(
    $take: Int
    $skip: Int
    $orderBy: [ServerOrderByWithRelationInput!]
    $where: ServerWhereInput
  ) {
    findManyServer(take: $take, skip: $skip, orderBy: $orderBy, where: $where) {
      serverId
      name
      address
      port
      game
      activePlayers
      maxPlayers
      activeMap
      lastEvent
      city
      country
    }
  }
`)

const publicServerCount = graphql(`
  query GetPublicServerCount($where: ServerWhereInput) {
    countServer(where: $where)
  }
`)

const searchFields = ["name", "address", "game"]

export interface PublicServerPage {
  servers: PublicServerItem[]
  totalCount: number
}

export async function listPublicServers(params: PaginationParams): Promise<PublicServerPage> {
  const variables = buildPaginationVariables(params, searchFields)
  // A secondary sort by name keeps servers with equal player counts in a stable order.
  variables.orderBy?.push({ name: "asc" })

  const [{ data }, { data: countData }] = await Promise.all([
    query({ query: publicServersWithPagination, variables }),
    query({ query: publicServerCount, variables: buildCountVariables(params, searchFields) }),
  ])

  return { servers: data?.findManyServer ?? [], totalCount: countData?.countServer ?? 0 }
}

export async function recentServers(limit: number): Promise<PublicServerItem[]> {
  const { data } = await query({
    query: publicServersWithPagination,
    variables: { take: limit, orderBy: [{ activePlayers: SortOrder.Desc }] },
  })
  return data?.findManyServer ?? []
}
