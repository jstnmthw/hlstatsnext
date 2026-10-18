import type { Meta, StoryObj } from "@storybook/react-vite"
import { StatusBadge } from "./status-badge"

const meta = {
  title: "Components/Status Badge",
  component: StatusBadge,
  tags: ["autodocs"],
  args: { status: "online" },
  argTypes: {
    status: { control: "select", options: ["online", "idle", "offline"] },
    pulse: { control: "boolean" },
  },
} satisfies Meta<typeof StatusBadge>

export default meta

type Story = StoryObj<typeof meta>

export const Online: Story = {}

export const Idle: Story = { args: { status: "idle" } }

export const Offline: Story = { args: { status: "offline" } }

export const WithoutPulse: Story = { args: { pulse: false } }

export const CustomLabel: Story = {
  args: { children: "39 players on now" },
}

export const All: Story = {
  render: () => (
    <div className="flex gap-2">
      <StatusBadge status="online" />
      <StatusBadge status="idle" />
      <StatusBadge status="offline" />
      <StatusBadge status="online" pulse={false}>
        In game
      </StatusBadge>
      <StatusBadge status="online" pulse={false}>
        Claimed
      </StatusBadge>
    </div>
  ),
}
