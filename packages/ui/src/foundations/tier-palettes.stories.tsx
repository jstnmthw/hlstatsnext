import type { Meta, StoryObj } from "@storybook/react-vite"
import { Progress } from "../components/progress"
import { StackedBar } from "../components/stacked-bar"
import { TierBadge } from "../components/tier-badge"
import { TIERS, tierPaletteNames, tierPaletteStyle, tierPalettes } from "../lib/tiers"

const meta = {
  title: "Foundations/Tier palettes",
  parameters: { layout: "padded" },
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const AllPalettes: Story = {
  render: () => (
    <div className="flex w-4xl flex-col gap-6">
      <p className="text-muted-foreground">
        Every tier-aware component reads the <code>--tier-*</code> variables, so an operator can
        pick a ladder palette once. <code>royal</code> is the default in globals.css.
      </p>
      <div className="flex flex-col divide-y">
        {tierPaletteNames.map((name) => (
          <div
            key={name}
            className="grid grid-cols-[96px_200px_1fr] items-center gap-6 py-3"
            style={tierPaletteStyle(name)}
          >
            <span className="font-medium">{tierPalettes[name].name}</span>
            <div className="flex h-5 gap-0.5">
              {TIERS.map((tier) => (
                <div
                  key={tier}
                  className="flex-1"
                  style={{ backgroundColor: tierPalettes[name].colors[tier] }}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TIERS.map((tier) => (
                <TierBadge key={tier} tier={tier} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
}

export const Ladder: Story = {
  render: () => (
    <div className="flex w-2xl flex-col gap-6">
      {(["royal", "metals", "heat"] as const).map((name) => (
        <div key={name} className="flex flex-col gap-2" style={tierPaletteStyle(name)}>
          <span className="text-xs font-medium text-muted-foreground uppercase">
            {tierPalettes[name].name}
          </span>
          <StackedBar
            size="xl"
            aria-label="Skill ladder, players per tier"
            segments={[
              { value: 1204, className: "bg-tier-recruit/60" },
              { value: 702, className: "bg-tier-regular" },
              { value: 341, className: "bg-tier-veteran" },
              { value: 139, className: "bg-tier-elite" },
              { value: 32, className: "bg-tier-legend min-w-5" },
            ]}
          />
          <Progress
            value={68}
            size="xl"
            aria-label="68% of the way from Veteran to Elite"
            indicatorStyle={{
              background: "linear-gradient(90deg, var(--tier-veteran), var(--tier-elite))",
            }}
          />
        </div>
      ))}
    </div>
  ),
}
