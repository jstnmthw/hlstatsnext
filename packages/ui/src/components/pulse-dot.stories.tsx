import type { Meta, StoryObj } from "@storybook/react-vite"
import { PulseDot } from "./pulse-dot"

const meta = {
  title: "Components/Pulse Dot",
  component: PulseDot,
  tags: ["autodocs"],
} satisfies Meta<typeof PulseDot>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const InLabel: Story = {
  render: () => (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
      <PulseDot />
      Now playing
    </span>
  ),
}

export const Larger: Story = { args: { className: "size-2.5" } }
