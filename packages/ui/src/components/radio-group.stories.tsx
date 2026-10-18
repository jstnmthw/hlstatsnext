import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { Label } from "./label"
import { RadioGroup, RadioGroupItem } from "./radio-group"

const rankingModes = [
  { value: "skill", label: "Skill" },
  { value: "kills", label: "Kills" },
  { value: "kd", label: "Kill/death ratio" },
]

const meta = {
  title: "Components/Radio Group",
  component: RadioGroup,
  tags: ["autodocs"],
  args: { defaultValue: "skill", disabled: false, onValueChange: fn() },
  render: (args) => (
    <RadioGroup {...args}>
      {rankingModes.map((mode) => (
        <div key={mode.value} className="flex items-center gap-2">
          <RadioGroupItem value={mode.value} id={`ranking-${mode.value}`} />
          <Label htmlFor={`ranking-${mode.value}`}>{mode.label}</Label>
        </div>
      ))}
    </RadioGroup>
  ),
} satisfies Meta<typeof RadioGroup>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Horizontal: Story = { args: { className: "flex gap-6" } }

export const Disabled: Story = { args: { disabled: true } }

export const Invalid: Story = {
  args: { defaultValue: undefined },
  render: (args) => (
    <div className="grid gap-3">
      <RadioGroup {...args} aria-invalid>
        {rankingModes.map((mode) => (
          <div key={mode.value} className="flex items-center gap-2">
            <RadioGroupItem aria-invalid value={mode.value} id={`invalid-${mode.value}`} />
            <Label htmlFor={`invalid-${mode.value}`}>{mode.label}</Label>
          </div>
        ))}
      </RadioGroup>
      <p className="text-sm text-destructive">Choose a ranking mode</p>
    </div>
  ),
}

export const WithDescriptions: Story = {
  args: { defaultValue: "public" },
  render: (args) => (
    <RadioGroup {...args} className="max-w-sm">
      <div className="flex items-start gap-3">
        <RadioGroupItem value="public" id="visibility-public" className="mt-0.5" />
        <div className="grid gap-1">
          <Label htmlFor="visibility-public">Public</Label>
          <p className="text-sm text-muted-foreground">
            Anyone can browse this server and its leaderboard.
          </p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <RadioGroupItem value="unlisted" id="visibility-unlisted" className="mt-0.5" />
        <div className="grid gap-1">
          <Label htmlFor="visibility-unlisted">Unlisted</Label>
          <p className="text-sm text-muted-foreground">
            Hidden from the server list but reachable by link.
          </p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <RadioGroupItem value="private" id="visibility-private" className="mt-0.5" />
        <div className="grid gap-1">
          <Label htmlFor="visibility-private">Private</Label>
          <p className="text-sm text-muted-foreground">Only admins can see this server.</p>
        </div>
      </div>
    </RadioGroup>
  ),
}
