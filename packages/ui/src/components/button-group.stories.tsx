import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  IconCalendar,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconCopy,
  IconMinus,
  IconPlus,
} from "@tabler/icons-react"
import { useState, type ComponentProps } from "react"
import { fn } from "storybook/test"
import { Button } from "./button"
import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from "./button-group"
import { Field, FieldContent, FieldDescription, FieldLabel } from "./field"
import { Input } from "./input"

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

function RankingWindow(props: ComponentProps<typeof ButtonGroup>) {
  const [days, setDays] = useState(30)
  const adjust = (delta: number) => setDays((d) => Math.min(365, Math.max(1, d + delta)))

  return (
    <Field orientation="horizontal" className="max-w-md">
      <FieldContent>
        <FieldLabel htmlFor="ranking-window">Ranking window</FieldLabel>
        <FieldDescription>Days of play that count towards skill.</FieldDescription>
      </FieldContent>
      <ButtonGroup {...props}>
        <Input
          id="ranking-window"
          value={days}
          onChange={(event) => {
            const next = Number(event.target.value)
            if (Number.isInteger(next) && next >= 1 && next <= 365) setDays(next)
          }}
          size={3}
          maxLength={3}
          inputMode="numeric"
          className="text-center tabular-nums"
        />
        <Button
          variant="outline"
          size="icon"
          aria-label="Fewer days"
          onClick={() => adjust(-1)}
          disabled={days <= 1}
        >
          <IconMinus />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="More days"
          onClick={() => adjust(1)}
          disabled={days >= 365}
        >
          <IconPlus />
        </Button>
      </ButtonGroup>
    </Field>
  )
}

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

export const Stepper: Story = {
  render: (args) => <RankingWindow {...args} />,
}
