import "server-only"

import {
  buildCountVariables,
  buildPaginationVariables,
  type FilterTransform,
  type PaginationParams,
} from "@/features/common/graphql/pagination"
import { getClient, query } from "@/lib/apollo-client"
import type { MutationOutcome } from "@/lib/data/outcome"
import { graphql } from "@/lib/gql"
import type { CreateServerInput, UpdateServerInput } from "@/lib/gql/graphql"
import type { ModOption, ServerForEdit, ServerListItem } from "@/lib/servers"
import { requireAdmin, requirePermission } from "@repo/auth/session"

const serversWithPagination = graphql(`
  query GetServersWithPagination(
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

const serverCount = graphql(`
  query GetServerCount($where: ServerWhereInput) {
    countServer(where: $where)
  }
`)

const serverById = graphql(`
  query GetServerByIdWithConfigs($serverId: Int!) {
    findUniqueServer(where: { serverId: $serverId }) {
      serverId
      name
      address
      port
      game
      publicAddress
      rconAddress
      statusUrl
      sortOrder
      configs {
        parameter
        value
      }
      authToken {
        tokenPrefix
        name
      }
    }
  }
`)

const modsForSelect = graphql(`
  query GetModsForSelect {
    findManyModSupported {
      code
      name
    }
  }
`)

const createServerWithConfig = graphql(`
  mutation CreateServerWithConfig($data: CreateServerInput!) {
    createServerWithConfig(data: $data) {
      success
      message
      configsCount
      server {
        serverId
        name
        address
        port
        game
        publicAddress
        rconAddress
        statusUrl
        sortOrder
      }
    }
  }
`)

const updateServerWithConfig = graphql(`
  mutation UpdateServerWithConfig($serverId: Int!, $data: UpdateServerInput!) {
    updateServerWithConfig(serverId: $serverId, data: $data) {
      success
      message
      configsCount
      server {
        serverId
        name
        address
        port
        game
        publicAddress
        rconAddress
        statusUrl
        sortOrder
      }
    }
  }
`)

const searchFields = ["name", "address", "game"]

const filterTransforms: Record<string, FilterTransform> = {
  status: (values) => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000)
    const wantOnline = values.includes("online")
    const wantOffline = values.includes("offline")

    if (wantOnline && !wantOffline) {
      return { lastEvent: { gt: thirtyMinAgo } }
    }
    if (wantOffline && !wantOnline) {
      return {
        OR: [{ lastEvent: { lt: thirtyMinAgo } }, { lastEvent: null }],
      }
    }
    return undefined // both selected = no filter
  },
}

export interface ServerPage {
  servers: ServerListItem[]
  totalCount: number
}

export async function listServers(params: PaginationParams): Promise<ServerPage> {
  await requireAdmin()

  const [{ data }, { data: countData }] = await Promise.all([
    query({
      query: serversWithPagination,
      variables: buildPaginationVariables(params, searchFields, filterTransforms),
    }),
    query({
      query: serverCount,
      variables: buildCountVariables(params, searchFields, filterTransforms),
    }),
  ])

  return { servers: data?.findManyServer ?? [], totalCount: countData?.countServer ?? 0 }
}

export async function getServerForEdit(serverId: number): Promise<ServerForEdit | null> {
  await requireAdmin()

  const { data } = await query({ query: serverById, variables: { serverId } })
  const server = data?.findUniqueServer
  if (!server) return null

  return {
    serverId: Number(server.serverId),
    name: server.name ?? "",
    address: server.address ?? "",
    port: server.port ?? 27015,
    game: server.game ?? "cstrike",
    publicAddress: server.publicAddress ?? "",
    rconAddress: server.rconAddress ?? "",
    statusUrl: server.statusUrl ?? "",
    sortOrder: server.sortOrder ?? 0,
    mod: server.configs?.find((config) => config.parameter === "Mod")?.value ?? "",
    authToken: server.authToken?.tokenPrefix
      ? { tokenPrefix: server.authToken.tokenPrefix, name: server.authToken.name ?? "" }
      : null,
  }
}

export async function listModOptions(): Promise<ModOption[]> {
  await requireAdmin()

  const { data } = await query({ query: modsForSelect })
  return data?.findManyModSupported ?? []
}

export async function createServer(input: CreateServerInput): Promise<MutationOutcome> {
  await requirePermission({ server: ["create"] })

  const result = await getClient().mutate({
    mutation: createServerWithConfig,
    variables: { data: input },
  })
  const payload = result.data?.createServerWithConfig
  return { ok: Boolean(payload?.success), message: payload?.message ?? null }
}

export async function updateServer(
  serverId: number,
  input: UpdateServerInput,
): Promise<MutationOutcome> {
  await requirePermission({ server: ["update"] })

  const result = await getClient().mutate({
    mutation: updateServerWithConfig,
    variables: { serverId, data: input },
  })
  const payload = result.data?.updateServerWithConfig
  return { ok: Boolean(payload?.success), message: payload?.message ?? null }
}
