import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconPlus, IconSearch, IconTrash, IconX } from "@tabler/icons-react"
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
    disabled: false,
    onClick: fn(),
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "destructive", "outline", "ghost", "solid"],
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
    colorScheme: { control: "select", options: [undefined, ...colorSchemes] },
  },
} satisfies Meta<typeof Button>

export default meta

type Story = StoryObj<typeof meta>

export const Primary: Story = { args: { children: "Claim your player" } }

export const Secondary: Story = { args: { variant: "secondary", children: "Copy address" } }

export const Destructive: Story = { args: { variant: "destructive", children: "Delete server" } }

export const Outline: Story = { args: { variant: "outline", children: "View" } }

export const Ghost: Story = { args: { variant: "ghost", children: "Reset" } }

export const Semantic: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2">
      <Button {...args} variant="primary">
        Primary
      </Button>
      <Button {...args} variant="secondary">
        Secondary
      </Button>
      <Button {...args} variant="outline">
        Outline
      </Button>
      <Button {...args} variant="ghost">
        Ghost
      </Button>
      <Button {...args} variant="destructive">
        Destructive
      </Button>
    </div>
  ),
}

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

export const TrailingIcon: Story = {
  args: {
    variant: "ghost",
    size: "sm",
    children: (
      <>
        Reset
        <IconX />
      </>
    ),
  },
}

export const IconOnly: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <Button {...args} variant="ghost" size="icon" aria-label="Search players and servers">
        <IconSearch />
      </Button>
      <Button {...args} variant="outline" size="icon-sm" aria-label="Delete">
        <IconTrash />
      </Button>
      <Button {...args} variant="destructive" size="icon" aria-label="Delete">
        <IconTrash />
      </Button>
    </div>
  ),
}

export const Disabled: Story = { args: { disabled: true } }

export const AsLink: Story = {
  args: { asChild: true, children: <a href="#">Go to my profile</a> },
}

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

export const ColorSchemeOutline: Story = {
  args: { variant: "outline" },
  render: (args) => (
    <div className="flex max-w-xl flex-wrap gap-2">
      {["green", "blue", "red", "amber", "light"].map((colorScheme) => (
        <Button
          key={colorScheme}
          {...args}
          colorScheme={colorScheme as (typeof colorSchemes)[number]}
        >
          {colorScheme}
        </Button>
      ))}
    </div>
  ),
}
