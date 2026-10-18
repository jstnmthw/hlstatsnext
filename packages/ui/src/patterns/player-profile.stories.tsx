import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconAward } from "@tabler/icons-react"
import { Avatar, AvatarFallback } from "../components/avatar"
import { Badge } from "../components/badge"
import { Button } from "../components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/card"
import { FlagIcon } from "../components/flag-icon"
import { GameTag } from "../components/game-tag"
import { ItemMedia } from "../components/item"
import { Progress } from "../components/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/select"
import { StackedBar } from "../components/stacked-bar"
import { Stat, StatLabel, StatValue } from "../components/stat"
import { TextLink } from "../components/text-link"
import { TierBadge } from "../components/tier-badge"
import { Trend } from "../components/trend"

const playerGames: [string, string, string, string][] = [
  ["cstrike", "CS", "Counter-Strike 1.6", "#12 · 214 h"],
  ["valve", "HL", "Half-Life DM", "#88 · 31 h"],
  ["dod", "DoD", "Day of Defeat", "#203 · 6 h"],
]

function PlayerHero() {
  return (
    <Card className="grid grid-cols-[repeat(auto-fit,minmax(400px,1fr))] items-center gap-6 py-6">
      <CardContent className="flex min-w-0 items-center gap-5">
        <Avatar size="xl" shape="square">
          <AvatarFallback>AE</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-5xl font-bold">Aether</h1>
            <FlagIcon code="th" name="Thailand" />
            <TierBadge tier="veteran" />
            <Badge variant="outline">Unclaimed</Badge>
          </div>
          <span className="text-muted-foreground">
            Joined 2024-03-02 · last seen now on <TextLink href="#">Bangkok 24/7 Dust2</TextLink>
          </span>
          <Select defaultValue="cstrike">
            <SelectTrigger size="sm" aria-label="Stats by game" className="mt-1 min-w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="min-w-64">
              {playerGames.map(([value, code, name, meta]) => (
                <SelectItem key={value} value={value}>
                  <GameTag code={code} size="xs" />
                  {name}
                  <span className="ml-auto text-xs text-muted-foreground">{meta}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <Button>This is me — claim player</Button>
            <Button variant="secondary">Compare</Button>
          </div>
        </div>
      </CardContent>
      <CardContent className="flex flex-col gap-3 border-l pl-6!">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <Stat variant="inline">
            <StatLabel>Rank</StatLabel>
            <StatValue size="lg">#12</StatValue>
            <Trend direction="up">9 this week</Trend>
          </Stat>
          <Stat variant="inline">
            <StatLabel>Skill</StatLabel>
            <StatValue size="lg">1,842</StatValue>
          </Stat>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-tier-veteran">Veteran · 1,500</span>
            <span className="font-medium text-tier-elite">Elite · 2,000</span>
          </div>
          <Progress
            value={68}
            size="xl"
            aria-label="68% of the way from Veteran to Elite"
            indicatorStyle={{
              background: "linear-gradient(90deg, var(--tier-veteran), var(--tier-elite))",
            }}
          />
          <span>
            <strong className="font-bold text-tier-elite">158 skill to Elite.</strong>{" "}
            <span className="text-muted-foreground">At this week&apos;s pace, about 6 days.</span>
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function Streaks() {
  return (
    <Card className="gap-5">
      <CardHeader>
        <CardTitle>Streaks</CardTitle>
        <CardDescription>Kills without dying</CardDescription>
        <CardAction>
          <Badge>Live · 7</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-3">
        <Stat>
          <StatLabel>Current</StatLabel>
          <StatValue size="lg" className="text-primary-bright">
            7
          </StatValue>
        </Stat>
        <Stat>
          <StatLabel>Personal best</StatLabel>
          <StatValue size="lg">14</StatValue>
        </Stat>
        <Stat>
          <StatLabel>Server record</StatLabel>
          <StatValue size="lg" className="text-muted-foreground">
            31
          </StatValue>
        </Stat>
      </CardContent>
      <CardContent className="flex flex-col gap-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Next award: Unbreakable II at 20</span>
          <span>7 / 20</span>
        </div>
        <Progress
          value={35}
          indicatorClassName="bg-chart-2"
          aria-label="7 of 20 kills toward Unbreakable II"
        />
      </CardContent>
      <CardContent className="flex flex-col gap-1 border-t pt-3">
        <StatLabel>Play streak</StatLabel>
        <div
          className="flex items-center gap-1"
          role="img"
          aria-label="Played 5 of the last 7 days"
        >
          {[1, 1, 0, 1, 1, 0, 2].map((d, i) => (
            <span
              key={i}
              className={`size-5 ${d === 2 ? "bg-primary-bright" : d ? "bg-chart-2" : "bg-secondary"}`}
            />
          ))}
          <span className="ml-2">5 of the last 7 days</span>
        </div>
      </CardContent>
    </Card>
  )
}

const awards = [
  ["Unbreakable", "15-kill streak", 100, "Unlocked", true],
  ["Headshot King", "50 headshots in a day", 100, "Unlocked", true],
  ["Enlisted", "Claim your player", 0, "Claim to unlock", false],
  ["Bomb Squad", "10 defusals in a week", 70, "7 / 10 this week", false],
  ["Marksman", "500 rifle kills", 86, "431 / 500", false],
  ["Unbreakable II", "20-kill streak", 35, "Best so far: 14", false],
] as const

function AwardCard({
  title,
  rule,
  percent,
  status,
  done,
}: {
  title: string
  rule: string
  percent: number
  status: string
  done: boolean
}) {
  return (
    <Card size="sm" className={`gap-2.5 p-4 ${!done && percent === 0 ? "opacity-70" : ""}`}>
      <CardContent className="flex items-center gap-2.5 px-0!">
        <ItemMedia
          variant="icon"
          className={
            done
              ? "border-primary-bright/50 bg-transparent text-primary-bright"
              : "bg-transparent text-muted-foreground"
          }
        >
          <IconAward />
        </ItemMedia>
        <div className="flex min-w-0 flex-col">
          <span className="font-semibold">{title}</span>
          <span className="text-xs text-muted-foreground">{rule}</span>
        </div>
      </CardContent>
      <CardContent className="flex flex-col gap-1 px-0!">
        <Progress
          value={percent}
          size="sm"
          indicatorClassName={done ? "bg-primary-bright" : "bg-chart-2"}
          aria-label={status}
        />
        <span className={`text-xs ${done ? "text-primary-bright" : "text-muted-foreground"}`}>
          {status}
        </span>
      </CardContent>
    </Card>
  )
}

function Rivals() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rivals</CardTitle>
        <CardDescription>Who you meet most, last 30 days</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        <div className="flex flex-col gap-2 rounded-xl border border-destructive/40 px-4 py-3.5">
          <span className="text-xs font-medium text-destructive uppercase">Nemesis</span>
          <TextLink href="#" variant="row" className="text-lg">
            Vantablack
          </TextLink>
          <span className="text-muted-foreground">
            Killed you <strong className="font-bold text-foreground">41</strong> times · you got{" "}
            <strong className="font-bold text-foreground">17</strong>
          </span>
          <StackedBar
            segments={[
              { value: 41, className: "bg-destructive" },
              { value: 17, className: "bg-chart-2" },
            ]}
            aria-label="41 deaths to 17 kills"
          />
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-primary-bright/35 px-4 py-3.5">
          <span className="text-xs font-medium text-primary-bright uppercase">
            Favourite target
          </span>
          <TextLink href="#" variant="row" className="text-lg">
            noscope_nat
          </TextLink>
          <span className="text-muted-foreground">
            You got them <strong className="font-bold text-foreground">56</strong> times · they got{" "}
            <strong className="font-bold text-foreground">12</strong>
          </span>
          <StackedBar
            segments={[
              { value: 56, className: "bg-chart-2" },
              { value: 12, className: "bg-destructive" },
            ]}
            aria-label="56 kills to 12 deaths"
          />
        </div>
      </CardContent>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <span className="text-muted-foreground">
          Closest rival on the ladder: <TextLink href="#">quietstorm</TextLink> at #13, 6 skill
          behind.
        </span>
        <Badge variant="secondary">Watch your back</Badge>
      </CardContent>
    </Card>
  )
}

const meta = {
  title: "Patterns/Player profile",
  parameters: { layout: "padded" },
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const Hero: Story = {
  render: () => (
    <div className="w-5xl">
      <PlayerHero />
    </div>
  ),
}

export const StreaksCard: Story = {
  render: () => (
    <div className="w-md">
      <Streaks />
    </div>
  ),
}

export const Awards: Story = {
  render: () => (
    <div className="grid w-5xl grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
      {awards.map(([title, rule, percent, status, done]) => (
        <AwardCard
          key={title}
          title={title}
          rule={rule}
          percent={percent}
          status={status}
          done={done}
        />
      ))}
    </div>
  ),
}

export const RivalsCard: Story = {
  render: () => (
    <div className="w-xl">
      <Rivals />
    </div>
  ),
}

export const FullPage: Story = {
  render: () => (
    <div className="flex w-5xl flex-col gap-8">
      <PlayerHero />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(440px,1fr))] gap-6">
        <Streaks />
        <Rivals />
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        {awards.map(([title, rule, percent, status, done]) => (
          <AwardCard
            key={title}
            title={title}
            rule={rule}
            percent={percent}
            status={status}
            done={done}
          />
        ))}
      </div>
    </div>
  ),
}
