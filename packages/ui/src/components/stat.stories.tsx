import type { Meta, StoryObj } from "@storybook/react-vite"
import { PulseDot } from "./pulse-dot"
import { Stat, StatChange, StatGroup, StatLabel, StatUnit, StatValue } from "./stat"
import { TextLink } from "./text-link"

const meta = {
  title: "Components/Stat",
  component: Stat,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { variant: "tile" },
  argTypes: {
    variant: { control: "select", options: ["plain", "tile", "inline"] },
  },
} satisfies Meta<typeof Stat>

export default meta

type Story = StoryObj<typeof meta>

export const Tile: Story = {
  render: (args) => (
    <Stat {...args} className="w-44">
      <StatLabel>Kills today</StatLabel>
      <StatValue>4,118</StatValue>
      <StatChange direction="up">+22% vs daily avg</StatChange>
    </Stat>
  ),
}

export const WithUnit: Story = {
  render: (args) => (
    <Stat {...args} className="w-44">
      <StatLabel>Slots</StatLabel>
      <StatValue>
        39<StatUnit>/ 140</StatUnit>
      </StatValue>
      <StatChange>28% full</StatChange>
    </Stat>
  ),
}

export const Grid: Story = {
  render: (args) => (
    <StatGroup className="w-4xl">
      <Stat {...args}>
        <StatLabel>Kills</StatLabel>
        <StatValue>702</StatValue>
        <StatChange direction="up">+61 this week</StatChange>
      </Stat>
      <Stat {...args}>
        <StatLabel>Deaths</StatLabel>
        <StatValue>437</StatValue>
        <StatChange>+28 this week</StatChange>
      </Stat>
      <Stat {...args}>
        <StatLabel>K/D</StatLabel>
        <StatValue>1.61</StatValue>
        <StatChange direction="up">best: 1.61</StatChange>
      </Stat>
      <Stat {...args}>
        <StatLabel>Headshots</StatLabel>
        <StatValue>48%</StatValue>
        <StatChange>server avg 39%</StatChange>
      </Stat>
      <Stat {...args}>
        <StatLabel>Accuracy</StatLabel>
        <StatValue>21%</StatValue>
        <StatChange>server avg 19%</StatChange>
      </Stat>
      <Stat {...args}>
        <StatLabel>Kills / min</StatLabel>
        <StatValue>1.9</StatValue>
        <StatChange direction="up">top 8%</StatChange>
      </Stat>
    </StatGroup>
  ),
}

export const Strip: Story = {
  args: { variant: "plain" },
  render: (args) => (
    <StatGroup variant="strip" className="w-4xl">
      <Stat {...args}>
        <StatLabel>Online</StatLabel>
        <StatValue size="sm">
          <PulseDot />
          51
        </StatValue>
        <StatChange direction="up">+12 vs yesterday</StatChange>
      </Stat>
      <Stat {...args}>
        <StatLabel>Servers up</StatLabel>
        <StatValue size="sm">
          8<StatUnit className="text-base">/ 12</StatUnit>
        </StatValue>
        <StatChange>4 idle · 4 offline</StatChange>
      </Stat>
      <Stat {...args}>
        <StatLabel>Kills, last hour</StatLabel>
        <StatValue size="sm">1,284</StatValue>
        <StatChange direction="up">week high</StatChange>
      </Stat>
      <Stat {...args}>
        <StatLabel>Rank changes</StatLabel>
        <StatValue size="sm">312</StatValue>
        <StatChange>171 up · 141 down</StatChange>
      </Stat>
      <Stat {...args}>
        <StatLabel>#1 right now</StatLabel>
        <TextLink href="#" variant="row" className="text-lg font-bold text-tier-legend">
          Hazel
        </TextLink>
        <StatChange>CS 1.6 · 2,914 skill</StatChange>
      </Stat>
      <Stat {...args} className="border-l border-dashed border-foreground/30">
        <StatLabel>Your rank</StatLabel>
        <StatValue size="sm" className="text-muted-foreground">
          ?
        </StatValue>
        <StatChange>
          <TextLink href="#">Claim player</TextLink>
        </StatChange>
      </Stat>
    </StatGroup>
  ),
}

export const Inline: Story = {
  args: { variant: "inline" },
  render: (args) => (
    <StatGroup variant="inline" className="text-muted-foreground">
      <Stat {...args}>
        <PulseDot className="self-center" />
        <StatValue size="xs" className="text-foreground">
          51
        </StatValue>
        online
      </Stat>
      <Stat {...args}>
        <StatValue size="xs" className="text-foreground">
          8
        </StatValue>
        / 12 servers up
      </Stat>
      <Stat {...args}>
        <StatValue size="xs" className="text-foreground">
          1,284
        </StatValue>
        kills last hour
      </Stat>
      <Stat {...args}>
        <StatValue size="xs" className="text-foreground">
          312
        </StatValue>
        rank changes today
      </Stat>
      <span className="text-xs">updated 4s ago</span>
    </StatGroup>
  ),
}

export const Records: Story = {
  render: (args) => (
    <StatGroup className="w-4xl grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
      {[
        ["Longest kill streak", "31", "Hazel", "2026-09-12"],
        ["Most kills, one map", "94", "drexx", "2026-10-03"],
        ["Most headshots, one map", "61", "Vantablack", "Yesterday"],
        ["Fastest round win", "0:14", "Mintcake", "2026-08-27"],
      ].map(([title, value, player, when]) => (
        <Stat key={title} {...args} className="gap-1.5">
          <StatLabel>{title}</StatLabel>
          <StatValue size="lg">{value}</StatValue>
          <span className="inline-flex items-center gap-2">
            <TextLink href="#" variant="row">
              {player}
            </TextLink>
            <span className="text-xs text-muted-foreground">{when}</span>
          </span>
        </Stat>
      ))}
    </StatGroup>
  ),
}
