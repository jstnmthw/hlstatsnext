import type { Meta, StoryObj } from "@storybook/react-vite"
import { Card, CardContent, CardHeader, CardTitle } from "../components/card"
import { PulseDot } from "../components/pulse-dot"
import { Stat, StatChange, StatGroup, StatLabel, StatUnit, StatValue } from "../components/stat"
import { TextLink } from "../components/text-link"
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/tooltip"
import { Trend } from "../components/trend"
import { TIERS, tierBgClass, tierLabels, tierTextClass } from "../lib/tiers"

function Band({ children }: { children: React.ReactNode }) {
  return (
    <section className="w-full border-b bg-card/50">
      <div className="mx-auto flex max-w-5xl flex-col gap-5 px-8 py-7">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-5xl font-bold">[YOUR COMMUNITY]</h1>
            <span className="text-muted-foreground">
              Half-Life game stats · 14 games · 12 servers · since 2024
            </span>
          </div>
          <span className="text-xs text-muted-foreground">updated 4s ago</span>
        </div>
        {children}
      </div>
    </section>
  )
}

function Strip() {
  return (
    <StatGroup variant="strip">
      <Stat>
        <StatLabel>Online</StatLabel>
        <StatValue size="sm">
          <PulseDot />
          51
        </StatValue>
        <StatChange direction="up">+12 vs yesterday</StatChange>
      </Stat>
      <Stat>
        <StatLabel>Servers up</StatLabel>
        <StatValue size="sm">
          8<StatUnit className="text-base">/ 12</StatUnit>
        </StatValue>
        <StatChange>4 idle · 4 offline</StatChange>
      </Stat>
      <Stat>
        <StatLabel>Kills, last hour</StatLabel>
        <StatValue size="sm">1,284</StatValue>
        <StatChange direction="up">week high</StatChange>
      </Stat>
      <Stat>
        <StatLabel>Rank changes</StatLabel>
        <StatValue size="sm">312</StatValue>
        <StatChange>171 up · 141 down</StatChange>
      </Stat>
      <Stat>
        <StatLabel>#1 right now</StatLabel>
        <TextLink href="#" variant="row" className="text-lg font-bold text-tier-legend">
          Hazel
        </TextLink>
        <StatChange>CS 1.6 · 2,914 skill</StatChange>
      </Stat>
      <Stat>
        <StatLabel>Busiest server</StatLabel>
        <TextLink href="#" variant="row" className="text-lg font-bold">
          Dust2 24/7
        </TextLink>
        <StatChange>
          de_dust2 · <span className="text-primary-bright">18 / 32</span>
        </StatChange>
      </Stat>
      <Stat className="border-l border-dashed border-foreground/30">
        <StatLabel>Your rank</StatLabel>
        <StatValue size="sm" className="text-muted-foreground">
          ?
        </StatValue>
        <StatChange>
          <TextLink href="#">Claim player</TextLink>
        </StatChange>
      </Stat>
    </StatGroup>
  )
}

const feed = [
  [
    "21:52:14",
    <>
      <span className="font-medium text-tier-elite">Vantablack</span>{" "}
      <span className="text-muted-foreground">headshot</span>{" "}
      <span className="font-medium text-tier-veteran">Aether</span>{" "}
      <span className="text-muted-foreground">· AK-47 · de_dust2</span>
    </>,
  ],
  [
    "21:52:09",
    <>
      <span className="font-medium text-tier-legend">Hazel</span>{" "}
      <span className="text-primary-bright">unlocked Headshot King</span>{" "}
      <span className="text-muted-foreground">· 50 headshots today</span>
    </>,
  ],
  [
    "21:51:58",
    <>
      <span className="font-medium text-tier-veteran">kuro_</span>{" "}
      <span className="text-muted-foreground">climbed</span> <Trend value={9} />{" "}
      <span className="text-muted-foreground">to #38 · Counter-Strike 1.6</span>
    </>,
  ],
  [
    "21:51:40",
    <>
      <span className="font-medium text-tier-regular">noscope_nat</span>{" "}
      <span className="text-muted-foreground">streak</span> <span className="font-medium">7</span>{" "}
      <span className="text-muted-foreground">without dying · Deathmatch Arena</span>
    </>,
  ],
] as const

