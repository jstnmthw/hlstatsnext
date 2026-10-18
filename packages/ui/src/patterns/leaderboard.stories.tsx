import type { Meta, StoryObj } from "@storybook/react-vite"
import { Avatar, AvatarFallback } from "../components/avatar"
import { Button } from "../components/button"
import {
  Callout,
  CalloutActions,
  CalloutContent,
  CalloutDescription,
  CalloutMedia,
  CalloutTitle,
} from "../components/callout"
import { Card, CardContent } from "../components/card"
import { FlagIcon } from "../components/flag-icon"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationSummary,
} from "../components/pagination"
import { Progress } from "../components/progress"
import { Stat, StatLabel, StatValue } from "../components/stat"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/table"
import { TextLink } from "../components/text-link"
import { TierBadge } from "../components/tier-badge"
import { Trend } from "../components/trend"
import { tierBgClass, tierBorderClass, type Tier } from "../lib/tiers"

type Row = {
  rank: number
  delta: number
  name: string
  country: [string, string]
  tier: Tier
  skill: number
  kills: number
  deaths: number
  hs: number
  streak: number
  seen: string
}

const thresholds: Record<Tier, [number, number]> = {
  recruit: [0, 1000],
  regular: [1000, 1500],
  veteran: [1500, 2000],
  elite: [2000, 2500],
  legend: [2500, 3000],
}

const rows: Row[] = [
  [1, 0, "Hazel", ["th", "Thailand"], "legend", 2914, 1208, 501, 61, 9, "3 min ago"],
  [2, 1, "drexx", ["de", "Germany"], "legend", 2860, 1131, 533, 58, 4, "Now"],
  [3, -1, "Mintcake", ["th", "Thailand"], "legend", 2801, 990, 500, 54, 0, "1 h ago"],
  [4, 0, "ohm.exe", ["th", "Thailand"], "legend", 2655, 1044, 549, 49, 2, "Now"],
  [5, 4, "Vantablack", ["se", "Sweden"], "elite", 2340, 903, 483, 66, 12, "Now"],
  [6, -1, "Sirin", ["th", "Thailand"], "elite", 2302, 871, 506, 44, 0, "Yesterday"],
  [7, 0, "bl4ckout", ["pl", "Poland"], "elite", 2218, 845, 500, 47, 1, "2 h ago"],
  [8, -2, "Ploy", ["th", "Thailand"], "elite", 2190, 812, 504, 41, 0, "Yesterday"],
  [9, 2, "tanuki", ["jp", "Japan"], "elite", 2141, 790, 500, 52, 6, "Now"],
  [10, -1, "Weera", ["th", "Thailand"], "elite", 2097, 777, 501, 39, 0, "4 h ago"],
  [11, 3, "Fennec", ["fr", "France"], "elite", 2031, 751, 490, 45, 3, "Now"],
  [12, 9, "Aether", ["th", "Thailand"], "veteran", 1842, 702, 437, 48, 7, "Now"],
].map(([rank, delta, name, country, tier, skill, kills, deaths, hs, streak, seen]) => ({
  rank,
  delta,
  name,
  country,
  tier,
  skill,
  kills,
  deaths,
  hs,
  streak,
  seen,
})) as Row[]

const fmt = (n: number) => n.toLocaleString("en-US")

