import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconChevronRight } from "@tabler/icons-react"
import { useState } from "react"
import { Badge } from "../components/badge"
import { Button } from "../components/button"
import { Card, CardContent, CardFooter } from "../components/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../components/collapsible"
import { GameTag } from "../components/game-tag"
import { Input } from "../components/input"
import { Item, ItemGroup } from "../components/item"
import { Progress } from "../components/progress"
import { Stat, StatLabel, StatValue } from "../components/stat"
import { StatusBadge } from "../components/status-badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/table"
import { TextLink } from "../components/text-link"

const activeGames = [
  ["CS", "Counter-Strike 1.6", 39, "4 / 6", "2,106", "13,670", 98, true],
  ["HL", "Half-Life Deathmatch", 6, "1 / 1", "214", "1,044", 15, false],
  ["CZ", "Condition Zero", 4, "1 / 1", "312", "388", 10, false],
] as const

function GameCard({
  code,
  name,
  online,
  servers,
  ranked,
  kills,
  fill,
  mine,
}: {
  code: string
  name: string
  online: number
  servers: string
  ranked: string
  kills: string
  fill: number
  mine: boolean
}) {
  return (
    <Card size="sm" className={`gap-3.5 p-5 ${mine ? "border-primary-bright/50" : ""}`}>
      <CardContent className="flex items-center gap-3 px-0!">
        <GameTag code={code} size="xl" />
        <div className="flex min-w-0 flex-1 flex-col">
          <TextLink href="#" variant="row" className="text-lg font-semibold">
            {name}
          </TextLink>
          <span className="text-xs text-muted-foreground">Active now</span>
        </div>
        <StatusBadge status="online" pulse={false}>
          {online} online
        </StatusBadge>
      </CardContent>
      <CardContent className="grid grid-cols-3 gap-2 border-t px-0! pt-3">
        <Stat>
          <StatLabel className="normal-case">Servers</StatLabel>
          <StatValue size="xs">{servers}</StatValue>
        </Stat>
        <Stat>
          <StatLabel className="normal-case">Ranked</StatLabel>
          <StatValue size="xs">{ranked}</StatValue>
        </Stat>
        <Stat>
          <StatLabel className="normal-case">Kills today</StatLabel>
          <StatValue size="xs">{kills}</StatValue>
        </Stat>
      </CardContent>
      <CardContent className="flex items-center gap-2 px-0!">
        <Progress
          value={fill}
          className="flex-1"
          indicatorClassName={online >= 20 ? "bg-primary-bright" : "bg-chart-2"}
          aria-label={`${online} players online`}
        />
        <span className="text-xs whitespace-nowrap text-muted-foreground">
          {online} of 140 slots
        </span>
      </CardContent>
      <CardFooter className="gap-4 px-0!">
        <TextLink href="#" variant="muted" className="font-medium">
          Rankings
        </TextLink>
        <TextLink href="#" variant="muted" className="font-medium">
          Servers
        </TextLink>
        <TextLink href="#" variant="muted" className="font-medium">
          Awards
        </TextLink>
      </CardFooter>
    </Card>
  )
}

const quietGames = [
  ["TFC", "Team Fortress Classic", 1, 98, "Now · 2 online", "Grimsby"],
  ["DoD", "Day of Defeat", 2, 540, "3 h ago", "Weera"],
  ["NS", "Natural Selection", 1, 188, "2 d ago", "Khaara"],
  ["SC", "Sven Co-op", 1, 302, "3 d ago", "Barney_"],
  ["TS", "The Specialists", 1, 164, "5 d ago", "Slowmo"],
] as const

function QuietGames() {
  return (
    <Collapsible className="rounded-xl border bg-card">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="group h-auto w-full justify-between rounded-xl px-5 py-3 font-normal"
        >
          <span>
            <strong className="font-semibold">11 more games</strong>{" "}
            <span className="text-muted-foreground">
              · 2 active, 9 quiet · 2,050 ranked players between them
            </span>
          </span>
          <span className="font-medium text-muted-foreground group-data-[state=open]:hidden">
            Show
          </span>
          <span className="hidden font-medium text-muted-foreground group-data-[state=open]:inline">
            Hide
          </span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Table containerClassName="border-t">
          <TableHeader>
            <TableRow>
              <TableHead>Game</TableHead>
              <TableHead numeric>Servers</TableHead>
              <TableHead numeric>Ranked</TableHead>
              <TableHead>Last activity</TableHead>
              <TableHead>All-time #1</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {quietGames.map(([code, name, servers, ranked, last, top]) => (
              <TableRow key={code}>
                <TableCell>
                  <span className="inline-flex items-center gap-2.5">
                    <GameTag code={code} />
                    <TextLink href="#" variant="row">
                      {name}
                    </TextLink>
                  </span>
                </TableCell>
                <TableCell numeric className="text-muted-foreground">
                  {servers}
                </TableCell>
                <TableCell numeric>{ranked}</TableCell>
                <TableCell className="text-muted-foreground">{last}</TableCell>
                <TableCell>
                  <TextLink href="#" variant="row">
                    {top}
                  </TextLink>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm">
                    Open
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CollapsibleContent>
    </Collapsible>
  )
}

