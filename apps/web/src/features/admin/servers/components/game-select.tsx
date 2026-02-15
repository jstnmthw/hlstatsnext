interface Game {
  code: string
  name: string
}

interface GameSelectProps {
  name: string
  defaultValue?: string
  required?: boolean
  games: Game[]
}

export function GameSelect({ name, defaultValue, required, games }: GameSelectProps) {
  return (
    <select
      id="game"
      name={name}
      defaultValue={defaultValue}
      required={required}
      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 shadow-sm transition-colors file:border-0 file:bg-transparent file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    >
      {games.map((game) => (
        <option key={game.code} value={game.code}>
          {game.name}
        </option>
      ))}
    </select>
  )
}
