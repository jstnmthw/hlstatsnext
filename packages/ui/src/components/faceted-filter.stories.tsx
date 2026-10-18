import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { fn } from "storybook/test"
import { FacetedFilter, type FacetedFilterProps } from "./faceted-filter"
import { FlagIcon } from "./flag-icon"

const tierOptions = [
  { value: "legend", label: "Legend", count: 32, className: "text-tier-legend" },
  { value: "elite", label: "Elite", count: 139, className: "text-tier-elite" },
  { value: "veteran", label: "Veteran", count: 341, className: "text-tier-veteran" },
  { value: "regular", label: "Regular", count: 702, className: "text-tier-regular" },
  { value: "recruit", label: "Recruit", count: "1,204", className: "text-tier-recruit" },
]

const countryOptions = [
  ["th", "Thailand", "1,318"],
  ["de", "Germany", 141],
  ["se", "Sweden", 96],
  ["jp", "Japan", 88],
  ["pl", "Poland", 61],
  ["fr", "France", 44],
  ["au", "Australia", 39],
  ["gb", "United Kingdom", 30],
].map(([code, name, count]) => ({
  value: String(code),
  keywords: String(name),
  count,
  label: (
    <span className="inline-flex items-center gap-2">
      <FlagIcon code={String(code)} name={String(name)} />
      {name}
    </span>
  ),
}))

const meta = {
  title: "Components/Faceted Filter",
  component: FacetedFilter,
  tags: ["autodocs"],
  args: {
    title: "Tier",
    options: tierOptions,
    value: ["veteran", "elite"],
    onValueChange: fn(),
  },
  argTypes: {
    size: { control: "select", options: ["xs", "sm", "default"] },
  },
} satisfies Meta<typeof FacetedFilter>

export default meta

type Story = StoryObj<typeof meta>

function Controlled(props: FacetedFilterProps) {
  const [value, setValue] = useState(props.value)

  return (
    <FacetedFilter
      {...props}
      value={value}
      onValueChange={(next) => {
        setValue(next)
        props.onValueChange(next)
      }}
    />
  )
}

export const Default: Story = {
  render: (args) => <Controlled {...args} />,
}

export const Empty: Story = {
  args: { value: [] },
  render: (args) => <Controlled {...args} />,
}

export const ManySelected: Story = {
  args: { value: ["legend", "elite", "veteran"] },
  render: (args) => <Controlled {...args} />,
}

export const WithSearch: Story = {
  args: { title: "Country", options: countryOptions, value: [], searchPlaceholder: "Country" },
  render: (args) => <Controlled {...args} />,
}

export const Disabled: Story = { args: { disabled: true } }