const sidebarActive = [
  ["cstrike", "CS", "Counter-Strike 1.6", "39 on", true],
  ["valve", "HL", "Half-Life Deathmatch", "6 on", true],
  ["czero", "CZ", "Condition Zero", "4 on", true],
  ["tfc", "TFC", "Team Fortress Classic", "2 on", true],
  ["dod", "DoD", "Day of Defeat", "2 srv", false],
] as const

const sidebarQuiet = [
  ["ns", "NS", "Natural Selection", "1 srv"],
  ["svencoop", "SC", "Sven Co-op", "—"],
  ["ts", "TS", "The Specialists", "—"],
  ["gearbox", "OF", "Opposing Force", "—"],
] as const

function GameSidebar() {
  const [current, setCurrent] = useState("cstrike")

  return (
    <aside className="flex w-64 flex-col gap-3">
      <Input type="search" placeholder="Filter 14 games" aria-label="Filter games" />
      <ItemGroup className="rounded-xl border bg-card py-1">
        <span className="px-2.5 pt-1.5 pb-0.5 text-xs font-medium text-muted-foreground uppercase">
          Active · 5
        </span>
        {sidebarActive.map(([id, code, name, count, online]) => (
          <Item key={id} asChild size="xs" data-active={current === id}>
            <button type="button" onClick={() => setCurrent(id)} className="w-full text-left">
              <GameTag code={code} size="sm" />
              <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
              <span
                className={`text-xs tabular-nums ${online ? "text-primary-bright" : "text-muted-foreground"}`}
              >
                {count}
              </span>
            </button>
          </Item>
        ))}
        <span className="mt-1 border-t px-2.5 pt-2.5 pb-0.5 text-xs font-medium text-muted-foreground uppercase">
          Quiet · 9
        </span>
        {sidebarQuiet.map(([id, code, name, count]) => (
          <Item key={id} asChild size="xs" data-active={current === id}>
            <button type="button" onClick={() => setCurrent(id)} className="w-full text-left">
              <GameTag code={code} size="sm" muted />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{name}</span>
              <span className="text-xs text-muted-foreground/70 tabular-nums">{count}</span>
            </button>
          </Item>
        ))}
      </ItemGroup>
    </aside>
  )
}

function ServerGroup({
  code,
  name,
  meta,
  online,
  open,
}: {
  code: string
  name: string
  meta: string
  online: number
  open?: boolean
}) {
  return (
    <Collapsible
      defaultOpen={open}
      className="rounded-xl border bg-card data-[state=open]:border-primary-bright/50"
    >
      <CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-accent">
        <IconChevronRight className="size-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
        <GameTag code={code} size="lg" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold">{name}</span>
          <span className="text-xs text-muted-foreground">{meta}</span>
        </span>
        {online ? (
          <StatusBadge status="online" pulse={false}>
            {online} players
          </StatusBadge>
        ) : (
          <Badge variant="muted">Quiet</Badge>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Table containerClassName="border-t">
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Server</TableHead>
              <TableHead>Map</TableHead>
              <TableHead className="min-w-40">Players</TableHead>
              <TableHead numeric>Kills today</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {[
              ["online", "Bangkok 24/7 Dust2", "de_dust2", 18, 32, "4,118", true],
              ["online", "Bangkok Classic Maps", "de_inferno", 12, 24, "2,206", false],
              ["idle", "Aim Training", "aim_map", 0, 16, "318", false],
            ].map(([status, server, map, cur, max, kills, hot]) => (
              <TableRow key={String(server)}>
                <TableCell>
                  <StatusBadge status={status as "online" | "idle"} pulse={false} />
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-2">
                    <TextLink href="#" variant="row">
                      {server}
                    </TextLink>
                    {hot && <Badge>Busiest</Badge>}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{map}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={(Number(cur) / Number(max)) * 100}
                      className="flex-1"
                      indicatorClassName={
                        Number(cur) / Number(max) >= 0.5 ? "bg-chart-2" : "bg-chart-4"
                      }
                      aria-label={`${cur} of ${max} players`}
                    />
                    <span className="inline-block w-13 text-right font-medium tabular-nums">
                      {cur} / {max}
                    </span>
                  </div>
                </TableCell>
                <TableCell numeric>{kills}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm">
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CollapsibleContent>
    </Collapsible>
  )
}

const meta = {
  title: "Patterns/Games",
  parameters: { layout: "padded" },
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const GameCards: Story = {
  render: () => (
    <div className="grid w-5xl grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3">
      {activeGames.map(([code, name, online, servers, ranked, kills, fill, mine]) => (
        <GameCard
          key={code}
          code={code}
          name={name}
          online={online}
          servers={servers}
          ranked={ranked}
          kills={kills}
          fill={fill}
          mine={mine}
        />
      ))}
    </div>
  ),
}

export const QuietGames_: Story = {
  name: "Quiet games",
  render: () => (
    <div className="w-5xl">
      <QuietGames />
    </div>
  ),
}

export const ServersBrowser: Story = {
  render: () => (
    <div className="flex w-5xl items-start gap-6">
      <GameSidebar />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <ServerGroup
          code="CS"
          name="Counter-Strike 1.6"
          meta="4 / 6 servers online · 3 with players"
          online={39}
          open
        />
        <ServerGroup
          code="HL"
          name="Half-Life Deathmatch"
          meta="1 / 1 servers online · 1 with players"
          online={6}
        />
        <ServerGroup
          code="DoD"
          name="Day of Defeat"
          meta="1 / 2 servers online · 0 with players"
          online={0}
        />
      </div>
    </div>
  ),
}
