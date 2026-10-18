import type { Meta, StoryObj } from "@storybook/react-vite"
import { TIERS, tierPaletteStyle } from "../lib/tiers"
import { TierBadge } from "./tier-badge"

const meta = {
  title: "Components/Tier Badge",
  component: TierBadge,
  tags: ["autodocs"],
  args: { tier: "elite" },
  argTypes: {
    tier: { control: "select", options: TIERS },
  },
} satisfies Meta<typeof TierBadge>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const AllTiers: Story = {
  render: () => (
    <div className="flex gap-2">
      {TIERS.map((tier) => (
        <TierBadge key={tier} tier={tier} />
      ))}
    </div>
  ),
}

export const AlternatePalette: Story = {
  render: () => (
    <div className="flex gap-2" style={tierPaletteStyle("metals")}>
      {TIERS.map((tier) => (
        <TierBadge key={tier} tier={tier} />
      ))}
    </div>
  ),
}

export const AsText: Story = {
  render: () => (
    <p>
      <span className="font-medium text-tier-legend">Hazel</span> holds #1 ·{" "}
      <span className="font-medium text-tier-elite">Vantablack</span> headshot{" "}
      <span className="font-medium text-tier-veteran">Aether</span>
    </p>
  ),
}
