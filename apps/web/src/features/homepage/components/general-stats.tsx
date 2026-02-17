import { GET_GENERAL_STATS } from "@/features/homepage/graphql/general-stats-query"
import { query } from "@/lib/apollo-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from "@repo/ui"
import { ComponentProps } from "react"

export async function GeneralStats({ className, ...props }: ComponentProps<"div">) {
  const { data } = await query({ query: GET_GENERAL_STATS })

  const players = data?.countPlayer ?? 0
  const clans = data?.countClan ?? 0
  const games = data?.countGame ?? 0
  const servers = data?.countServer ?? 0
  const totalKills = data?.findManyServer?.reduce((sum, s) => sum + s.kills, 0) ?? 0
  const lastKillTime = data?.findFirstEventFrag?.eventTime as string | null
  const deleteDays = data?.findUniqueOption?.value ?? "N/A"

  return (
    <Card className={cn("overflow-hidden px-6", className)} {...props}>
      <CardHeader className="px-0">
        <CardTitle>General Statistics</CardTitle>
        <CardDescription className="text-xs">
          All statistics are generated in real-time. Event history expires after {deleteDays} days.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 px-0">
        <p>
          <strong className="font-black">{players.toLocaleString()} players</strong> and{" "}
          <strong className="font-black">{clans.toLocaleString()} clans</strong> ranked across{" "}
          <strong className="font-black">{games.toLocaleString()} games</strong> on{" "}
          <strong className="font-black">{servers.toLocaleString()} servers</strong> with{" "}
          <strong className="font-black">{totalKills.toLocaleString()} kills</strong>.
        </p>
        {lastKillTime && (
          <p className="text-sm text-muted-foreground">
            Last kill: {new Date(lastKillTime).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
