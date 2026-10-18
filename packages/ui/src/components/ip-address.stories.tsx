import type { Meta, StoryObj } from "@storybook/react-vite"
import { IPAddress, Port } from "./ip-address"
import { Label } from "./label"

const meta = {
  title: "Components/IP Address",
  component: IPAddress,
  tags: ["autodocs"],
  args: { className: "w-48", mode: "ip-address", name: "address", disabled: false },
  argTypes: {
    mode: { control: "select", options: ["ip-address", "docker-host"] },
  },
} satisfies Meta<typeof IPAddress>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithDefaultValue: Story = { args: { defaultValue: "203.0.113.42" } }

export const DockerHost: Story = {
  args: { mode: "docker-host", defaultValue: "hlds-cstrike" },
}

export const Disabled: Story = { args: { disabled: true, defaultValue: "203.0.113.42" } }

export const PortField: Story = {
  render: () => <Port name="port" defaultValue="27015" className="w-28" />,
}

export const AddressAndPort: Story = {
  render: (args) => (
    <div className="flex items-end gap-2">
      <div className="grid gap-2">
        <Label htmlFor="server-address">Address</Label>
        <IPAddress id="server-address" {...args} defaultValue="203.0.113.42" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="server-port">Port</Label>
        <Port id="server-port" name="port" defaultValue="27015" className="w-24" />
      </div>
    </div>
  ),
}