function LiveFeed() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border bg-background">
      <div className="flex items-center justify-between gap-3 border-b bg-card px-4 py-2">
        <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
          <PulseDot />
          Live feed · all games
        </span>
        <span className="text-xs text-muted-foreground">
          <span className="font-bold text-tier-legend">Hazel</span> holds #1 ·{" "}
          <TextLink href="#">claim your player</TextLink> to see yourself here
        </span>
      </div>
      <ol aria-live="polite" className="flex flex-col px-4 py-1">
        {feed.map(([time, content]) => (
          <li
            key={time}
            className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 border-b border-border/60 py-1.5 font-light last:border-b-0"
          >
            <span className="text-muted-foreground/70 tabular-nums">{time}</span>
            <span>{content}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

const ladder = [
  ["recruit", 1204, "under 1,000", "1,204 players"],
  ["regular", 702, "1,000+", "702 players"],
  ["veteran", 341, "1,500+", "341 players"],
  ["elite", 139, "2,000+", "139 players"],
  ["legend", 32, "2,500+", "top 32"],
] as const

function SkillLadder() {
  return (
    <Card
      size="sm"
      className="relative flex-row flex-wrap items-center gap-5 overflow-hidden px-5 py-4"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-0.5"
        style={{
          background:
            "linear-gradient(90deg, var(--tier-recruit) 0%, var(--tier-regular) 30%, var(--tier-veteran) 55%, var(--tier-elite) 78%, var(--tier-legend) 100%)",
        }}
      />
      <div className="flex min-w-40 flex-col gap-0.5">
        <span className="text-xs font-medium text-muted-foreground uppercase">Skill ladder</span>
        <span className="text-xs text-muted-foreground">Counter-Strike 1.6 · hover a tier</span>
      </div>
      <div
        role="list"
        aria-label="Skill ladder, players per tier"
        className="flex h-3 flex-[1_1_360px] gap-[3px]"
      >
        {ladder.map(([tier, count, range, players]) => (
          <Tooltip key={tier}>
            <TooltipTrigger asChild>
              <div
                role="listitem"
                tabIndex={0}
                aria-label={`${tierLabels[tier]}, ${range} skill, ${players}`}
                style={{ flex: count }}
                className={`min-w-5 outline-none focus-visible:ring-2 focus-visible:ring-foreground ${tierBgClass[tier]} ${tier === "recruit" ? "opacity-60" : ""}`}
              />
            </TooltipTrigger>
            <TooltipContent>
              <span className="inline-flex items-center gap-1.5">
                <span className={`size-2 ${tierBgClass[tier]}`} />
                {tierLabels[tier]} · {range} · {players}
              </span>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      <TextLink href="#" className="whitespace-nowrap">
        Rankings
      </TextLink>
    </Card>
  )
}

const meta = {
  title: "Patterns/Home",
  parameters: { layout: "fullscreen" },
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const StatsBand: Story = {
  render: () => (
    <Band>
      <Strip />
    </Band>
  ),
}

export const LiveFeed_: Story = {
  name: "Live feed",
  render: () => (
    <Band>
      <StatGroup variant="inline" className="text-muted-foreground">
        <Stat variant="inline">
          <PulseDot className="self-center" />
          <StatValue size="xs" className="text-foreground">
            51
          </StatValue>
          online
        </Stat>
        <Stat variant="inline">
          <StatValue size="xs" className="text-foreground">
            8
          </StatValue>
          / 12 servers up
        </Stat>
        <Stat variant="inline">
          <StatValue size="xs" className="text-foreground">
            1,284
          </StatValue>
          kills last hour
        </Stat>
        <Stat variant="inline">
          <StatValue size="xs" className="text-foreground">
            312
          </StatValue>
          rank changes today
        </Stat>
      </StatGroup>
      <LiveFeed />
    </Band>
  ),
}

export const SkillLadder_: Story = {
  name: "Skill ladder",
  parameters: { layout: "padded" },
  render: () => (
    <div className="w-5xl">
      <SkillLadder />
    </div>
  ),
}

export const TopMovers: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <Card className="w-lg gap-5">
      <CardHeader>
        <CardTitle>Top movers today</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col">
        {[
          ["noscope_nat", "Counter-Strike 1.6", 141, 22, "regular"],
          ["Aether", "Counter-Strike 1.6", 12, 9, "veteran"],
          ["Barney_", "Sven Co-op", 3, 8, "elite"],
          ["kuro_", "Counter-Strike 1.6", 38, 7, "veteran"],
          ["Grimsby", "Team Fortress Classic", 2, 5, "legend"],
        ].map(([name, game, rank, delta, tier]) => (
          <div
            key={String(name)}
            className="grid grid-cols-[28px_minmax(0,1fr)_72px_72px] items-center gap-3 border-b py-2 last:border-b-0"
          >
            <span className="inline-flex size-7 items-center justify-center bg-secondary text-sm font-bold">
              {String(name).slice(0, 2).toUpperCase()}
            </span>
            <div className="flex min-w-0 flex-col">
              <TextLink href="#" variant="row">
                {name}
              </TextLink>
              <span className="text-xs text-muted-foreground">
                {game} · now #{rank}
              </span>
            </div>
            <span
              className={`text-xs font-medium ${tierTextClass[tier as (typeof TIERS)[number]]}`}
            >
              {tierLabels[tier as (typeof TIERS)[number]]}
            </span>
            <Trend value={Number(delta)} className="justify-self-end font-bold" />
          </div>
        ))}
      </CardContent>
    </Card>
  ),
}
