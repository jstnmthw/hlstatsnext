import type { Meta, StoryObj } from "@storybook/react-vite"
import { Badge } from "../components/badge"
import { BarList, BarListFooter, BarListRow } from "../components/bar-list"
import { Button } from "../components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/card"
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderTitle,
} from "../components/page-header"
import { Progress } from "../components/progress"
import { Sparkbars, SparkbarsAxis } from "../components/sparkbars"
import { Stat, StatChange, StatGroup, StatLabel, StatUnit, StatValue } from "../components/stat"
import { StatusBadge } from "../components/status-badge"
import { TextLink } from "../components/text-link"

function ServerHero() {
  return (
    <Card className="grid grid-cols-[repeat(auto-fit,minmax(400px,1fr))] items-center gap-6 py-6">
      <CardContent className="flex items-center gap-5">
        <div
          role="img"
          aria-label="Map image placeholder for de_dust2"
          className="flex h-27 w-48 shrink-0 items-center justify-center border border-dashed border-foreground/30 bg-secondary text-xs text-muted-foreground"
        >
          [MAP IMAGE de_dust2]
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-5xl font-bold">Bangkok 24/7 Dust2</h1>
            <StatusBadge status="online" />
          </div>
          <span className="text-muted-foreground">
            Counter-Strike 1.6 ·{" "}
            <span className="font-mono font-medium text-foreground">203.0.113.42</span>
            <span className="font-mono font-medium">:27015</span> · Bangkok, TH · up 14 d 6 h
          </span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <Button>Connect</Button>
            <Button variant="secondary">Copy address</Button>
          </div>
        </div>
      </CardContent>
      <CardContent className="flex flex-col gap-3 border-l pl-6!">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <Stat variant="inline">
            <StatLabel>Map</StatLabel>
            <StatValue>de_dust2</StatValue>
            <span className="text-muted-foreground">12 min left</span>
          </Stat>
          <Stat variant="inline">
            <StatLabel>Players</StatLabel>
            <StatValue>
              18<StatUnit>/ 32</StatUnit>
            </StatValue>
          </Stat>
        </div>
        <Progress value={56} size="xl" aria-label="18 of 32 slots filled" />
        <div className="flex flex-wrap justify-between gap-3 text-muted-foreground">
          <span>
            Score <strong className="font-bold text-foreground">CT 9</strong> ·{" "}
            <strong className="font-bold text-foreground">T 7</strong>
          </span>
          <span>Next map: de_inferno</span>
        </div>
      </CardContent>
    </Card>
  )
}

const tiles = [
  ["Kills today", "4,118", "+22% vs daily avg", "up"],
  ["Rounds today", "186", "CT 51% win", "flat"],
  ["Peak players", "31", "at 21:40 today", "flat"],
  ["Avg players", "14.2", "7-day high", "up"],
  ["Unique today", "97", "11 new players", "flat"],
  ["Uptime, 30 d", "99.6%", "1 restart", "flat"],
] as const

const hours = [9, 6, 4, 3, 2, 2, 3, 5, 7, 8, 9, 11, 13, 12, 12, 14, 17, 21, 25, 28, 30, 31, 24, 18]

const maps = [
  ["de_dust2", 100, "58%", "16.1", "bg-chart-1", true],
  ["de_inferno", 31, "18%", "12.4", "bg-chart-2", false],
  ["de_nuke", 19, "11%", "10.8", "bg-chart-3", false],
  ["de_train", 14, "8%", "9.2", "bg-chart-4", false],
  ["cs_office", 9, "5%", "7.5", "bg-chart-5", false],
] as const

const meta = {
  title: "Patterns/Server detail",
  parameters: { layout: "padded" },
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const Hero: Story = {
  render: () => (
    <div className="w-5xl">
      <ServerHero />
    </div>
  ),
}

export const Tiles: Story = {
  render: () => (
    <StatGroup className="w-5xl">
      {tiles.map(([label, value, change, direction]) => (
        <Stat key={label} variant="tile">
          <StatLabel>{label}</StatLabel>
          <StatValue>{value}</StatValue>
          <StatChange direction={direction}>{change}</StatChange>
        </Stat>
      ))}
    </StatGroup>
  ),
}

export const Charts: Story = {
  render: () => (
    <div className="grid w-5xl grid-cols-[repeat(auto-fit,minmax(440px,1fr))] gap-6">
      <Card className="gap-5">
        <CardHeader>
          <CardTitle>Players, last 24 h</CardTitle>
          <CardDescription>Average players per hour · local time</CardDescription>
          <CardAction>
            <Badge variant="secondary">Peak 31</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Sparkbars
            values={hours}
            max={32}
            highlightLast
            aria-label="Players per hour over the last 24 hours, quiet overnight, climbing from 17:00 to a peak of 31 at 21:00"
            titles={(v, i) => `${String(i).padStart(2, "0")}:00 · ${v} players`}
            barClassName={(v) => (v >= 24 ? "bg-chart-2" : v >= 12 ? "bg-chart-3" : "bg-chart-4")}
          />
          <SparkbarsAxis>
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>now</span>
          </SparkbarsAxis>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Map rotation</CardTitle>
          <CardDescription>Share of play time, last 7 days</CardDescription>
        </CardHeader>
        <CardContent>
          <BarList className="[--bar-list-columns:110px_minmax(0,1fr)_44px_56px]">
            {maps.map(([name, percent, share, avg, fill, live]) => (
              <BarListRow
                key={name}
                label={
                  <>
                    {name}
                    {live && (
                      <Badge variant="live" className="h-3.5 px-1">
                        now
                      </Badge>
                    )}
                  </>
                }
                percent={percent}
                value={share}
                meta={avg}
                indicatorClassName={fill}
              />
            ))}
            <BarListFooter>
              <span />
              <span />
              <span>time</span>
              <span>avg players</span>
            </BarListFooter>
          </BarList>
        </CardContent>
      </Card>
    </div>
  ),
}

export const FullPage: Story = {
  render: () => (
    <div className="flex w-5xl flex-col gap-8">
      <ServerHero />
      <StatGroup>
        {tiles.map(([label, value, change, direction]) => (
          <Stat key={label} variant="tile">
            <StatLabel>{label}</StatLabel>
            <StatValue>{value}</StatValue>
            <StatChange direction={direction}>{change}</StatChange>
          </Stat>
        ))}
      </StatGroup>
      <PageHeader variant="section">
        <PageHeaderHeading>
          <PageHeaderTitle level={2}>On the server now</PageHeaderTitle>
          <PageHeaderDescription>
            18 players · session stats reset on map change
          </PageHeaderDescription>
        </PageHeaderHeading>
        <Badge variant="secondary">Auto-refresh · 10 s</Badge>
      </PageHeader>
      <TextLink href="#" className="self-start">
        Show all 18
      </TextLink>
    </div>
  ),
}
