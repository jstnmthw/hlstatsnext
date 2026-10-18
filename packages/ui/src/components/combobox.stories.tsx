import type { Meta, StoryObj } from "@storybook/react-vite"
import type { ComponentProps } from "react"
import { fn } from "storybook/test"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "./combobox"

const players = ["Hazel", "drexx", "Mintcake", "Vantablack", "Aether", "tanuki"]

const serversByGame = [
  { game: "Counter-Strike 1.6", items: ["Bangkok 24/7 Dust2"] },
  { game: "Half-Life Deathmatch", items: ["Deathmatch Arena", "Crossfire Rotation"] },
]

type ServerGroup = (typeof serversByGame)[number]

const meta = {
  title: "Components/Combobox",
  component: Combobox,
  tags: ["autodocs"],
  args: { disabled: false, onValueChange: fn() },
} satisfies Meta<typeof Combobox>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <Combobox {...args} items={players}>
      <ComboboxInput placeholder="Search players" className="w-64" disabled={args.disabled} />
      <ComboboxContent>
        <ComboboxEmpty>No players found.</ComboboxEmpty>
        <ComboboxList>
          {(player: string) => (
            <ComboboxItem key={player} value={player}>
              {player}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
}

export const Grouped: Story = {
  render: (args) => (
    <Combobox {...args} items={serversByGame}>
      <ComboboxInput placeholder="Search servers" className="w-72" disabled={args.disabled} />
      <ComboboxContent>
        <ComboboxEmpty>No servers found.</ComboboxEmpty>
        <ComboboxList>
          {(group: ServerGroup) => (
            <ComboboxGroup key={group.game} items={group.items}>
              <ComboboxLabel>{group.game}</ComboboxLabel>
              <ComboboxCollection>
                {(server: string) => (
                  <ComboboxItem key={server} value={server}>
                    {server}
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
}

export const WithClearButton: Story = {
  args: { defaultValue: "Hazel" },
  render: (args) => (
    <Combobox {...args} items={players}>
      <ComboboxInput
        placeholder="Search players"
        className="w-64"
        disabled={args.disabled}
        showClear
      />
      <ComboboxContent>
        <ComboboxEmpty>No players found.</ComboboxEmpty>
        <ComboboxList>
          {(player: string) => (
            <ComboboxItem key={player} value={player}>
              {player}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
}

function PlayerChips({
  disabled,
  onValueChange,
}: Pick<ComponentProps<typeof Combobox>, "disabled" | "onValueChange">) {
  const anchor = useComboboxAnchor()

  return (
    <Combobox
      multiple
      autoHighlight
      items={players}
      defaultValue={["Hazel", "drexx"]}
      disabled={disabled}
      onValueChange={onValueChange}
    >
      <ComboboxChips ref={anchor} className="w-80">
        <ComboboxValue>
          {(selected: string[]) => (
            <>
              {selected.map((player) => (
                <ComboboxChip key={player}>{player}</ComboboxChip>
              ))}
              <ComboboxChipsInput placeholder={selected.length ? "" : "Add players"} />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>No players found.</ComboboxEmpty>
        <ComboboxList>
          {(player: string) => (
            <ComboboxItem key={player} value={player}>
              {player}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

export const MultipleWithChips: Story = {
  render: (args) => <PlayerChips disabled={args.disabled} onValueChange={args.onValueChange} />,
}

export const Disabled: Story = {
  args: { disabled: true, defaultValue: "Mintcake" },
  render: (args) => (
    <Combobox {...args} items={players}>
      <ComboboxInput placeholder="Search players" className="w-64" disabled={args.disabled} />
      <ComboboxContent>
        <ComboboxList>
          {(player: string) => (
            <ComboboxItem key={player} value={player}>
              {player}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
}
