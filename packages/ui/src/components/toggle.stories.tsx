import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconBold, IconEye, IconStar } from "@tabler/icons-react"
import { fn } from "storybook/test"
import { Toggle } from "./toggle"

const meta = {
  title: "Components/Toggle",
  component: Toggle,
  tags: ["autodocs"],
  args: { children: "Online only", "aria-label": "Online only", onPressedChange: fn() },
  argTypes: {
    variant: { control: "select", options: ["default", "outline"] },
    size: { control: "select", options: ["sm", "default", "lg"] },
  },
} satisfies Meta<typeof Toggle>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Outline: Story = { args: { variant: "outline" } }

export const Pressed: Story = { args: { variant: "outline", defaultPressed: true } }

export const WithIcon: Story = {
  args: {
    variant: "outline",
    children: (
      <>
        <IconEye />
        Watch
      </>
    ),
  },
}

export const IconOnly: Story = {
  args: { children: <IconStar />, "aria-label": "Favourite" },
}

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <Toggle {...args} variant="outline" size="sm">
        Small
      </Toggle>
      <Toggle {...args} variant="outline" size="default">
        Default
      </Toggle>
      <Toggle {...args} variant="outline" size="lg">
        Large
      </Toggle>
      <Toggle {...args} variant="outline" size="lg" aria-label="Bold">
        <IconBold />
      </Toggle>
    </div>
  ),
}

export const Disabled: Story = { args: { variant: "outline", disabled: true } }
