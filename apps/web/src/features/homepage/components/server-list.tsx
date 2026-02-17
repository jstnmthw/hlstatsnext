import { GET_SERVERS_WITH_PAGINATION } from "@/features/admin/servers/graphql/server-queries"
import { RecentServersTable } from "@/features/servers/components/servers-table"
import { query } from "@/lib/apollo-client"
import { SortOrder } from "@/lib/gql/graphql"

export async function ServerList({ className }: { className?: string }) {
  const { data } = await query({
    query: GET_SERVERS_WITH_PAGINATION,
    variables: {
      take: 5,
      orderBy: [{ activePlayers: SortOrder.Desc }],
    },
  })

  const servers =
    data?.findManyServer?.map((s) => ({
      serverId: s.serverId,
      name: s.name,
      address: s.address,
      port: s.port,
      activePlayers: s.activePlayers,
      maxPlayers: s.maxPlayers,
      lastEvent: s.lastEvent as string | Date | null,
    })) ?? []

  return (
    <div className={className}>
      <h3 className="mb-1.5 text-lg font-semibold tracking-tight">Recently Active Servers</h3>
      <RecentServersTable data={servers} />
    </div>
  )
}
