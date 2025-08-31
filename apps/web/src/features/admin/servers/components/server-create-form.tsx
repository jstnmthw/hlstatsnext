"use client"

import { useActionState } from "react"
import { createServer } from "@/features/admin/servers/actions/create-server"
import { FormField, ErrorMessage, ErrorDisplay } from "@/features/common/components/form"
import { Button, Input, Label, IPAddress, Port, Switch, BasicSelect } from "@repo/ui"
import type { Game } from "@repo/database/client"

type GameProps = Pick<Game, "code" | "name">

export function ServerCreateForm({ games }: { games: GameProps[] }) {
  const [state, formAction, pending] = useActionState(createServer, { success: true, message: "" })

  return (
    <form action={formAction} className="space-y-6">
      <ErrorDisplay state={state} pending={pending} />

      <div className="grid md:grid-cols-1 gap-4">
        <FormField>
          <Label htmlFor="connection-type">Docker</Label>
          <Switch id="connection-type" name="connection-type" />
          <p className="text-xs text-muted-foreground">
            The server is running in the same Docker network as the game server manager.
          </p>
        </FormField>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
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
          <Label htmlFor="address" required>
            Server Address
          </Label>
          <div className="flex">
            <IPAddress
              className="rounded-r-none"
              name="address"
              required
              placeholder="192.168.1.1"
              title="Enter a valid IP address (e.g., 192.168.1.1)"
            />
            <Port
              className="rounded-l-none -ml-px border-l-transparent max-w-18"
              name="port"
              required
              placeholder="27015"
              title="Enter a port number (1-65535)"
            />
          </div>
          {state.errors?.address && <ErrorMessage>{state.errors.address[0]}</ErrorMessage>}
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
