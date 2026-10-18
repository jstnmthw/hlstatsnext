import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconRefresh } from "@tabler/icons-react"
import { fn } from "storybook/test"
import { Button } from "./button"
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip"

const meta = {
  title: "Components/Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
  args: { onOpenChange: fn() },
} satisfies Meta<typeof Tooltip>

export default meta

type Story = StoryObj<typeof meta>

const sides = ["top", "right", "bottom", "left"] as const

export const Default: Story = {
  render: (args) => (
    <Tooltip {...args}>
      <TooltipTrigger asChild>
        <Button variant="outline">Skill</Button>
      </TooltipTrigger>
      <TooltipContent>
        Points earned from kills, weighted by the skill of each victim
      </TooltipContent>
    </Tooltip>
  ),
}

export const Open: Story = { ...Default, args: { defaultOpen: true } }

export const Sides: Story = {
  render: (args) => (
    <div className="grid grid-cols-2 gap-4">
      {sides.map((side) => (
        <Tooltip key={side} {...args}>
          <TooltipTrigger asChild>
            <Button variant="outline" className="capitalize">
              {side}
            </Button>
          </TooltipTrigger>
          <TooltipContent side={side}>Shown on the {side}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  ),
}

export const IconButton: Story = {
  render: (args) => (
    <Tooltip {...args}>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Refresh rankings">
          <IconRefresh />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Refresh rankings</TooltipContent>
    </Tooltip>
  ),
}

export const InlineText: Story = {
  render: (args) => (
    <p className="text-muted-foreground">
      Hazel was last seen{" "}
      <Tooltip {...args}>
        <TooltipTrigger className="underline decoration-dotted underline-offset-4">
          2 hours ago
        </TooltipTrigger>
        <TooltipContent>18 Oct 2026, 14:32 UTC on Bangkok 24/7 Dust2</TooltipContent>
      </Tooltip>
    </p>
  ),
}
