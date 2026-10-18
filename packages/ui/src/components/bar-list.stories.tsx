import type { Meta, StoryObj } from "@storybook/react-vite"
import { Badge } from "./badge"
import { BarList, BarListFooter, BarListRow } from "./bar-list"

const meta = {
  title: "Components/Bar List",
  component: BarList,
  tags: ["autodocs"],
  args: { className: "w-md" },
} satisfies Meta<typeof BarList>

export default meta

type Story = StoryObj<typeof meta>

const weapons = [
  ["AK-47", 100, "231", "52%", "bg-chart-1"],
  ["M4A1", 71, "164", "49%", "bg-chart-2"],
  ["AWP", 51, "118", "31%", "bg-chart-3"],
  ["Deagle", 42, "97", "64%", "bg-chart-4"],
  ["USP", 23, "52", "58%", "bg-chart-5"],
  ["Knife", 9, "21", "—", "bg-chart-5"],
] as const

export const Weapons: Story = {
  render: (args) => (
    <BarList {...args}>
      {weapons.map(([name, percent, kills, hs, fill]) => (
        <BarListRow
          key={name}
          label={name}
          percent={percent}
          value={kills}
          meta={hs}
          indicatorClassName={fill}
        />
      ))}
      <BarListFooter>
        <span />
        <span />
        <span>kills</span>
        <span>hs %</span>
      </BarListFooter>
    </BarList>
  ),
}

export const CustomColumns: Story = {
  render: (args) => (
    <BarList {...args} className="w-md [--bar-list-columns:110px_minmax(0,1fr)_44px_56px]">
      <BarListRow
        label={
          <>
            de_dust2
            <Badge variant="live" className="h-3.5 px-1">
              now
            </Badge>
          </>
        }
        percent={100}
        value="58%"
        meta="16.1"
        indicatorClassName="bg-chart-1"
      />
      <BarListRow
        label="de_inferno"
        percent={31}
        value="18%"
        meta="12.4"
        indicatorClassName="bg-chart-2"
      />
      <BarListRow
        label="de_nuke"
        percent={19}
        value="11%"
        meta="10.8"
        indicatorClassName="bg-chart-3"
      />
      <BarListRow
        label="de_train"
        percent={14}
        value="8%"
        meta="9.2"
        indicatorClassName="bg-chart-4"
      />
      <BarListFooter>
        <span />
        <span />
        <span>time</span>
        <span>avg players</span>
      </BarListFooter>
    </BarList>
  ),
}
