import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "./field"
import { Input } from "./input"
import { RadioGroup, RadioGroupItem } from "./radio-group"
import { Switch } from "./switch"

const meta = {
  title: "Components/Field",
  component: Field,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { orientation: "vertical" },
  argTypes: {
    orientation: { control: "select", options: ["vertical", "horizontal", "responsive"] },
  },
} satisfies Meta<typeof Field>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <FieldGroup className="max-w-md">
      <Field {...args}>
        <FieldLabel htmlFor="server-name">Server name</FieldLabel>
        <Input id="server-name" placeholder="Bangkok 24/7 Dust2" />
        <FieldDescription>Shown on the server list and in match history.</FieldDescription>
      </Field>
      <Field {...args}>
        <FieldLabel htmlFor="server-address">Address</FieldLabel>
        <Input id="server-address" defaultValue="203.0.113.42" className="font-mono" />
        <FieldDescription>The address the daemon receives log lines from.</FieldDescription>
      </Field>
    </FieldGroup>
  ),
}

export const Horizontal: Story = {
  args: { orientation: "horizontal" },
  render: (args) => (
    <Field {...args} className="max-w-md">
      <FieldContent>
        <FieldLabel htmlFor="rcon-enabled">RCON enabled</FieldLabel>
        <FieldDescription>Let the daemon send commands to this server.</FieldDescription>
      </FieldContent>
      <Switch id="rcon-enabled" defaultChecked />
    </Field>
  ),
}

export const WithFieldSet: Story = {
  render: () => (
    <FieldSet className="max-w-md">
      <FieldLegend>Ranking mode</FieldLegend>
      <FieldDescription>How players are ordered on the leaderboard.</FieldDescription>
      <RadioGroup defaultValue="skill">
        <Field orientation="horizontal">
          <RadioGroupItem value="skill" id="ranking-skill" />
          <FieldLabel htmlFor="ranking-skill" className="font-normal">
            Skill
          </FieldLabel>
        </Field>
        <Field orientation="horizontal">
          <RadioGroupItem value="kills" id="ranking-kills" />
          <FieldLabel htmlFor="ranking-kills" className="font-normal">
            Kills
          </FieldLabel>
        </Field>
        <Field orientation="horizontal">
          <RadioGroupItem value="kd" id="ranking-kd" />
          <FieldLabel htmlFor="ranking-kd" className="font-normal">
            Kill/death ratio
          </FieldLabel>
        </Field>
      </RadioGroup>
    </FieldSet>
  ),
}

export const WithSeparator: Story = {
  render: (args) => (
    <FieldGroup className="max-w-sm">
      <Field {...args}>
        <FieldLabel htmlFor="claim-steam-id">Steam ID</FieldLabel>
        <Input id="claim-steam-id" placeholder="STEAM_0:1:12345678" className="font-mono" />
      </Field>
      <FieldSeparator>or</FieldSeparator>
      <Field {...args}>
        <FieldLabel htmlFor="claim-player-name">Player name</FieldLabel>
        <Input id="claim-player-name" placeholder="Hazel" />
        <FieldDescription>Claims the most recent player seen with this name.</FieldDescription>
      </Field>
    </FieldGroup>
  ),
}

export const Invalid: Story = {
  render: (args) => (
    <FieldGroup className="max-w-md">
      <Field {...args} data-invalid>
        <FieldLabel htmlFor="server-port">Port</FieldLabel>
        <Input id="server-port" aria-invalid defaultValue="70000" className="font-mono" />
        <FieldDescription>UDP port the game server listens on.</FieldDescription>
        <FieldError errors={[{ message: "Port must be between 1 and 65535" }]} />
      </Field>
      <Field {...args} data-invalid>
        <FieldLabel htmlFor="rcon-password">RCON password</FieldLabel>
        <Input id="rcon-password" type="password" aria-invalid defaultValue="abc" />
        <FieldError
          errors={[
            { message: "Must be at least 8 characters" },
            { message: "Must contain a number" },
          ]}
        />
      </Field>
    </FieldGroup>
  ),
}
