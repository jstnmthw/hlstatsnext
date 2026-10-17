import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { Input } from "./input"
import { Label } from "./label"

const meta = {
  title: "Components/Input",
  component: Input,
  tags: ["autodocs"],
  args: {
    className: "w-72",
    placeholder: "Search players…",
    type: "text",
    disabled: false,
    onChange: fn(),
  },
  argTypes: {
    type: {
      control: "select",
      options: ["text", "email", "password", "number", "search", "url"],
    },
  },
} satisfies Meta<typeof Input>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithLabel: Story = {
  render: (args) => (
    <div className="grid gap-2">
      <Label htmlFor="player-name" required>
        Player name
      </Label>
      <Input id="player-name" {...args} />
    </div>
  ),
}

export const Disabled: Story = { args: { disabled: true, defaultValue: "Read only" } }

export const Invalid: Story = { args: { "aria-invalid": true, defaultValue: "not-an-ip" } }
