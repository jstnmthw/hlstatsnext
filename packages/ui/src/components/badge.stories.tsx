import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconCircleCheck } from "@tabler/icons-react"
import { colorSchemes } from "../lib/color-variants"
import { Badge } from "./badge"

const meta = {
  title: "Components/Badge",
  component: Badge,
  tags: ["autodocs"],
  args: {
    children: "Badge",
    variant: "primary",
    colorScheme: "dark/white",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "destructive", "solid", "outline", "ghost"],
    },
    colorScheme: { control: "select", options: colorSchemes },
  },
} satisfies Meta<typeof Badge>

export default meta

type Story = StoryObj<typeof meta>

export const Primary: Story = {}

export const Secondary: Story = { args: { variant: "secondary" } }

export const Destructive: Story = { args: { variant: "destructive" } }

export const WithIcon: Story = {
  args: {
    variant: "solid",
    colorScheme: "green",
    children: (
      <>
        <IconCircleCheck />
        Online
      </>
    ),
  },
}

export const Variants: Story = {
  args: { colorScheme: "blue" },
  render: (args) => (
    <div className="flex gap-2">
      <Badge {...args} variant="solid">
        Solid
      </Badge>
      <Badge {...args} variant="outline">
        Outline
      </Badge>
      <Badge {...args} variant="ghost">
        Ghost
      </Badge>
    </div>
  ),
}

export const ColorSchemes: Story = {
  args: { variant: "solid" },
  render: (args) => (
    <div className="flex max-w-xl flex-wrap gap-2">
      {colorSchemes.map((colorScheme) => (
        <Badge key={colorScheme} {...args} colorScheme={colorScheme}>
          {colorScheme}
        </Badge>
      ))}
    </div>
  ),
}
