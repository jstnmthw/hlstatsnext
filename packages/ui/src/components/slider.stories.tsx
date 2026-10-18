import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState, type ComponentProps } from "react"
import { fn } from "storybook/test"
import { Label } from "./label"
import { Slider } from "./slider"

const meta = {
  title: "Components/Slider",
  component: Slider,
  tags: ["autodocs"],
  args: {
    className: "w-80",
    defaultValue: [32],
    min: 0,
    max: 64,
    step: 1,
    disabled: false,
    onValueChange: fn(),
  },
  argTypes: {
    orientation: { control: "select", options: ["horizontal", "vertical"] },
  },
} satisfies Meta<typeof Slider>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Range: Story = { args: { defaultValue: [16, 48] } }

export const Stepped: Story = { args: { step: 8, defaultValue: [24] } }

export const Disabled: Story = { args: { disabled: true } }

export const Vertical: Story = { args: { orientation: "vertical", className: "h-48" } }

function MaxPlayersSlider({
  defaultValue,
  onValueChange,
  ...props
}: ComponentProps<typeof Slider>) {
  const [value, setValue] = useState(defaultValue ?? [32])

  return (
    <div className="grid w-80 gap-3">
      <div className="flex items-center justify-between">
        <Label>Max players</Label>
        <span className="font-mono text-sm text-muted-foreground">{value[0]}</span>
      </div>
      <Slider
        {...props}
        className="w-full"
        value={value}
        onValueChange={(next) => {
          setValue(next)
          onValueChange?.(next)
        }}
      />
    </div>
  )
}

export const Controlled: Story = {
  render: (args) => <MaxPlayersSlider {...args} />,
}
