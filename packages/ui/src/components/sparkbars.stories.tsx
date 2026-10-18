import type { Meta, StoryObj } from "@storybook/react-vite"
import { Sparkbars, SparkbarsAxis } from "./sparkbars"

const hours = [9, 6, 4, 3, 2, 2, 3, 5, 7, 8, 9, 11, 13, 12, 12, 14, 17, 21, 25, 28, 30, 31, 24, 18]

const meta = {
  title: "Components/Sparkbars",
  component: Sparkbars,
  tags: ["autodocs"],
  args: {
    values: hours,
    max: 32,
    highlightLast: true,
    className: "w-md",
    "aria-label":
      "Players per hour over the last 24 hours, quiet overnight, climbing from 17:00 to a peak of 31 at 21:00",
    titles: (value, index) => `${String(index).padStart(2, "0")}:00 · ${value} players`,
  },
} satisfies Meta<typeof Sparkbars>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithAxis: Story = {
  render: (args) => (
    <div className="flex w-md flex-col gap-2">
      <Sparkbars {...args} />
      <SparkbarsAxis>
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>now</span>
      </SparkbarsAxis>
    </div>
  ),
}

export const Thresholds: Story = {
  args: {
    barClassName: (value) =>
      value >= 24 ? "bg-chart-2" : value >= 12 ? "bg-chart-3" : "bg-chart-4",
  },
}

export const SkillHistory: Story = {
  args: {
    values: [
      1604, 1611, 1620, 1618, 1633, 1649, 1657, 1672, 1698, 1710, 1721, 1719, 1735, 1748, 1752,
      1766, 1780, 1771, 1740, 1738, 1755, 1769, 1784, 1790, 1802, 1811, 1819, 1826, 1835, 1842,
    ].map((v) => v - 1580),
    max: 280,
    titles: undefined,
    "aria-label": "Daily skill over the last 30 days, rising from 1,604 to 1,842",
  },
}
