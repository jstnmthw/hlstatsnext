"use client"

import { updateServer } from "@/features/admin/servers/actions/update-server"
import { ErrorDisplay, ErrorMessage, FormField } from "@/features/common/components/form"
import type { Game, ModSupported } from "@repo/db/client"
import { BasicSelect, Button, Input, IPAddress, Label, Port } from "@repo/ui"
import { useActionState } from "react"

type GameProps = Pick<Game, "code" | "name">
type ModProps = Pick<ModSupported, "code" | "name">

interface ServerEditFormProps {
  server: {
    serverId: number
    name: string
    address: string
    port: number
    game: string
    publicAddress?: string
    statusUrl?: string
    rconPassword?: string
    sortOrder: number
    mod: string
    authToken?: { tokenPrefix: string; name: string } | null
  }
  games: GameProps[]
  mods: ModProps[]
}

export function ServerEditForm({ server, games, mods }: ServerEditFormProps) {
  const [state, formAction, pending] = useActionState(updateServer, { success: true, message: "" })

  return (
    <form action={formAction} className="space-y-6">
      <ErrorDisplay state={state} pending={pending} />

      <input type="hidden" name="serverId" value={server.serverId} />

      {server.authToken && (
        <div className="rounded-md border border-zinc-700 bg-zinc-800/50 p-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Authenticated via Token</p>
          <div className="flex items-center gap-2">
            <code className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-xs">
              {server.authToken.tokenPrefix}...
            </code>
            <span className="text-sm">{server.authToken.name}</span>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-1">
        <FormField>
          <Label htmlFor="name">Server Name</Label>
          <Input
            id="name"
            name="name"
            placeholder="My Game Server"
            defaultValue={server.name || ""}
            maxLength={255}
          />
          {state.errors?.name && <ErrorMessage>{state.errors.name[0]}</ErrorMessage>}
        </FormField>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField>
          <Label htmlFor="game" required>
            Game Type
          </Label>
          <BasicSelect name="game" defaultValue={server.game} required>
            {games.map((game) => (
              <option key={game.code} value={game.code}>
                {game.name}
              </option>
            ))}
          </BasicSelect>
          {state.errors?.game && <ErrorMessage>{state.errors.game[0]}</ErrorMessage>}
        </FormField>

        <FormField>
          <Label htmlFor="mod">Server Mod</Label>
          <BasicSelect name="mod" defaultValue={server.mod}>
            {mods.map((mod) => (
              <option key={mod.code} value={mod.code}>
                {mod.name}
              </option>
            ))}
          </BasicSelect>
          <p className="text-xs text-muted-foreground">
            Optional server administration mod for enhanced features.
          </p>
          {state.errors?.mod && <ErrorMessage>{state.errors.mod[0]}</ErrorMessage>}
        </FormField>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField>
          <Label htmlFor="address" required>
            Server Address
          </Label>
          <div className="flex">
            <IPAddress
              className="rounded-r-none"
              name="address"
              mode="ip-address"
              required
              defaultValue={server.address}
            />
            <Port
              className="-ml-px max-w-18 rounded-l-none border-l-transparent"
              name="port"
              required
              placeholder="27015"
              title="Enter a port number (1-65535)"
              defaultValue={server.port.toString()}
            />
          </div>
          {state.errors?.address && <ErrorMessage>{state.errors.address[0]}</ErrorMessage>}
          {state.errors?.port && <ErrorMessage>{state.errors.port[0]}</ErrorMessage>}
        </FormField>

        <FormField>
          <Label htmlFor="publicAddress">Public Address</Label>
          <Input
            id="publicAddress"
            name="publicAddress"
            placeholder="Optional public facing address"
            defaultValue={server.publicAddress || ""}
            maxLength={128}
          />
          <p className="text-xs text-muted-foreground">
            Optional. Public address if different from server address.
          </p>
          {state.errors?.publicAddress && (
            <ErrorMessage>{state.errors.publicAddress[0]}</ErrorMessage>
          )}
        </FormField>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField>
          <Label htmlFor="statusUrl">Status URL</Label>
          <Input
            id="statusUrl"
            name="statusUrl"
            type="url"
            placeholder="https://example.com/status"
            defaultValue={server.statusUrl || ""}
            maxLength={255}
          />
          <p className="text-xs text-muted-foreground">Optional. URL for server status page.</p>
          {state.errors?.statusUrl && <ErrorMessage>{state.errors.statusUrl[0]}</ErrorMessage>}
        </FormField>

        <FormField>
          <Label htmlFor="sortOrder">Sort Order</Label>
          <Input
            id="sortOrder"
            name="sortOrder"
            type="number"
            placeholder="0"
            defaultValue={server.sortOrder.toString()}
            min="0"
            max="127"
          />
          <p className="text-xs text-muted-foreground">Display order in server lists (0-127).</p>
          {state.errors?.sortOrder && <ErrorMessage>{state.errors.sortOrder[0]}</ErrorMessage>}
        </FormField>
      </div>

      <div className="grid md:grid-cols-1">
        <FormField>
          <Label htmlFor="rconPassword">RCON Password</Label>
          <Input
            id="rconPassword"
            name="rconPassword"
            type="password"
            placeholder="Optional remote console password"
            defaultValue={server.rconPassword || ""}
            maxLength={255}
          />
          <p className="text-xs text-muted-foreground">
            Used for remote server administration and real-time monitoring.
            {server.authToken && " Overrides the default RCON password from the token."}
          </p>
          {state.errors?.rconPassword && (
            <ErrorMessage>{state.errors.rconPassword[0]}</ErrorMessage>
          )}
        </FormField>
      </div>

      <div className="flex gap-4 pt-6">
        <Button
          type="submit"
          disabled={pending}
          variant="solid"
          colorScheme="green"
          className="w-full"
        >
          {pending ? "Updating Server..." : "Update Server"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => window.history.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
