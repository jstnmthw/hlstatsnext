import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { Label } from "./label"
import { Switch } from "./switch"

const meta = {
  title: "Components/Switch",
  component: Switch,
  tags: ["autodocs"],
  args: { disabled: false, onCheckedChange: fn() },
} satisfies Meta<typeof Switch>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Checked: Story = { args: { defaultChecked: true } }

export const Disabled: Story = { args: { disabled: true } }

export const WithLabel: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <Switch id="rcon-enabled" {...args} />
      <Label htmlFor="rcon-enabled">RCON enabled</Label>
    </div>
  ),
}
