import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconCopy, IconSearch, IconSend } from "@tabler/icons-react"
import { fn } from "storybook/test"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "./input-group"
import { Kbd } from "./kbd"

const meta = {
  title: "Components/Input Group",
  component: InputGroup,
  tags: ["autodocs"],
  args: { className: "w-80" },
} satisfies Meta<typeof InputGroup>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <InputGroup {...args}>
      <InputGroupInput type="search" placeholder="Search players" />
      <InputGroupAddon>
        <IconSearch />
      </InputGroupAddon>
      <InputGroupAddon align="inline-end">
        <Kbd>/</Kbd>
      </InputGroupAddon>
    </InputGroup>
  ),
}

export const WithButton: Story = {
  render: (args) => (
    <InputGroup {...args}>
      <InputGroupInput readOnly defaultValue="203.0.113.42:27015" className="font-mono" />
      <InputGroupAddon align="inline-end">
        <InputGroupButton size="icon-xs" aria-label="Copy address" onClick={fn()}>
          <IconCopy />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  ),
}

export const WithText: Story = {
  render: (args) => (
    <InputGroup {...args}>
      <InputGroupAddon>
        <InputGroupText>steam://connect/</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput placeholder="203.0.113.42:27015" className="font-mono" />
    </InputGroup>
  ),
}

export const WithTextarea: Story = {
  render: (args) => (
    <InputGroup {...args}>
      <InputGroupTextarea placeholder="Reason for the ban" />
      <InputGroupAddon align="block-end">
        <InputGroupText>Shown to the player on kick</InputGroupText>
        <InputGroupButton variant="primary" size="sm" className="ml-auto" onClick={fn()}>
          <IconSend />
          Submit
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className="grid w-80 gap-3">
      <InputGroup className="h-8">
        <InputGroupInput placeholder="Small" />
        <InputGroupAddon>
          <IconSearch />
        </InputGroupAddon>
      </InputGroup>
      <InputGroup>
        <InputGroupInput placeholder="Default" />
        <InputGroupAddon>
          <IconSearch />
        </InputGroupAddon>
      </InputGroup>
      <InputGroup className="h-12">
        <InputGroupInput placeholder="Large" />
        <InputGroupAddon>
          <IconSearch />
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
}

export const Invalid: Story = {
  render: (args) => (
    <InputGroup {...args}>
      <InputGroupInput aria-invalid defaultValue="999.0.113.42" className="font-mono" />
      <InputGroupAddon align="inline-end">
        <InputGroupText>:27015</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  ),
}

export const Disabled: Story = {
  render: (args) => (
    <InputGroup {...args} data-disabled="true">
      <InputGroupInput disabled placeholder="Search players" />
      <InputGroupAddon>
        <IconSearch />
      </InputGroupAddon>
    </InputGroup>
  ),
}
