import type { Meta, StoryObj } from "@storybook/react-vite"
import { StackedBar, StackedBarLegend, StackedBarLegendItem } from "./stacked-bar"

const meta = {
  title: "Components/Stacked Bar",
  component: StackedBar,
  tags: ["autodocs"],
  args: {
    segments: [{ value: 18 }, { value: 12 }, { value: 9 }],
    "aria-label": "Players by server: Dust2 18, Classic Maps 12, Deathmatch Arena 9",
    className: "w-96",
  },
  argTypes: {
    size: { control: "select", options: ["default", "lg", "xl"] },
  },
} satisfies Meta<typeof StackedBar>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithLegend: Story = {
  render: (args) => (
    <div className="flex w-96 flex-col gap-4">
      <StackedBar {...args} size="xl" />
      <StackedBarLegend>
        <StackedBarLegendItem swatchClassName="bg-chart-1" value="18 · 46%">
          Bangkok 24/7 Dust2
        </StackedBarLegendItem>
        <StackedBarLegendItem swatchClassName="bg-chart-2" value="12 · 31%">
          Bangkok Classic Maps
        </StackedBarLegendItem>
        <StackedBarLegendItem swatchClassName="bg-chart-3" value="9 · 23%">
          Deathmatch Arena
        </StackedBarLegendItem>
      </StackedBarLegend>
    </div>
  ),
}

export const Ratio: Story = {
  args: {
    segments: [
      { value: 41, className: "bg-destructive" },
      { value: 17, className: "bg-chart-2" },
    ],
    "aria-label": "41 deaths to 17 kills",
  },
}

export const Tiers: Story = {
  args: {
    size: "xl",
    "aria-label": "Skill ladder, players per tier",
    segments: [
      { value: 1204, className: "bg-tier-recruit/60" },
      { value: 702, className: "bg-tier-regular" },
      { value: 341, className: "bg-tier-veteran" },
      { value: 139, className: "bg-tier-elite" },
      { value: 32, className: "bg-tier-legend min-w-5" },
    ],
  },
}
