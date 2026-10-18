import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
  title: "Foundations/Typography",
  parameters: { layout: "padded" },
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

const roles = [
  ["Page title", "text-5xl font-bold", "26 / 34 · 700"],
  ["Section title", "text-3xl font-semibold", "22 / 30 · 600"],
  ["Subsection", "text-xl font-medium", "16 / 26 · 500"],
  ["Card title", "text-lg leading-5 font-bold uppercase", "14 / 20 · 700 · uppercase"],
  ["Body", "text-base", "12 / 20 · 400"],
  ["Table cell", "text-base font-light", "12 / 20 · 300"],
  ["Label", "text-base font-medium", "12 / 20 · 500"],
  ["Button", "text-base font-semibold", "12 / 20 · 600"],
  ["Badge", "text-xs font-medium", "10 / 16 · 500"],
  ["Caption", "text-xs text-muted-foreground", "10 / 16 · muted"],
  [
    "Stat label",
    "text-xs font-medium uppercase text-muted-foreground",
    "10 / 16 · 500 · uppercase",
  ],
  ["Stat value", "text-3xl font-bold tabular-nums", "22 / 30 · 700 · tabular"],
  ["Wordmark", "text-base font-bold tracking-tight uppercase", "12 / 20 · 700 · -0.025em"],
] as const

const scale = [
  ["text-xs", "10 / 16"],
  ["text-sm", "11 / 18"],
  ["text-base", "12 / 20"],
  ["text-lg", "14 / 24"],
  ["text-xl", "16 / 26"],
  ["text-2xl", "18 / 28"],
  ["text-3xl", "22 / 30"],
  ["text-4xl", "24 / 32"],
  ["text-5xl", "26 / 34"],
  ["text-6xl", "28 / 36"],
  ["text-7xl", "30 / 38"],
  ["text-8xl", "32 / 40"],
  ["text-9xl", "34 / 42"],
] as const

export const Roles: Story = {
  render: () => (
    <div className="flex w-4xl flex-col divide-y">
      {roles.map(([name, className, spec]) => (
        <div key={name} className="grid grid-cols-[160px_1fr_200px] items-baseline gap-6 py-3">
          <span className="text-muted-foreground">{name}</span>
          <span className={className}>Hazel holds #1 · 2,914 skill</span>
          <code className="text-xs text-muted-foreground">{spec}</code>
        </div>
      ))}
    </div>
  ),
}

export const Scale: Story = {
  render: () => (
    <div className="flex w-4xl flex-col divide-y">
      <p className="pb-3 text-muted-foreground">
        JetBrains Mono everywhere. The whole scale is overridden so the base is 12px and the largest
        stop is 34px: small by web standards, right for a data console.
      </p>
      {scale.map(([className, spec]) => (
        <div key={className} className="grid grid-cols-[120px_1fr_80px] items-baseline gap-6 py-2">
          <code className="text-xs text-muted-foreground">{className}</code>
          <span className={className}>Counter-Strike 1.6 rankings</span>
          <code className="text-xs text-muted-foreground">{spec}</code>
        </div>
      ))}
    </div>
  ),
}

export const Numbers: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">
        Figures use <code>tabular-nums</code> so columns align; addresses and ports use the mono
        stack at weight 500.
      </p>
      <div className="grid w-80 grid-cols-2 gap-x-6 tabular-nums">
        <span className="text-muted-foreground">Kills</span>
        <span className="text-right font-medium">1,208</span>
        <span className="text-muted-foreground">Deaths</span>
        <span className="text-right font-medium">501</span>
        <span className="text-muted-foreground">K/D</span>
        <span className="text-right font-medium">2.41</span>
      </div>
      <span>
        <span className="font-mono font-medium">203.0.113.42</span>
        <span className="font-mono font-medium text-muted-foreground">:27015</span>
      </span>
    </div>
  ),
}
