import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  IconCalendar,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconCopy,
} from "@tabler/icons-react"
import { fn } from "storybook/test"
import { Button } from "./button"
import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from "./button-group"

const meta = {
  title: "Components/Button Group",
  component: ButtonGroup,
  tags: ["autodocs"],
  args: { orientation: "horizontal" },
  argTypes: {
    orientation: { control: "select", options: ["horizontal", "vertical"] },
  },
} satisfies Meta<typeof ButtonGroup>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <ButtonGroup {...args}>
      <Button variant="outline">24 hours</Button>
      <Button variant="outline">7 days</Button>
      <Button variant="outline">30 days</Button>
      <Button variant="outline">All time</Button>
    </ButtonGroup>
  ),
}

export const Vertical: Story = {
  args: { orientation: "vertical" },
  render: (args) => (
    <ButtonGroup {...args}>
      <Button variant="outline">Kills</Button>
      <Button variant="outline">Deaths</Button>
      <Button variant="outline">Skill</Button>
    </ButtonGroup>
  ),
}

export const WithText: Story = {
  render: (args) => (
    <ButtonGroup {...args}>
      <ButtonGroupText className="font-mono">203.0.113.42:27015</ButtonGroupText>
      <Button variant="outline" size="icon" aria-label="Copy address" onClick={fn()}>
        <IconCopy />
      </Button>
    </ButtonGroup>
  ),
}

export const WithSeparator: Story = {
  render: (args) => (
    <ButtonGroup {...args}>
      <Button variant="secondary">Ban player</Button>
      <ButtonGroupSeparator />
      <Button variant="secondary" size="icon" aria-label="More ban options">
        <IconChevronDown />
      </Button>
    </ButtonGroup>
  ),
}

export const DayPicker: Story = {
  render: (args) => (
    <ButtonGroup {...args}>
      <Button variant="outline" size="icon" aria-label="Previous day" onClick={fn()}>
        <IconChevronLeft />
      </Button>
      <Button variant="outline" onClick={fn()}>
        <IconCalendar />
        18 Oct 2026
      </Button>
      <Button variant="outline" size="icon" aria-label="Next day" onClick={fn()}>
        <IconChevronRight />
      </Button>
    </ButtonGroup>
  ),
}

export const Nested: Story = {
  render: (args) => (
    <ButtonGroup {...args}>
      <ButtonGroup>
        <Button variant="outline" size="icon" aria-label="Previous page">
          <IconChevronLeft />
        </Button>
        <Button variant="outline" size="icon" aria-label="Next page">
          <IconChevronRight />
        </Button>
      </ButtonGroup>
      <ButtonGroup>
        <Button variant="outline">Export</Button>
      </ButtonGroup>
    </ButtonGroup>
  ),
}
