import type { Meta, StoryObj } from "@storybook/react-vite"
import { Badge } from "./badge"
import { Button } from "./button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card"
import { GameTag } from "./game-tag"
import { Progress } from "./progress"
import { Stat, StatLabel, StatValue } from "./stat"
import { StatusBadge } from "./status-badge"
import { TextLink } from "./text-link"

const meta = {
  title: "Components/Card",
  component: Card,
  tags: ["autodocs"],
  args: { className: "w-96" },
  argTypes: {
    size: { control: "select", options: ["default", "sm"] },
  },
} satisfies Meta<typeof Card>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Map rotation</CardTitle>
        <CardDescription>Share of play time, last 7 days</CardDescription>
        <CardAction>
          <Badge variant="secondary">Peak 31</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-y-1">
          <dt className="text-muted-foreground">de_dust2</dt>
          <dd className="text-right font-medium tabular-nums">58%</dd>
          <dt className="text-muted-foreground">de_inferno</dt>
          <dd className="text-right font-medium tabular-nums">18%</dd>
          <dt className="text-muted-foreground">de_nuke</dt>
          <dd className="text-right font-medium tabular-nums">11%</dd>
        </dl>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="secondary" size="sm">
          Details
        </Button>
        <Button size="sm">Connect</Button>
      </CardFooter>
    </Card>
  ),
}

export const HeaderOnly: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Top players</CardTitle>
        <CardDescription>Ranked by skill over the last 30 days</CardDescription>
      </CardHeader>
    </Card>
  ),
}

export const Compact: Story = {
  args: { size: "sm", className: "w-80" },
  render: (args) => (
    <Card {...args}>
      <CardContent className="flex items-center gap-3">
        <GameTag code="CS" size="xl" />
        <div className="flex min-w-0 flex-1 flex-col">
          <TextLink href="#" variant="row" className="text-lg font-semibold">
            Counter-Strike 1.6
          </TextLink>
          <span className="text-xs text-muted-foreground">Active now</span>
        </div>
        <StatusBadge status="online" pulse={false}>
          39 online
        </StatusBadge>
      </CardContent>
      <CardContent className="grid grid-cols-3 gap-2 border-t pt-3">
        <Stat>
          <StatLabel className="normal-case">Servers</StatLabel>
          <StatValue size="xs">4 / 6</StatValue>
        </Stat>
        <Stat>
          <StatLabel className="normal-case">Ranked</StatLabel>
          <StatValue size="xs">2,106</StatValue>
        </Stat>
        <Stat>
          <StatLabel className="normal-case">Kills today</StatLabel>
          <StatValue size="xs">13,670</StatValue>
        </Stat>
      </CardContent>
      <CardContent className="flex items-center gap-2">
        <Progress value={98} className="flex-1" aria-label="39 of 140 slots" />
        <span className="text-xs whitespace-nowrap text-muted-foreground">39 of 140 slots</span>
      </CardContent>
      <CardFooter className="gap-4">
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
  ),
}

export const Highlighted: Story = {
  args: {
    size: "sm",
    className: "w-80 border-tier-legend/50 shadow-[0_0_18px] shadow-tier-legend/15",
  },
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle className="text-xs font-medium text-muted-foreground">
          Top of the ladder
        </CardTitle>
        <CardAction>
          <Badge variant="secondary" className="text-tier-legend">
            Legend
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col">
        <TextLink href="#" variant="row" className="text-xl font-bold">
          Hazel
        </TextLink>
        <span className="text-muted-foreground">
          #1 Counter-Strike 1.6 · 2,914 skill · 23 days on top · drexx 54 behind
        </span>
      </CardContent>
    </Card>
  ),
}
