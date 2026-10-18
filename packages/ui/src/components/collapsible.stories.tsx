import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconChevronRight } from "@tabler/icons-react"
import { Button } from "./button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible"
import { GameTag } from "./game-tag"
import { StatusBadge } from "./status-badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table"
import { TextLink } from "./text-link"

const meta = {
  title: "Components/Collapsible",
  component: Collapsible,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { defaultOpen: true, className: "w-3xl rounded-xl border bg-card" },
} satisfies Meta<typeof Collapsible>

export default meta

type Story = StoryObj<typeof meta>

export const ServerGroup: Story = {
  render: (args) => (
    <Collapsible {...args}>
      <CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-accent">
        <IconChevronRight className="size-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
        <GameTag code="CS" size="lg" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold">Counter-Strike 1.6</span>
          <span className="text-xs text-muted-foreground">
            4 / 6 servers online · 3 with players
          </span>
        </span>
        <StatusBadge status="online" pulse={false}>
          39 players
        </StatusBadge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Table containerClassName="border-t">
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Server</TableHead>
              <TableHead>Map</TableHead>
              <TableHead numeric>Players</TableHead>
              <TableHead numeric>Kills today</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[
              ["online", "Bangkok 24/7 Dust2", "de_dust2", "18 / 32", "4,118"],
              ["online", "Bangkok Classic Maps", "de_inferno", "12 / 24", "2,206"],
              ["idle", "Aim Training", "aim_map", "0 / 16", "318"],
              ["offline", "Gun Game", "gg_simpsons", "0 / 20", "98"],
            ].map(([status, name, map, players, kills]) => (
              <TableRow key={name}>
                <TableCell>
                  <StatusBadge status={status as "online" | "idle" | "offline"} pulse={false} />
                </TableCell>
                <TableCell>
                  <TextLink href="#" variant="row">
                    {name}
                  </TextLink>
                </TableCell>
                <TableCell className="text-muted-foreground">{map}</TableCell>
                <TableCell numeric>{players}</TableCell>
                <TableCell numeric>{kills}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex justify-end gap-4 border-t px-4 py-2.5">
          <TextLink href="#">Counter-Strike 1.6 servers</TextLink>
          <TextLink href="#">Rankings</TextLink>
          <TextLink href="#">Awards</TextLink>
        </div>
      </CollapsibleContent>
    </Collapsible>
  ),
}

export const ShowMore: Story = {
  args: { defaultOpen: false },
  render: (args) => (
    <Collapsible {...args}>
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
      <CollapsibleContent className="border-t px-5 py-4 text-muted-foreground">
        Team Fortress Classic, Day of Defeat, Natural Selection, Sven Co-op and 7 more.
      </CollapsibleContent>
    </Collapsible>
  ),
}
