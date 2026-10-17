import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconPlus, IconTrash } from "@tabler/icons-react"
import { fn } from "storybook/test"
import { colorSchemes } from "../lib/color-variants"
import { Button } from "./button"

const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  args: {
    children: "Button",
    variant: "primary",
    size: "default",
    colorScheme: "dark/white",
    disabled: false,
    onClick: fn(),
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "destructive", "solid", "outline", "ghost"],
    },
    size: {
      control: "select",
      options: [
        "xs",
        "sm",
        "default",
        "lg",
        "xl",
        "icon-xs",
        "icon-sm",
        "icon",
        "icon-lg",
        "icon-xl",
      ],
    },
    colorScheme: { control: "select", options: colorSchemes },
  },
} satisfies Meta<typeof Button>

export default meta

type Story = StoryObj<typeof meta>

export const Primary: Story = {}

export const Secondary: Story = { args: { variant: "secondary" } }

export const Destructive: Story = { args: { variant: "destructive" } }

export const Outline: Story = { args: { variant: "outline", colorScheme: "blue" } }

export const Ghost: Story = { args: { variant: "ghost", colorScheme: "blue" } }

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <IconPlus />
        Add server
      </>
    ),
  },
}

export const IconOnly: Story = {
  args: { size: "icon", "aria-label": "Delete", children: <IconTrash /> },
}

export const Disabled: Story = { args: { disabled: true } }

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2">
      <Button {...args} size="xs">
        Extra small
      </Button>
      <Button {...args} size="sm">
        Small
      </Button>
      <Button {...args} size="default">
        Default
      </Button>
      <Button {...args} size="lg">
        Large
      </Button>
      <Button {...args} size="xl">
        Extra large
      </Button>
    </div>
  ),
}

export const ColorSchemes: Story = {
  args: { variant: "solid" },
  render: (args) => (
    <div className="flex max-w-xl flex-wrap gap-2">
      {colorSchemes.map((colorScheme) => (
        <Button key={colorScheme} {...args} colorScheme={colorScheme}>
          {colorScheme}
        </Button>
      ))}
    </div>
  ),
}
