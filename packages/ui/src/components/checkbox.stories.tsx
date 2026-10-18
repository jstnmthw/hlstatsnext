import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { Checkbox } from "./checkbox"
import { Label } from "./label"

const meta = {
  title: "Components/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  args: { disabled: false, onCheckedChange: fn() },
} satisfies Meta<typeof Checkbox>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Checked: Story = { args: { defaultChecked: true } }

export const Disabled: Story = { args: { disabled: true } }

export const WithLabel: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <Checkbox id="remember-me" {...args} />
      <Label htmlFor="remember-me">Remember me</Label>
    </div>
  ),
}

export const WithDescription: Story = {
  render: (args) => (
    <div className="flex max-w-sm items-start gap-3">
      <Checkbox id="rank-alerts" defaultChecked className="mt-0.5" {...args} />
      <div className="grid gap-1">
        <Label htmlFor="rank-alerts">Rank change alerts</Label>
        <p className="text-sm text-muted-foreground">
          Email me when one of my claimed players moves up or down the ladder.
        </p>
      </div>
    </div>
  ),
}

export const ChoiceCard: Story = {
  render: (args) => (
    <Label className="max-w-sm items-start gap-3 rounded-lg border p-3 hover:bg-accent/50 has-aria-checked:border-primary has-aria-checked:bg-primary/10">
      <Checkbox defaultChecked className="mt-0.5" {...args} />
      <span className="grid gap-1 font-normal">
        <span className="leading-none font-medium">Weekly digest</span>
        <span className="text-sm text-muted-foreground">
          Kills, skill and awards for your players, every Monday morning.
        </span>
      </span>
    </Label>
  ),
}
