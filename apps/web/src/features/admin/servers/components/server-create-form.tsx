"use client"

import { createServer } from "@/features/admin/servers/actions/create-server"
import { ErrorDisplay, ErrorMessage, FormField } from "@/features/common/components/form"
import type { Game, ModSupported } from "@repo/db/client"
import { BasicSelect, Button, Input, IPAddress, Label, Port, Switch } from "@repo/ui"
import { useActionState, useState } from "react"

type GameProps = Pick<Game, "code" | "name">
type ModProps = Pick<ModSupported, "code" | "name">

export function ServerCreateForm({ games, mods }: { games: GameProps[]; mods: ModProps[] }) {
  const [state, formAction, pending] = useActionState(createServer, { success: true, message: "" })
  const [isDockerMode, setIsDockerMode] = useState(false)

  return (
    <form action={formAction} className="space-y-6">
      <ErrorDisplay state={state} pending={pending} />

      <div className="grid gap-4 md:grid-cols-1">
        <FormField>
          <Label htmlFor="connection-type">Docker</Label>
          <Switch
            id="connection-type"
            name="connection-type"
            checked={isDockerMode}
            onCheckedChange={setIsDockerMode}
          />
          <p className="text-xs text-muted-foreground">
            The server is running in the same Docker network as the game server manager.
          </p>
        </FormField>
      </div>

      <input type="hidden" name="connection_type" value={isDockerMode ? "docker" : "external"} />

      <div className="grid gap-4 md:grid-cols-2">
        <FormField>
          <Label htmlFor="game" required>
            Game Type
          </Label>
          <BasicSelect name="game" defaultValue="cstrike" required>
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
          <BasicSelect name="mod" defaultValue="">
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

      <div className="grid gap-4 md:grid-cols-1">
        <FormField>
          <Label htmlFor={isDockerMode ? "docker_host" : "address"} required>
            {isDockerMode ? "Docker Host" : "Server Address"}
          </Label>
          <div className="flex">
            <IPAddress
              className="rounded-r-none"
              name={isDockerMode ? "docker_host" : "address"}
              mode={isDockerMode ? "docker-host" : "ip-address"}
              required
            />
            <Port
              className="-ml-px max-w-18 rounded-l-none border-l-transparent"
              name="port"
              required
              placeholder="27015"
              title="Enter a port number (1-65535)"
            />
          </div>
          {state.errors?.address && <ErrorMessage>{state.errors.address[0]}</ErrorMessage>}
          {state.errors?.docker_host && <ErrorMessage>{state.errors.docker_host[0]}</ErrorMessage>}
          {state.errors?.port && <ErrorMessage>{state.errors.port[0]}</ErrorMessage>}
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
            maxLength={255}
          />
          <p className="text-xs text-muted-foreground">
            Optional. Used for remote server administration and real-time monitoring.
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
          {pending ? "Adding Server..." : "Submit"}
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
