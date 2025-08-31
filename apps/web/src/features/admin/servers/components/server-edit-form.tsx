"use client"

import { useActionState } from "react"
import { updateServer } from "@/features/admin/servers/actions/update-server"
import { FormField, ErrorMessage, ErrorDisplay } from "@/features/common/components/form"
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Label,
  IPAddress,
  Port,
} from "@repo/ui"
import { GameSelect } from "./game-select"

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
    connectionType: string
    dockerHost?: string
    sortOrder: number
  }
}

export function ServerEditForm({ server }: ServerEditFormProps) {
  const [state, formAction, pending] = useActionState(updateServer, { success: true, message: "" })

  return (
    <form action={formAction} className="space-y-6">
      <ErrorDisplay state={state} pending={pending} />

      <input type="hidden" name="serverId" value={server.serverId} />

      <div className="grid md:grid-cols-2 gap-4">
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

        <FormField>
          <Label htmlFor="game" required>
            Game Type
          </Label>
          <GameSelect name="game" defaultValue={server.game || "cstrike"} required />
          {state.errors?.game && <ErrorMessage>{state.errors.game[0]}</ErrorMessage>}
        </FormField>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
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
              defaultValue={server.address}
            />
            <Port
              className="rounded-l-none -ml-px border-l-transparent max-w-18"
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

      <div className="grid md:grid-cols-2 gap-4">
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
          <Label htmlFor="connectionType">Connection Type</Label>
          <Select name="connectionType" defaultValue={server.connectionType || "external"}>
            <SelectTrigger id="connectionType" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="external">External</SelectItem>
              <SelectItem value="docker">Docker</SelectItem>
            </SelectContent>
          </Select>
          {state.errors?.connectionType && (
            <ErrorMessage>{state.errors.connectionType[0]}</ErrorMessage>
          )}
        </FormField>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <FormField>
          <Label htmlFor="dockerHost">Docker Host</Label>
          <Input
            id="dockerHost"
            name="dockerHost"
            placeholder="container_name or IP"
            defaultValue={server.dockerHost || ""}
            maxLength={255}
          />
          <p className="text-xs text-muted-foreground">
            Required for Docker connection type. Container hostname or static IP.
          </p>
          {state.errors?.dockerHost && <ErrorMessage>{state.errors.dockerHost[0]}</ErrorMessage>}
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
