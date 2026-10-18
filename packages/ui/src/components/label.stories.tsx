import type { Meta, StoryObj } from "@storybook/react-vite"
import { Checkbox } from "./checkbox"
import { Input } from "./input"
import { Label } from "./label"

const meta = {
  title: "Components/Label",
  component: Label,
  tags: ["autodocs"],
  args: { children: "Server name", required: false },
} satisfies Meta<typeof Label>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Required: Story = { args: { required: true } }

export const WithInput: Story = {
  render: (args) => (
    <div className="grid w-72 gap-2">
      <Label htmlFor="server-name" {...args} />
      <Input id="server-name" placeholder="Bangkok 24/7 Dust2" />
    </div>
  ),
}

export const WithCheckbox: Story = {
  args: { children: "Public server" },
  render: (args) => (
    <div className="flex items-center gap-2">
      <Checkbox id="public-server" defaultChecked />
      <Label htmlFor="public-server" {...args} />
    </div>
  ),
}

export const Disabled: Story = {
  args: { children: "Steam ID" },
  render: (args) => (
    <div className="group grid w-72 gap-2" data-disabled="true">
      <Label htmlFor="steam-id" {...args} />
      <Input id="steam-id" disabled defaultValue="STEAM_0:1:12345678" className="font-mono" />
    </div>
  ),
}
