"use client"

import { useSuspenseQuery } from "@apollo/client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui"
import { GET_GAMES_FOR_SELECT } from "../graphql/game-queries"

interface GameSelectProps {
  name: string
  defaultValue?: string
  required?: boolean
}

export function GameSelect({ name, defaultValue, required }: GameSelectProps) {
  const { data } = useSuspenseQuery(GET_GAMES_FOR_SELECT)

  const games = data.findManyGame || []

  return (
    <Select name={name} defaultValue={defaultValue} required={required}>
      <SelectTrigger id="game" className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {games.length === 0 ? (
          <SelectItem value="" disabled>
            No games available
          </SelectItem>
        ) : (
          games.map((game) => (
            <SelectItem key={game.code} value={game.code}>
              {game.name}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  )
}
