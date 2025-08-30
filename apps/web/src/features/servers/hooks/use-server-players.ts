import { useQuery } from "@apollo/client"
import { GET_SERVER_PLAYERS, GET_SERVER_BASIC_INFO } from "../graphql/server-player-queries"

export interface ServerPlayerFilters {
  search?: string
  onlineOnly?: boolean
  recentOnly?: boolean
  recentDays?: number
  minKills?: number
  minSkill?: number
  country?: string
  minConnectionTime?: number
  favoritePlayersOnly?: boolean
}

export interface ServerPlayerPagination {
  page: number
  pageSize: number
  sortField?: string
  sortOrder?: "asc" | "desc"
}

export function useServerPlayers(
  serverId: number,
  filters: ServerPlayerFilters = {},
  pagination: ServerPlayerPagination = { page: 1, pageSize: 25 },
) {
  const { page, pageSize, sortField, sortOrder } = pagination

  // Build GraphQL variables
  const variables = {
    serverId,
    filters: {
      search: filters.search || undefined,
      onlineOnly: filters.onlineOnly || false,
      recentOnly: filters.recentOnly || false,
      recentDays: filters.recentDays || 30,
      minKills: filters.minKills || undefined,
      minSkill: filters.minSkill || undefined,
    },
    take: pageSize,
    skip: (page - 1) * pageSize,
    sortField: sortField || "skill",
    sortOrder: sortOrder || "desc",
  }

  const { data, loading, error, refetch } = useQuery(GET_SERVER_PLAYERS, {
    variables,
    errorPolicy: "all",
    notifyOnNetworkStatusChange: true,
  })

  return {
    players: data?.getServerPlayers?.players || [],
    totalCount: data?.getServerPlayers?.totalCount || 0,
    onlineCount: data?.getServerPlayers?.onlineCount || 0,
    recentCount: data?.getServerPlayers?.recentCount || 0,
    loading,
    error,
    refetch,
  }
}

export function useServerBasicInfo(serverId: number) {
  const { data, loading, error, refetch } = useQuery(GET_SERVER_BASIC_INFO, {
    variables: { serverId },
    errorPolicy: "all",
  })

  return {
    server: data?.findUniqueServer || null,
    loading,
    error,
    refetch,
  }
}

// Hook for getting just the counts (useful for badges/indicators)
export function useServerPlayerCounts(serverId: number, filters: ServerPlayerFilters = {}) {
  const { data, loading, error } = useQuery(GET_SERVER_PLAYERS, {
    variables: {
      serverId,
      filters: {
        search: filters.search || undefined,
        onlineOnly: filters.onlineOnly || false,
        recentOnly: filters.recentOnly || false,
        recentDays: filters.recentDays || 30,
        minKills: filters.minKills || undefined,
        minSkill: filters.minSkill || undefined,
      },
      take: 0, // We only want the counts
      skip: 0,
      sortField: "skill",
      sortOrder: "desc",
    },
    errorPolicy: "all",
  })

  return {
    totalCount: data?.getServerPlayers?.totalCount || 0,
    onlineCount: data?.getServerPlayers?.onlineCount || 0,
    recentCount: data?.getServerPlayers?.recentCount || 0,
    loading,
    error,
  }
}
