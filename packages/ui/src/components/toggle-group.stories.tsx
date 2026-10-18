import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { GameTag } from "./game-tag"
import { ToggleGroup, ToggleGroupItem } from "./toggle-group"

const meta = {
  title: "Components/Toggle Group",
  component: ToggleGroup,
  tags: ["autodocs"],
  args: { type: "single", variant: "outline", onValueChange: fn() },
  argTypes: {
    type: { control: "select", options: ["single", "multiple"] },
    variant: { control: "select", options: ["default", "outline"] },
    size: { control: "select", options: ["sm", "default", "lg"] },
    joined: { control: "boolean" },
  },
} satisfies Meta<typeof ToggleGroup>

export default meta

type Story = StoryObj<typeof meta>

export const Segmented: Story = {
  args: { joined: true, size: "lg", defaultValue: "all" },
  render: (args) => (
    <ToggleGroup {...args} aria-label="Period">
      <ToggleGroupItem value="all">All time</ToggleGroupItem>
      <ToggleGroupItem value="season">Season 3</ToggleGroupItem>
      <ToggleGroupItem value="30d">30 days</ToggleGroupItem>
      <ToggleGroupItem value="7d">7 days</ToggleGroupItem>
    </ToggleGroup>
  ),
}

export const Chips: Story = {
  args: { type: "multiple", size: "sm", defaultValue: ["combat"] },
  render: (args) => (
    <ToggleGroup {...args} aria-label="Category">
      <ToggleGroupItem value="combat">Combat</ToggleGroupItem>
      <ToggleGroupItem value="weapons">Weapons</ToggleGroupItem>
      <ToggleGroupItem value="objective">Objective</ToggleGroupItem>
      <ToggleGroupItem value="community">Community</ToggleGroupItem>
    </ToggleGroup>
  ),
}

export const GamePills: Story = {
  args: { defaultValue: "cstrike" },
  render: (args) => (
    <ToggleGroup {...args} aria-label="Stats by game">
      <ToggleGroupItem value="cstrike">
        <GameTag code="CS" size="xs" />
        Counter-Strike 1.6
        <span className="text-muted-foreground">#12 · 214 h</span>
      </ToggleGroupItem>
      <ToggleGroupItem value="valve">
        <GameTag code="HL" size="xs" />
        Half-Life DM
        <span className="text-muted-foreground">#88 · 31 h</span>
      </ToggleGroupItem>
      <ToggleGroupItem value="dod">
        <GameTag code="DoD" size="xs" />
        Day of Defeat
        <span className="text-muted-foreground">#203 · 6 h</span>
      </ToggleGroupItem>
    </ToggleGroup>
  ),
}

export const Ghost: Story = {
  args: { variant: "default", defaultValue: "players" },
  render: (args) => (
    <ToggleGroup {...args} aria-label="Sort">
      <ToggleGroupItem value="players">Players</ToggleGroupItem>
      <ToggleGroupItem value="kills">Kills today</ToggleGroupItem>
      <ToggleGroupItem value="name">Name</ToggleGroupItem>
    </ToggleGroup>
  ),
}
