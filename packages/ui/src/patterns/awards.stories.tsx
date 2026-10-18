import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconAward } from "@tabler/icons-react"
import { Badge } from "../components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/card"
import { FlagIcon } from "../components/flag-icon"
import { ItemMedia } from "../components/item"
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderTitle,
} from "../components/page-header"
import { Progress } from "../components/progress"
import { PulseDot } from "../components/pulse-dot"
import { StackedBar } from "../components/stacked-bar"
import { Stat, StatLabel, StatValue } from "../components/stat"
import { TextLink } from "../components/text-link"

const race = [
  ["Most kills", "Vantablack", 118, "drexx", 104],
  ["Most headshots", "Hazel", 61, "Vantablack", 59],
  ["Longest streak", "Aether", 14, "tanuki", 11],
  ["Most defusals", "Pakorn.", 7, "Ploy", 7],
] as const

function RaceCards() {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
      {race.map(([title, leader, value, chaser, chaserValue]) => {
        const gap = value - chaserValue
        const label =
          gap === 0 ? `Tied with ${chaser}` : `${gap} ahead of ${chaser} (${chaserValue})`
        return (
          <Stat key={title} variant="tile" className="gap-2.5">
            <StatLabel>{title}</StatLabel>
            <div className="flex items-baseline justify-between gap-2">
              <TextLink href="#" variant="row" className="text-lg">
                {leader}
              </TextLink>
              <StatValue>{value}</StatValue>
            </div>
            <div className="flex flex-col gap-1">
              <StackedBar
                aria-label={label}
                segments={[
                  { value, className: "bg-chart-2" },
                  { value: Math.max(1, gap === 0 ? 1 : value - gap), className: "bg-secondary" },
                ]}
              />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          </Stat>
        )
      })}
    </div>
  )
}

const rarity = (pct: number) =>
  pct < 1
    ? {
        label: `Legendary · ${pct}%`,
        text: "text-primary-bright",
        border: "border-primary-bright/50",
      }
    : pct < 5
      ? { label: `Rare · ${pct}%`, text: "text-chart-1", border: "border-chart-1/40" }
      : pct < 25
        ? { label: `Uncommon · ${pct}%`, text: "text-chart-2", border: "" }
        : { label: `Common · ${pct}%`, text: "text-muted-foreground", border: "" }

const achievements = [
  ["Enlisted", "Claim your player", "Community", 38.4, "noscope_nat"],
  ["First Blood", "First kill of a round, 50 times", "Combat", 31.2, "Nong_B"],
  ["Marksman", "500 rifle kills", "Weapons", 18.9, "Fennec"],
  ["Headshot King", "50 headshots in one day", "Combat", 9.6, "Vantablack"],
  ["Unbreakable", "15-kill streak", "Combat", 4.2, "Aether"],
  ["Sharpshooter", "100 AWP headshots", "Weapons", 2.9, "Sirin"],
  ["Unbreakable II", "20-kill streak", "Combat", 0.9, "Hazel"],
  ["Ace", "Kill all five opponents in a round", "Combat", 0.4, "Hazel"],
] as const

function AchievementCards() {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
      {achievements.map(([title, rule, category, pct, latest]) => {
        const r = rarity(pct)
        const holders = Math.round((2106 * pct) / 100).toLocaleString("en-US")
        return (
          <Card key={title} size="sm" className={`gap-3 p-4 ${r.border}`}>
            <CardContent className="flex items-start gap-2.5 px-0!">
              <ItemMedia
                variant="icon"
                className={`bg-transparent ${pct < 5 ? `${r.text} ${r.border}` : "text-muted-foreground"}`}
              >
                <IconAward />
              </ItemMedia>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold">{title}</span>
                <span className="text-xs text-muted-foreground">{rule}</span>
              </div>
              <Badge variant="secondary" className={r.text}>
                {r.label}
              </Badge>
            </CardContent>
            <CardContent className="flex items-center justify-between gap-2 border-t px-0! pt-2.5 text-xs text-muted-foreground">
              <span>
                {holders} holders · {category}
              </span>
              <span>
                Latest:{" "}
                <TextLink href="#" variant="muted">
                  {latest}
                </TextLink>
              </span>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

const hall = [
  [1, "Hazel", ["th", "Thailand"], 212, "text-tier-legend", "bg-tier-legend"],
  [2, "drexx", ["de", "Germany"], 164, "text-zinc-300", "bg-chart-2"],
  [3, "Mintcake", ["th", "Thailand"], 139, "text-amber-600", "bg-chart-2"],
  [4, "ohm.exe", ["th", "Thailand"], 118, "text-muted-foreground", "bg-chart-2"],
  [5, "Vantablack", ["se", "Sweden"], 97, "text-muted-foreground", "bg-chart-2"],
] as const

function HallOfFame() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hall of fame</CardTitle>
        <CardDescription>Most daily awards won in Counter-Strike 1.6, all time</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col">
        {hall.map(([rank, name, country, count, rankClass, barClass]) => (
          <div
            key={rank}
            className="grid grid-cols-[28px_minmax(0,1fr)_120px_56px] items-center gap-3 border-b py-2 last:border-b-0"
          >
            <span className={`font-bold tabular-nums ${rankClass}`}>{rank}</span>
            <span className="inline-flex min-w-0 items-center gap-2">
              <FlagIcon code={country[0]} name={country[1]} />
              <TextLink href="#" variant="row">
                {name}
              </TextLink>
            </span>
            <Progress
              value={(count / 212) * 100}
              indicatorClassName={barClass}
              aria-hidden="true"
            />
            <span className="text-right font-medium tabular-nums">{count}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

const meta = {
  title: "Patterns/Awards",
  parameters: { layout: "padded" },
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const TodaysRace: Story = {
  name: "Today's race",
  render: () => (
    <div className="flex w-5xl flex-col gap-4">
      <PageHeader variant="section" className="border-b-0 pb-0">
        <PageHeaderHeading>
          <PageHeaderTitle level={2}>
            Today&apos;s race
            <Badge variant="live">
              <PulseDot />
              Locks in 2 h 08 min
            </Badge>
          </PageHeaderTitle>
          <PageHeaderDescription>
            Current leaders for tonight&apos;s daily awards. Anyone on a server can still take
            these.
          </PageHeaderDescription>
        </PageHeaderHeading>
        <TextLink href="#">Jump on a server</TextLink>
      </PageHeader>
      <RaceCards />
    </div>
  ),
}

export const Achievements: Story = {
  render: () => (
    <div className="w-5xl">
      <AchievementCards />
    </div>
  ),
}

export const HallOfFame_: Story = {
  name: "Hall of fame",
  render: () => (
    <div className="w-xl">
      <HallOfFame />
    </div>
  ),
}
