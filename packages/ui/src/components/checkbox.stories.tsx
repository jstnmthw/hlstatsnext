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
