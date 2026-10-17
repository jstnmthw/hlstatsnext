import { RecentServersTable } from "@/features/servers/components/servers-table"
import { recentServers } from "@/lib/data/public/servers"

export async function ServerList({ className }: { className?: string }) {
  const servers = await recentServers(5)

  return (
    <div className={className}>
      <h3 className="mb-1.5 text-lg leading-5 font-bold uppercase">Recently Active Servers</h3>
      <RecentServersTable data={servers} />
    </div>
  )
}
