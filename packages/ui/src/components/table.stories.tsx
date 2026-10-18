import type { Meta, StoryObj } from "@storybook/react-vite"
import { Badge } from "./badge"
import { FlagIcon } from "./flag-icon"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "./table"

const meta = {
  title: "Components/Table",
  component: Table,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { containerClassName: "rounded-xl border bg-card" },
} satisfies Meta<typeof Table>

export default meta

type Story = StoryObj<typeof meta>

const players = [
  {
    rank: 1,
    name: "Hazel",
    code: "th",
    country: "Thailand",
    tier: "Legend",
    kills: 18420,
    deaths: 9731,
    lastSeen: "2 minutes ago",
  },
  {
    rank: 2,
    name: "drexx",
    code: "de",
    country: "Germany",
    tier: "Elite",
    kills: 15102,
    deaths: 9044,
    lastSeen: "1 hour ago",
  },
  {
    rank: 3,
    name: "Mintcake",
    code: "se",
    country: "Sweden",
    tier: "Elite",
    kills: 12877,
    deaths: 8390,
    lastSeen: "Yesterday",
  },
  {
    rank: 4,
    name: "Vantablack",
    code: "jp",
    country: "Japan",
    tier: "Veteran",
    kills: 9654,
    deaths: 7812,
    lastSeen: "3 days ago",
  },
  {
    rank: 5,
    name: "Aether",
    code: "de",
    country: "Germany",
    tier: "Regular",
    kills: 4310,
    deaths: 4902,
    lastSeen: "Last week",
  },
  {
    rank: 6,
    name: "tanuki",
    code: "jp",
    country: "Japan",
    tier: "Recruit",
    kills: 812,
    deaths: 1377,
    lastSeen: "2 weeks ago",
  },
]

const totalKills = players.reduce((sum, player) => sum + player.kills, 0)

const totalDeaths = players.reduce((sum, player) => sum + player.deaths, 0)

const format = (value: number) => value.toLocaleString("en-US")

const ratio = (kills: number, deaths: number) => (kills / deaths).toFixed(2)

function RankingsHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead numeric className="w-16">
          Rank
        </TableHead>
        <TableHead>Player</TableHead>
        <TableHead>Tier</TableHead>
        <TableHead numeric>Kills</TableHead>
        <TableHead numeric>Deaths</TableHead>
        <TableHead numeric>K/D</TableHead>
        <TableHead>Last seen</TableHead>
      </TableRow>
    </TableHeader>
  )
}

function RankingsRows({ selected }: { selected?: string }) {
  return players.map((player) => (
    <TableRow key={player.name} data-state={player.name === selected ? "selected" : undefined}>
      <TableCell numeric>{player.rank}</TableCell>
      <TableCell>
        <span className="flex items-center gap-2">
          <FlagIcon code={player.code} name={player.country} />
          {player.name}
        </span>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{player.tier}</Badge>
      </TableCell>
      <TableCell numeric>{format(player.kills)}</TableCell>
      <TableCell numeric>{format(player.deaths)}</TableCell>
      <TableCell numeric>{ratio(player.kills, player.deaths)}</TableCell>
      <TableCell className="text-muted-foreground">{player.lastSeen}</TableCell>
    </TableRow>
  ))
}

export const Default: Story = {
  render: (args) => (
    <Table {...args}>
      <RankingsHeader />
      <TableBody>
        <RankingsRows />
      </TableBody>
    </Table>
  ),
}

export const WithCaption: Story = {
  render: (args) => (
    <Table {...args}>
      <TableCaption>Top players on Bangkok 24/7 Dust2 over the last 30 days.</TableCaption>
      <RankingsHeader />
      <TableBody>
        <RankingsRows />
      </TableBody>
    </Table>
  ),
}

export const WithFooter: Story = {
  render: (args) => (
    <Table {...args}>
      <RankingsHeader />
      <TableBody>
        <RankingsRows />
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>Total</TableCell>
          <TableCell numeric>{format(totalKills)}</TableCell>
          <TableCell numeric>{format(totalDeaths)}</TableCell>
          <TableCell numeric>{ratio(totalKills, totalDeaths)}</TableCell>
          <TableCell />
        </TableRow>
      </TableFooter>
    </Table>
  ),
}

export const SelectedRow: Story = {
  render: (args) => (
    <Table {...args}>
      <RankingsHeader />
      <TableBody>
        <RankingsRows selected="Mintcake" />
      </TableBody>
    </Table>
  ),
}
