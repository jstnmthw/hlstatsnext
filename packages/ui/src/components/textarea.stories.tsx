import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { Label } from "./label"
import { Textarea } from "./textarea"

const meta = {
  title: "Components/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  args: {
    className: "w-80",
    placeholder: "Reason for the ban",
    disabled: false,
    onChange: fn(),
  },
} satisfies Meta<typeof Textarea>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithLabel: Story = {
  render: (args) => (
    <div className="grid gap-2">
      <Label htmlFor="ban-reason" required>
        Ban reason
      </Label>
      <Textarea id="ban-reason" {...args} />
    </div>
  ),
}

export const WithValue: Story = {
  args: {
    defaultValue: "Wallhack on de_inferno, confirmed by two admins. Demo attached to the report.",
  },
}

export const Disabled: Story = { args: { disabled: true, defaultValue: "Read only" } }

export const Invalid: Story = { args: { "aria-invalid": true, defaultValue: "cheater" } }
