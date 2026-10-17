"use client"

import { updateMyPlayerPreferences } from "@/features/accounts/actions/update-my-player"
import type { MyPlayer, MyPlayerPreferences } from "@/lib/my-players"
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui"
import Link from "next/link"
import { useTransition } from "react"
import { toast } from "sonner"

interface MyPlayersProps {
  players: MyPlayer[]
  steamLinked: boolean
}

const preferences: { key: keyof MyPlayerPreferences; label: string; hint: string }[] = [
  {
    key: "hideRanking",
    label: "Hide from rankings",
    hint: "Keep this player off the leaderboards.",
  },
  {
    key: "displayEvents",
    label: "Show events",
    hint: "List this player's kills and chat on its page.",
  },
  { key: "blockAvatar", label: "Hide avatar", hint: "Do not show the Steam avatar." },
]

export function MyPlayers({ players, steamLinked }: MyPlayersProps) {
  if (!steamLinked) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Connect Steam to find your players</CardTitle>
          <CardDescription>
            Players are matched by the Steam account you played with. Connect it in Settings and
            they appear here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="primary">
            <Link href="/accounts/settings">Open Settings</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (players.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No players yet</CardTitle>
          <CardDescription>
            Play on a tracked server with your Steam account and this page picks the player up the
            next time you open it.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {players.map((player) => (
        <PlayerCard key={player.playerId} player={player} />
      ))}
    </div>
  )
}

function PlayerCard({ player }: { player: MyPlayer }) {
  const [pending, startTransition] = useTransition()
  const deaths = player.deaths || 1

  function toggle(key: keyof MyPlayerPreferences, value: boolean) {
    startTransition(async () => {
      const result = await updateMyPlayerPreferences(player.playerId, { [key]: value })
      if (result.ok) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="truncate">
            <Link href={`/players/${player.playerId}`} className="hover:underline">
              {player.lastName || "Unnamed player"}
            </Link>
          </CardTitle>
          <Badge variant="secondary">{player.game.toUpperCase()}</Badge>
        </div>
        <CardDescription className="tabular-nums">
          Skill {player.skill.toLocaleString()} · {player.kills.toLocaleString()} kills ·{" "}
          {player.deaths.toLocaleString()} deaths · K/D {(player.kills / deaths).toFixed(2)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {preferences.map(({ key, label, hint }) => (
          <label key={key} className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-primary"
              checked={player[key]}
              disabled={pending}
              onChange={(e) => toggle(key, e.target.checked)}
            />
            <span>
              <span className="block font-medium">{label}</span>
              <span className="block text-xs text-muted-foreground">{hint}</span>
            </span>
          </label>
        ))}
      </CardContent>
    </Card>
  )
}
