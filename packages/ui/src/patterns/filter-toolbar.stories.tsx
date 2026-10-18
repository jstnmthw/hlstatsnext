import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconAdjustmentsHorizontal, IconX } from "@tabler/icons-react"
import { useState } from "react"
import { Button } from "../components/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../components/dropdown-menu"
import { FacetedFilter } from "../components/faceted-filter"
import { FlagIcon } from "../components/flag-icon"
import { GameTag } from "../components/game-tag"
import { Input } from "../components/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "../components/select"
import { Toolbar, ToolbarGroup } from "../components/toolbar"

const games = {
  active: [
    ["cstrike", "CS", "Counter-Strike 1.6", "39 on"],
    ["valve", "HL", "Half-Life Deathmatch", "6 on"],
    ["czero", "CZ", "Condition Zero", "4 on"],
    ["tfc", "TFC", "Team Fortress Classic", "2 on"],
    ["dod", "DoD", "Day of Defeat", "3 h ago"],
  ],
  quiet: [
    ["ns", "NS", "Natural Selection", "2 d ago"],
    ["svencoop", "SC", "Sven Co-op", "3 d ago"],
  ],
} as const

const tierOptions = [
  { value: "legend", label: "Legend", count: 32, className: "text-tier-legend" },
  { value: "elite", label: "Elite", count: 139, className: "text-tier-elite" },
  { value: "veteran", label: "Veteran", count: 341, className: "text-tier-veteran" },
  { value: "regular", label: "Regular", count: 702, className: "text-tier-regular" },
  { value: "recruit", label: "Recruit", count: "1,204", className: "text-tier-recruit" },
]

const countries = [
  ["th", "Thailand", "1,318"],
  ["de", "Germany", "141"],
  ["se", "Sweden", "96"],
  ["jp", "Japan", "88"],
] as const

const countryOptions = countries.map(([code, name, count]) => ({
  value: code,
  keywords: name,
  count,
  label: (
    <span className="inline-flex items-center gap-2">
      <FlagIcon code={code} name={name} />
      {name}
    </span>
  ),
}))

const columns = ["Kills", "Deaths", "K/D", "HS %", "Accuracy", "Time played", "Streak", "Last seen"]

function GameSelect({ allGames = false }: { allGames?: boolean }) {
  return (
    <Select defaultValue={allGames ? "all" : "cstrike"}>
      <SelectTrigger size="sm" aria-label="Game" className="min-w-52">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="min-w-64">
        {allGames && (
          <>
            <SelectItem value="all">
              <GameTag code="ALL" size="xs" outline />
              All games
              <span className="ml-auto text-xs text-muted-foreground">51 on</span>
            </SelectItem>
            <SelectSeparator />
          </>
        )}
        <SelectGroup>
          <SelectLabel className="uppercase">Active</SelectLabel>
          {games.active.map(([value, code, name, meta]) => (
            <SelectItem key={value} value={value}>
              <GameTag code={code} size="xs" />
              {name}
              <span className="ml-auto text-xs text-muted-foreground">{meta}</span>
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel className="uppercase">Quiet · 9</SelectLabel>
          {games.quiet.map(([value, code, name, meta]) => (
            <SelectItem key={value} value={value} className="text-muted-foreground">
              <GameTag code={code} size="xs" muted />
              {name}
              <span className="ml-auto text-xs text-muted-foreground">{meta}</span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function RankingsToolbar() {
  const [tiers, setTiers] = useState<string[]>(["veteran", "elite"])
  const [countries, setCountries] = useState<string[]>([])
  const [visible, setVisible] = useState<string[]>(columns.filter((c) => c !== "Accuracy"))

  return (
    <Toolbar aria-label="Filter rankings" className="w-5xl">
      <Input
        type="search"
        placeholder="Filter players…"
        aria-label="Filter players"
        className="h-8 w-60"
      />
      <GameSelect />
      <Select defaultValue="all">
        <SelectTrigger size="sm" aria-label="Period">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All time</SelectItem>
          <SelectItem value="season">Season 3</SelectItem>
          <SelectItem value="30d">Last 30 days</SelectItem>
          <SelectItem value="7d">Last 7 days</SelectItem>
          <SelectItem value="today">Today</SelectItem>
        </SelectContent>
      </Select>
      <FacetedFilter title="Tier" options={tierOptions} value={tiers} onValueChange={setTiers} />
      <FacetedFilter
        title="Country"
        options={countryOptions}
        value={countries}
        onValueChange={setCountries}
        searchable
      />
      {(tiers.length > 0 || countries.length > 0) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setTiers([])
            setCountries([])
          }}
        >
          Reset
          <IconX />
        </Button>
      )}
      <ToolbarGroup className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <IconAdjustmentsHorizontal />
              View
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel className="uppercase">Toggle columns</DropdownMenuLabel>
            {columns.map((column) => (
              <DropdownMenuCheckboxItem
                key={column}
                checked={visible.includes(column)}
                onCheckedChange={(checked) =>
                  setVisible(checked ? [...visible, column] : visible.filter((c) => c !== column))
                }
              >
                {column}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </ToolbarGroup>
    </Toolbar>
  )
}

const meta = {
  title: "Patterns/Filter toolbar",
  parameters: { layout: "padded" },
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const Rankings: Story = {
  render: () => <RankingsToolbar />,
}

export const GameSwitcher: Story = {
  render: () => (
    <div className="flex gap-3">
      <GameSelect />
      <GameSelect allGames />
    </div>
  ),
}

export const SortSelect: Story = {
  render: () => (
    <Select defaultValue="players">
      <SelectTrigger size="sm" aria-label="Sort">
        <span className="text-muted-foreground">Sort</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="players">Players</SelectItem>
        <SelectItem value="kills">Kills today</SelectItem>
        <SelectItem value="name">Name</SelectItem>
        <SelectItem value="uptime">Uptime</SelectItem>
      </SelectContent>
    </Select>
  ),
}