function RankingsTable() {
  return (
    <Table containerClassName="rounded-xl border bg-card">
      <TableHeader>
        <TableRow>
          <TableHead numeric>Rank</TableHead>
          <TableHead>Δ 7d</TableHead>
          <TableHead>Player</TableHead>
          <TableHead>Tier</TableHead>
          <TableHead className="min-w-52">Skill · next tier</TableHead>
          <TableHead numeric>Kills</TableHead>
          <TableHead numeric>Deaths</TableHead>
          <TableHead numeric>K/D</TableHead>
          <TableHead numeric>HS %</TableHead>
          <TableHead numeric>Streak</TableHead>
          <TableHead>Last seen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((p) => {
          const [lo, hi] = thresholds[p.tier]
          const pct = Math.min(100, Math.round(((p.skill - lo) / (hi - lo)) * 100))
          const toGo = p.tier === "legend" ? "Top tier" : `${fmt(hi - p.skill)} to go`
          return (
            <TableRow key={p.rank}>
              <TableCell numeric>{p.rank}</TableCell>
              <TableCell>
                <Trend value={p.delta} />
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-2">
                  <FlagIcon code={p.country[0]} name={p.country[1]} />
                  <TextLink href="#" variant="row">
                    {p.name}
                  </TextLink>
                </span>
              </TableCell>
              <TableCell>
                <TierBadge tier={p.tier} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-11 text-right font-medium tabular-nums">
                    {fmt(p.skill)}
                  </span>
                  <Progress
                    value={pct}
                    className="flex-1"
                    indicatorClassName={tierBgClass[p.tier]}
                    aria-label={`${pct}% of the way to the next tier`}
                  />
                  <span className="w-16 text-xs whitespace-nowrap text-muted-foreground">
                    {toGo}
                  </span>
                </div>
              </TableCell>
              <TableCell numeric>{fmt(p.kills)}</TableCell>
              <TableCell numeric>{fmt(p.deaths)}</TableCell>
              <TableCell numeric>{(p.kills / p.deaths).toFixed(2)}</TableCell>
              <TableCell numeric>{p.hs}%</TableCell>
              <TableCell
                numeric
                className={
                  p.streak >= 5
                    ? "text-primary-bright"
                    : p.streak
                      ? undefined
                      : "text-muted-foreground"
                }
              >
                {p.streak ? `${p.streak} kills` : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">{p.seen}</TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

const podium = [
  {
    rank: 1,
    delta: 0,
    name: "Hazel",
    country: ["th", "Thailand"],
    skill: "2,914",
    kd: "2.41",
    days: 23,
    tier: "legend" as Tier,
    rankClass: "text-tier-legend",
  },
  {
    rank: 2,
    delta: 1,
    name: "drexx",
    country: ["de", "Germany"],
    skill: "2,860",
    kd: "2.12",
    days: 2,
    tier: "legend" as Tier,
    rankClass: "text-zinc-300",
  },
  {
    rank: 3,
    delta: -1,
    name: "Mintcake",
    country: ["th", "Thailand"],
    skill: "2,801",
    kd: "1.98",
    days: 1,
    tier: "legend" as Tier,
    rankClass: "text-amber-600",
  },
]

function Podium() {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3">
      {podium.map((p) => (
        <Card
          key={p.rank}
          size="sm"
          className={`gap-4 px-6 py-5 ${p.rank === 1 ? tierBorderClass.legend : ""}`}
        >
          <CardContent className="flex items-center justify-between px-0!">
            <span className={`text-3xl font-bold ${p.rankClass}`}>#{p.rank}</span>
            <Trend value={p.delta} />
          </CardContent>
          <CardContent className="flex items-center gap-3 px-0!">
            <Avatar size="lg" shape="square">
              <AvatarFallback>{p.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="inline-flex items-center gap-2 text-lg font-semibold">
                <FlagIcon code={p.country[0]} name={p.country[1]} />
                {p.name}
              </span>
              <TierBadge tier={p.tier} className="self-start" />
            </div>
          </CardContent>
          <CardContent className="grid grid-cols-3 gap-2 border-t px-0! pt-3">
            <Stat>
              <StatLabel className="normal-case">Skill</StatLabel>
              <StatValue size="xs">{p.skill}</StatValue>
            </Stat>
            <Stat>
              <StatLabel className="normal-case">K/D</StatLabel>
              <StatValue size="xs" className="font-medium">
                {p.kd}
              </StatValue>
            </Stat>
            <Stat>
              <StatLabel className="normal-case">Days at #{p.rank}</StatLabel>
              <StatValue size="xs" className="font-medium">
                {p.days}
              </StatValue>
            </Stat>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

const meta = {
  title: "Patterns/Leaderboard",
  parameters: { layout: "padded" },
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const RankingsTable_: Story = {
  name: "Rankings table",
  render: () => (
    <div className="flex w-5xl flex-col gap-3">
      <RankingsTable />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PaginationSummary>Showing 1–12 of 2,106</PaginationSummary>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#" disabled />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#" isActive>
                1
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#">2</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#">3</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#">176</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="#" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  ),
}

export const PodiumCards: Story = {
  render: () => (
    <div className="w-5xl">
      <Podium />
    </div>
  ),
}

export const FullPage: Story = {
  render: () => (
    <div className="flex w-5xl flex-col gap-8">
      <Podium />
      <RankingsTable />
      <Callout className="px-8 py-6">
        <CalloutMedia className="border-dashed border-foreground/30 font-bold">?</CalloutMedia>
        <CalloutContent>
          <CalloutTitle>Where do you stand?</CalloutTitle>
          <CalloutDescription>
            Sign in and claim your player to pin your row here and track your climb.
          </CalloutDescription>
        </CalloutContent>
        <CalloutActions>
          <Button variant="secondary">Sign in</Button>
          <Button>Claim your player</Button>
        </CalloutActions>
      </Callout>
    </div>
  ),
}
