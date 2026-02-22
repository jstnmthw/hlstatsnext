/**
 * Server Message Command Tests
 *
 * Tests for the scheduled server message command implementation.
 * All commands use the AMX plugin's HUD system:
 *   "hlx_csay"    → hlx_csay <color> <message>
 *   "hlx_tsay"    → hlx_tsay <color> <message>
 *   "hlx_typehud" → hlx_typehud <color> <message>
 */

import type { IServerService } from "@/modules/server/server.types"
import type { ILogger } from "@/shared/utils/logger.types"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { mockDeep, type MockProxy } from "vitest-mock-extended"
import type { IRconService } from "../../types/rcon.types"
import type { ScheduledCommand, ScheduleExecutionContext } from "../../types/schedule.types"
import { ServerMessageCommand } from "./server-message.command"

describe("ServerMessageCommand", () => {
  let command: ServerMessageCommand
  let mockLogger: MockProxy<ILogger>
  let mockRconService: MockProxy<IRconService>
  let mockServerService: MockProxy<IServerService>

  const mockServer = {
    serverId: 1,
    game: "cstrike",
    name: "Test Server",
    address: "127.0.0.1",
    port: 27015,
  }

  beforeEach(() => {
    mockLogger = mockDeep<ILogger>()
    mockRconService = mockDeep<IRconService>()
    mockServerService = mockDeep<IServerService>()
    command = new ServerMessageCommand(mockLogger, mockRconService, mockServerService)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("getType", () => {
    it("should return correct command type", () => {
      expect(command.getType()).toBe("server-message")
    })
  })

  describe("validate", () => {
    it("should validate hlx_csay command", async () => {
      const schedule: ScheduledCommand = {
        id: "test-csay",
        name: "Test CSay",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "FF0000", message: "Center message" },
        enabled: true,
      }

      expect(await command.validate(schedule)).toBe(true)
    })

    it("should validate hlx_tsay command", async () => {
      const schedule: ScheduledCommand = {
        id: "test-tsay",
        name: "Test TSay",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_tsay", color: "00FF00", message: "Top message" },
        enabled: true,
      }

      expect(await command.validate(schedule)).toBe(true)
    })

    it("should validate hlx_typehud command", async () => {
      const schedule: ScheduledCommand = {
        id: "test-typehud",
        name: "Test TypeHud",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_typehud", color: "0080FF", message: "Typewriter message" },
        enabled: true,
      }

      expect(await command.validate(schedule)).toBe(true)
    })

    it("should reject unsupported command types", async () => {
      for (const type of ["say", "amx_say", "amx_csay", "echo", "changelevel"]) {
        const schedule: ScheduledCommand = {
          id: `test-${type}`,
          name: `Test ${type}`,
          cronExpression: "0 * * * * *",
          command: { type, message: "test" },
          enabled: true,
        }

        expect(await command.validate(schedule)).toBe(false)
      }

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Invalid command type"))
    })

    it("should reject empty message", async () => {
      const schedule: ScheduledCommand = {
        id: "test-empty",
        name: "Empty",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "FF0000", message: "" },
        enabled: true,
      }

      expect(await command.validate(schedule)).toBe(false)
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Missing message"))
    })

    it("should reject whitespace-only message", async () => {
      const schedule: ScheduledCommand = {
        id: "test-whitespace",
        name: "Whitespace",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "FF0000", message: "   " },
        enabled: true,
      }

      expect(await command.validate(schedule)).toBe(false)
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Empty message"))
    })

    it("should reject messages over 200 characters", async () => {
      const schedule: ScheduledCommand = {
        id: "test-long",
        name: "Long",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "FF0000", message: "a".repeat(201) },
        enabled: true,
      }

      expect(await command.validate(schedule)).toBe(false)
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Message too long"))
    })

    it("should accept message at exactly 200 characters", async () => {
      const schedule: ScheduledCommand = {
        id: "test-200",
        name: "Exactly 200",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "FF0000", message: "a".repeat(200) },
        enabled: true,
      }

      expect(await command.validate(schedule)).toBe(true)
    })

    it("should reject command with empty type", async () => {
      const schedule: ScheduledCommand = {
        id: "test-no-type",
        name: "No Type",
        cronExpression: "0 * * * * *",
        command: { type: "", message: "hello" },
        enabled: true,
      }

      expect(await command.validate(schedule)).toBe(false)
    })

    it("should reject command with no message property", async () => {
      const schedule: ScheduledCommand = {
        id: "test-no-msg",
        name: "No Msg",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay" },
        enabled: true,
      }

      expect(await command.validate(schedule)).toBe(false)
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Missing message"))
    })

    it("should reject non-object command format", async () => {
      const schedule = {
        id: "test-number",
        name: "Number",
        cronExpression: "0 * * * * *",
        command: 12345 as unknown as { type: string; [key: string]: unknown },
        enabled: true,
      } as ScheduledCommand

      expect(await command.validate(schedule)).toBe(false)
    })

    it("should reject invalid cron expression", async () => {
      const schedule: ScheduledCommand = {
        id: "test-bad-cron",
        name: "Bad Cron",
        cronExpression: "invalid",
        command: { type: "hlx_csay", color: "FF0000", message: "test" },
        enabled: true,
      }

      expect(await command.validate(schedule)).toBe(false)
    })

    it("should reject schedule with no id", async () => {
      const schedule = {
        id: "",
        name: "No ID",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "FF0000", message: "test" },
        enabled: true,
      } as ScheduledCommand

      expect(await command.validate(schedule)).toBe(false)
    })

    it("should reject schedule with null command", async () => {
      const schedule = {
        id: "test-null",
        name: "Null Cmd",
        cronExpression: "0 * * * * *",
        command: null as unknown as { type: string; [key: string]: unknown },
        enabled: true,
      } as ScheduledCommand

      expect(await command.validate(schedule)).toBe(false)
    })

    it("should handle validation error gracefully", async () => {
      const throwingSchedule = {
        id: "test-throw",
        name: "Throw",
        cronExpression: "0 * * * * *",
        command: {
          type: "hlx_csay",
          get message() {
            throw new Error("getter error")
          },
        },
        enabled: true,
      } as unknown as ScheduledCommand

      expect(await command.validate(throwingSchedule)).toBe(false)
    })

    it("should validate 5-part cron expression", async () => {
      const schedule: ScheduledCommand = {
        id: "test-5part",
        name: "5 Part",
        cronExpression: "* * * * *",
        command: { type: "hlx_csay", color: "FF0000", message: "Hello" },
        enabled: true,
      }

      expect(await command.validate(schedule)).toBe(true)
    })

    it("should validate 6-part cron expression", async () => {
      const schedule: ScheduledCommand = {
        id: "test-6part",
        name: "6 Part",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "FF0000", message: "Hello" },
        enabled: true,
      }

      expect(await command.validate(schedule)).toBe(true)
    })

    it("should reject 4-part cron expression", async () => {
      const schedule: ScheduledCommand = {
        id: "test-4part",
        name: "4 Part",
        cronExpression: "* * * *",
        command: { type: "hlx_csay", color: "FF0000", message: "Hello" },
        enabled: true,
      }

      expect(await command.validate(schedule)).toBe(false)
    })

    it("should reject 7-part cron expression", async () => {
      const schedule: ScheduledCommand = {
        id: "test-7part",
        name: "7 Part",
        cronExpression: "* * * * * * *",
        command: { type: "hlx_csay", color: "FF0000", message: "Hello" },
        enabled: true,
      }

      expect(await command.validate(schedule)).toBe(false)
    })
  })

  describe("execute", () => {
    beforeEach(() => {
      mockRconService.isConnected.mockReturnValue(true)
      mockRconService.executeCommand.mockResolvedValue("OK")
      mockServerService.findActiveServersWithRcon.mockResolvedValue([mockServer])
    })

    it("should execute hlx_csay with color and message", async () => {
      const context = makeContext({
        id: "test-csay",
        command: { type: "hlx_csay", color: "80ff00", message: "Visit hlstatsnext.com" },
      })

      const result = await command.execute(context)

      expect(result.serversProcessed).toBe(1)
      expect(result.commandsSent).toBe(1)
      expect(mockRconService.executeCommand).toHaveBeenCalledWith(
        1,
        "hlx_csay 80ff00 Visit hlstatsnext.com",
      )
    })

    it("should execute hlx_tsay with color and message", async () => {
      const context = makeContext({
        id: "test-tsay",
        command: { type: "hlx_tsay", color: "00FF00", message: "Top HUD message" },
      })

      const result = await command.execute(context)

      expect(result.serversProcessed).toBe(1)
      expect(result.commandsSent).toBe(1)
      expect(mockRconService.executeCommand).toHaveBeenCalledWith(
        1,
        "hlx_tsay 00FF00 Top HUD message",
      )
    })

    it("should execute hlx_typehud with color and message", async () => {
      const context = makeContext({
        id: "test-typehud",
        command: { type: "hlx_typehud", color: "8000ff", message: "Typewriter effect" },
      })

      const result = await command.execute(context)

      expect(result.serversProcessed).toBe(1)
      expect(result.commandsSent).toBe(1)
      expect(mockRconService.executeCommand).toHaveBeenCalledWith(
        1,
        "hlx_typehud 8000ff Typewriter effect",
      )
    })

    it("should use default color 00FF00 when no color specified", async () => {
      const context = makeContext({
        id: "test-default-color",
        command: { type: "hlx_csay", message: "No color" },
      })

      const result = await command.execute(context)

      expect(result.commandsSent).toBe(1)
      expect(mockRconService.executeCommand).toHaveBeenCalledWith(1, "hlx_csay 00FF00 No color")
    })

    it("should replace {server.name} placeholder", async () => {
      const context = makeContext({
        id: "test-name",
        command: { type: "hlx_csay", color: "FFFFFF", message: "Welcome to {server.name}!" },
      })

      const result = await command.execute(context)

      expect(result.commandsSent).toBe(1)
      expect(mockRconService.executeCommand).toHaveBeenCalledWith(
        1,
        "hlx_csay FFFFFF Welcome to Test Server!",
      )
    })

    it("should replace {server.serverId} placeholder", async () => {
      const context = makeContext({
        id: "test-id",
        command: { type: "hlx_tsay", color: "FFFFFF", message: "Server #{server.serverId}" },
      })

      const result = await command.execute(context)

      expect(result.commandsSent).toBe(1)
      expect(mockRconService.executeCommand).toHaveBeenCalledWith(1, "hlx_tsay FFFFFF Server #1")
    })

    it("should handle no active servers", async () => {
      mockServerService.findActiveServersWithRcon.mockResolvedValue([])

      const context = makeContext({
        id: "test-no-servers",
        command: { type: "hlx_csay", color: "FF0000", message: "Hello" },
      })

      const result = await command.execute(context)

      expect(result.serversProcessed).toBe(0)
      expect(result.commandsSent).toBe(0)
    })

    it("should skip servers with no RCON connection", async () => {
      mockRconService.isConnected.mockReturnValue(false)

      const context = makeContext({
        id: "test-no-rcon",
        command: { type: "hlx_csay", color: "FF0000", message: "Hello" },
      })

      const result = await command.execute(context)

      expect(result.serversProcessed).toBe(0)
      expect(result.commandsSent).toBe(0)
    })

    it("should handle RCON execution failure", async () => {
      mockRconService.executeCommand.mockRejectedValue(new Error("RCON timeout"))

      const context = makeContext({
        id: "test-fail",
        command: { type: "hlx_csay", color: "FF0000", message: "Hello" },
      })

      const result = await command.execute(context)

      expect(result.serversProcessed).toBe(1)
      expect(result.commandsSent).toBe(0)
    })

    it("should log successful delivery", async () => {
      const context = makeContext({
        id: "test-log",
        command: { type: "hlx_csay", color: "FF0000", message: "Hello" },
      })

      await command.execute(context)

      expect(mockLogger.info).toHaveBeenCalledWith(
        "Server message delivered successfully",
        expect.objectContaining({
          scheduleId: "test-log",
          serverId: 1,
        }),
      )
    })

    it("should handle non-Error thrown by executeCommand", async () => {
      mockRconService.executeCommand.mockRejectedValue("string error")

      const context = makeContext({
        id: "test-non-error",
        command: { type: "hlx_csay", color: "FF0000", message: "Hello" },
      })

      const result = await command.execute(context)

      expect(result.serversProcessed).toBe(1)
      expect(result.commandsSent).toBe(0)
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("string error"))
    })

    it("should execute on multiple servers", async () => {
      const server2 = {
        serverId: 2,
        game: "cstrike",
        name: "Server 2",
        address: "127.0.0.2",
        port: 27016,
      }
      mockServerService.findActiveServersWithRcon.mockResolvedValue([mockServer, server2])

      const context = makeContext({
        id: "test-multi",
        command: { type: "hlx_csay", color: "FF0000", message: "Hello all" },
      })

      const result = await command.execute(context)

      expect(result.serversProcessed).toBe(2)
      expect(result.commandsSent).toBe(2)
    })

    it("should handle mixed success/failure across servers", async () => {
      const server2 = {
        serverId: 2,
        game: "cstrike",
        name: "Server 2",
        address: "127.0.0.2",
        port: 27016,
      }
      mockServerService.findActiveServersWithRcon.mockResolvedValue([mockServer, server2])

      mockRconService.executeCommand.mockImplementation(async (serverId: number) => {
        if (serverId === 2) throw new Error("timeout")
        return "OK"
      })

      const context = makeContext({
        id: "test-mixed",
        command: { type: "hlx_csay", color: "FF0000", message: "Hello" },
      })

      const result = await command.execute(context)

      expect(result.serversProcessed).toBe(2)
      expect(result.commandsSent).toBe(1)
    })

    it("should return 0 counts when command cannot be built", async () => {
      const context = makeContext({
        id: "test-no-msg",
        command: { type: "hlx_csay" },
      })

      const result = await command.execute(context)

      expect(result.serversProcessed).toBe(0)
      expect(result.commandsSent).toBe(0)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Could not build RCON command"),
      )
    })

    it("should return 0 counts for unsupported command type", async () => {
      const context = makeContext({
        id: "test-unsupported",
        command: { type: "say", message: "Hello" },
      })

      const result = await command.execute(context)

      expect(result.serversProcessed).toBe(0)
      expect(result.commandsSent).toBe(0)
    })
  })

  describe("execute (error in base class)", () => {
    it("should catch errors from executeCommand and return zero counts", async () => {
      mockServerService.findActiveServersWithRcon.mockRejectedValue(new Error("DB error"))

      const context = makeContext({
        id: "test-db-error",
        command: { type: "hlx_csay", color: "FF0000", message: "Hello" },
      })

      const result = await command.execute(context)

      expect(result.serversProcessed).toBe(0)
      expect(result.commandsSent).toBe(0)
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Scheduled command failed"),
        expect.any(Object),
      )
    })
  })

  describe("formatExecutionTime", () => {
    it("should format milliseconds less than 1000 as ms", () => {
      expect((command as any).formatExecutionTime(500)).toBe("500ms")
    })

    it("should format milliseconds >= 1000 as seconds", () => {
      expect((command as any).formatExecutionTime(2500)).toBe("2.50s")
    })

    it("should format exactly 1000ms as seconds", () => {
      expect((command as any).formatExecutionTime(1000)).toBe("1.00s")
    })
  })

  /** Helper to build a ScheduleExecutionContext from partial schedule data */
  function makeContext(
    partial: Partial<ScheduledCommand> & { id: string; command: ScheduledCommand["command"] },
  ): ScheduleExecutionContext {
    const schedule: ScheduledCommand = {
      name: partial.name || "Test",
      cronExpression: partial.cronExpression || "0 * * * * *",
      enabled: partial.enabled ?? true,
      ...partial,
    }
    return {
      schedule,
      scheduleId: schedule.id,
      executionId: "test-execution",
      startTime: new Date(),
    }
  }
})
