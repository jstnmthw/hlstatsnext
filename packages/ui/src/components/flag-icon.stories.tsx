import type { Meta, StoryObj } from "@storybook/react-vite"
import { FlagIcon } from "./flag-icon"

const meta = {
  title: "Components/Flag Icon",
  component: FlagIcon,
  tags: ["autodocs"],
  args: { code: "th", name: "Thailand" },
} satisfies Meta<typeof FlagIcon>

export default meta

type Story = StoryObj<typeof meta>

const countries = [
  { code: "th", name: "Thailand" },
  { code: "de", name: "Germany" },
  { code: "se", name: "Sweden" },
  { code: "jp", name: "Japan" },
  { code: "gb", name: "United Kingdom" },
]

const players = [
  { name: "Hazel", code: "th", country: "Thailand" },
  { name: "drexx", code: "de", country: "Germany" },
  { name: "Mintcake", code: "se", country: "Sweden" },
  { name: "tanuki", code: "jp", country: "Japan" },
]

const unknown = [
  { label: 'code=""', code: "" },
  { label: "code={null}", code: null },
  { label: 'code="zz"', code: "zz" },
]

export const Default: Story = {}

export const Countries: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      {countries.map((country) => (
        <FlagIcon key={country.code} {...args} code={country.code} name={country.name} />
      ))}
    </div>
  ),
}

export const WithPlayerName: Story = {
  render: (args) => (
    <ul className="space-y-2">
      {players.map((player) => (
        <li key={player.name} className="flex items-center gap-2">
          <FlagIcon {...args} code={player.code} name={player.country} />
          {player.name}
        </li>
      ))}
    </ul>
  ),
}

export const UnknownOrEmpty: Story = {
  render: (args) => (
    <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2">
      {unknown.map((entry) => (
        <div key={entry.label} className="contents">
          <dt>
            <code className="text-muted-foreground">{entry.label}</code>
          </dt>
          <dd className="flex h-6 w-12 items-center justify-center rounded border border-dashed">
            <FlagIcon {...args} code={entry.code} name={null} />
          </dd>
        </div>
      ))}
    </dl>
  ),
}
