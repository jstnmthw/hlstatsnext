import type { Meta, StoryObj } from "@storybook/react-vite"
import { Trend } from "./trend"

const meta = {
  title: "Components/Trend",
  component: Trend,
  tags: ["autodocs"],
  args: { value: 9 },
  argTypes: {
    direction: { control: "select", options: [undefined, "up", "down", "flat"] },
  },
} satisfies Meta<typeof Trend>

export default meta

type Story = StoryObj<typeof meta>

export const Up: Story = {}

export const Down: Story = { args: { value: -1 } }

export const Flat: Story = { args: { value: 0 } }

export const WithText: Story = {
  args: { value: undefined, direction: "up", showArrow: false, children: "+22% vs daily avg" },
}

export const ArrowWithText: Story = {
  args: { value: undefined, direction: "up", children: "9 this week" },
}

export const SignedDelta: Story = {
  args: { value: 24, showArrow: false, format: (n) => `+${n}` },
}

export const InARow: Story = {
  render: () => (
    <div className="flex flex-col gap-1 tabular-nums">
      {[
        ["Hazel", 0],
        ["drexx", 1],
        ["Mintcake", -1],
        ["Vantablack", 4],
      ].map(([name, delta]) => (
        <div key={name} className="grid w-56 grid-cols-[1fr_auto] gap-4">
          <span>{name}</span>
          <Trend value={delta as number} />
        </div>
      ))}
    </div>
  ),
}
