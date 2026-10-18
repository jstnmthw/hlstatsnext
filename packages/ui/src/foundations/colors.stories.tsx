import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
  title: "Foundations/Colors",
  parameters: { layout: "padded" },
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

// Literal class names so Tailwind's scanner picks them up.
const surfaces = [
  ["background", "bg-background", "Page ground"],
  ["card", "bg-card", "Panels and tables"],
  ["popover", "bg-popover", "Menus, selects, popovers"],
  ["secondary", "bg-secondary", "Secondary buttons, badges, bar tracks"],
  ["muted", "bg-muted", "Quiet surfaces, skeletons"],
  ["accent", "bg-accent", "Hover rows"],
  ["primary", "bg-primary", "Brand fill: primary buttons, checked controls"],
  ["primary-bright", "bg-primary-bright", "Live indicators, hover links, active nav"],
  ["destructive", "bg-destructive", "Errors, offline, destructive actions"],
] as const

const text = [
  ["foreground", "text-foreground", "Default text"],
  ["muted-foreground", "text-muted-foreground", "Secondary text, labels, table headers"],
  ["primary", "text-primary", "Links"],
  ["primary-bright", "text-primary-bright", "Link hover, gains, online"],
  ["destructive", "text-destructive", "Losses, offline, errors"],
] as const

const lines = [
  ["border", "border-border", "Every hairline"],
  ["input", "border-input", "Form control borders"],
  ["ring", "border-ring", "Focus ring at 50%"],
] as const

const charts = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"] as const

const tiers = [
  ["recruit", "bg-tier-recruit"],
  ["regular", "bg-tier-regular"],
  ["veteran", "bg-tier-veteran"],
  ["elite", "bg-tier-elite"],
  ["legend", "bg-tier-legend"],
] as const

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="border-b pb-2 text-3xl font-semibold">{title}</h2>
      {children}
    </section>
  )
}

export const Tokens: Story = {
  render: () => (
    <div className="flex w-4xl flex-col gap-8">
      <Section title="Surfaces">
        <div className="grid grid-cols-3 gap-3">
          {surfaces.map(([name, className, usage]) => (
            <div key={name} className="flex flex-col gap-1.5">
              <div className={`h-14 rounded-xl border ${className}`} />
              <span className="font-medium">{name}</span>
              <span className="text-xs text-muted-foreground">{usage}</span>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Text">
        <div className="grid grid-cols-3 gap-3">
          {text.map(([name, className, usage]) => (
            <div key={name} className="flex flex-col gap-0.5 rounded-xl border bg-card px-4 py-3">
              <span className={`text-xl font-bold ${className}`}>Aa 1,284</span>
              <span className="font-medium">{name}</span>
              <span className="text-xs text-muted-foreground">{usage}</span>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Lines">
        <div className="grid grid-cols-3 gap-3">
          {lines.map(([name, className, usage]) => (
            <div key={name} className="flex flex-col gap-1.5">
              <div className={`h-9 rounded-md border-2 ${className}`} />
              <span className="font-medium">{name}</span>
              <span className="text-xs text-muted-foreground">{usage}</span>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Charts">
        <p className="text-muted-foreground">
          One green ramp in the terminal theme, lightest first. Rank series by lightness; do not use
          two steps as unrelated categories.
        </p>
        <div className="flex h-6 gap-0.5">
          {charts.map((className) => (
            <div key={className} className={`flex-1 ${className}`} />
          ))}
        </div>
      </Section>
      <Section title="Tiers">
        <p className="text-muted-foreground">
          Ladder colours. Set the five <code>--tier-*</code> variables on any ancestor to switch
          palettes; see Foundations / Tier palettes.
        </p>
        <div className="grid grid-cols-5 gap-3">
          {tiers.map(([name, className]) => (
            <div key={name} className="flex flex-col gap-1.5">
              <div className={`h-10 ${className}`} />
              <span className="font-medium capitalize">{name}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  ),
}
