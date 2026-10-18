import type { Meta, StoryObj } from "@storybook/react-vite"
import { Progress } from "./progress"

const meta = {
  title: "Components/Progress",
  component: Progress,
  tags: ["autodocs"],
  args: { value: 56, "aria-label": "18 of 32 slots filled", className: "w-72" },
  argTypes: {
    size: { control: "select", options: ["sm", "default", "lg", "xl"] },
    value: { control: { type: "range", min: 0, max: 100 } },
  },
} satisfies Meta<typeof Progress>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Sizes: Story = {
  render: (args) => (
    <div className="flex w-72 flex-col gap-4">
      <Progress {...args} size="sm" />
      <Progress {...args} size="default" />
      <Progress {...args} size="lg" />
      <Progress {...args} size="xl" />
    </div>
  ),
}

export const Coloured: Story = {
  args: { indicatorClassName: "bg-primary-bright" },
}

export const TierProgress: Story = {
  render: (args) => (
    <div className="flex w-80 flex-col gap-1.5">
      <div className="flex justify-between text-xs">
        <span className="font-medium text-tier-veteran">Veteran · 1,500</span>
        <span className="font-medium text-tier-elite">Elite · 2,000</span>
      </div>
      <Progress
        {...args}
        value={68}
        size="xl"
        aria-label="68% of the way from Veteran to Elite"
        indicatorStyle={{
          background: "linear-gradient(90deg, var(--tier-veteran), var(--tier-elite))",
        }}
      />
      <span>
        <strong className="font-bold text-tier-elite">158 skill to Elite.</strong>{" "}
        <span className="text-muted-foreground">At this week&apos;s pace, about 6 days.</span>
      </span>
    </div>
  ),
}

export const WithValue: Story = {
  render: (args) => (
    <div className="flex w-72 items-center gap-2">
      <Progress {...args} className="flex-1" />
      <span className="w-13 text-right font-medium tabular-nums">18 / 32</span>
    </div>
  ),
}
