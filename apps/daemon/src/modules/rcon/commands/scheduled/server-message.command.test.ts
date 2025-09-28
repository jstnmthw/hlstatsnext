/**
 * Server Message Command Tests
 *
 * Tests for the scheduled server message command implementation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { mockDeep, type MockProxy } from "vitest-mock-extended"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IRconService } from "../../types/rcon.types"
import type { IServerService } from "@/modules/server/server.types"
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
    it("should validate a proper say command", async () => {
      const schedule: ScheduledCommand = {
        id: "test-msg",
        name: "Test Message",
        cronExpression: "0 * * * * *",
        command: { type: "say", message: "Hello players!" },
        enabled: true,
      }

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(true)
    })

    it("should validate say_team command", async () => {
      const schedule: ScheduledCommand = {
        id: "test-msg",
        name: "Test Message",
        cronExpression: "0 * * * * *",
        command: { type: "say_team", message: "Team message" },
        enabled: true,
      }

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(true)
    })

    it("should validate admin_say command", async () => {
      const schedule: ScheduledCommand = {
        id: "test-msg",
        name: "Test Message",
        cronExpression: "0 * * * * *",
        command: { type: "admin_say", message: "Admin announcement" },
        enabled: true,
      }

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(true)
    })

    it("should validate amx_csay command with color", async () => {
      const schedule: ScheduledCommand = {
        id: "test-amx-csay",
        name: "Test AMX CSay",
        cronExpression: "0 * * * * *",
        command: {
          type: "amx_csay",
          message: "Join our Discord community! Link: discord.gg/0x1clan",
        },
        enabled: true,
      }

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(true)
    })

    it("should validate amx_say command", async () => {
      const schedule: ScheduledCommand = {
        id: "test-amx-say",
        name: "Test AMX Say",
        cronExpression: "0 * * * * *",
        command: { type: "amx_say", message: "Server announcement" },
        enabled: true,
      }

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(true)
    })

    it("should reject non-message commands", async () => {
      const schedule: ScheduledCommand = {
        id: "test-invalid",
        name: "Invalid Command",
        cronExpression: "0 * * * * *",
        command: { type: "changelevel", message: "de_dust2" },
        enabled: true,
      }

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(false)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Invalid message command"),
      )
    })

    it("should reject empty message content", async () => {
      const schedule: ScheduledCommand = {
        id: "test-empty",
        name: "Empty Message",
        cronExpression: "0 * * * * *",
        command: { type: "say", message: "" },
        enabled: true,
      }

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(false)
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Empty message content"))
    })

    it("should reject messages that are too long", async () => {
      const longMessage = "a".repeat(201)
      const schedule: ScheduledCommand = {
        id: "test-long",
        name: "Long Message",
        cronExpression: "0 * * * * *",
        command: { type: "say", message: longMessage },
        enabled: true,
      }

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(false)
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Message too long"))
    })
  })

  describe("execute", () => {
    beforeEach(() => {
      mockRconService.isConnected.mockReturnValue(true)
      mockRconService.executeCommand.mockResolvedValue("Message sent successfully")
      mockServerService.findActiveServersWithRcon.mockResolvedValue([mockServer])
    })

    it("should execute a simple message command successfully", async () => {
      const schedule: ScheduledCommand = {
        id: "test-msg",
        name: "Test Message",
        cronExpression: "0 * * * * *",
        command: { type: "say", message: "Hello players!" },
        enabled: true,
      }

      const context: ScheduleExecutionContext = {
        schedule,
        scheduleId: schedule.id,
        executionId: "test-execution",
        startTime: new Date(),
      }

      const result = await command.execute(context)

      expect(result.serversProcessed).toBe(1)
      expect(result.commandsSent).toBe(1)
      expect(mockRconService.executeCommand).toHaveBeenCalledWith(
        mockServer.serverId,
        'say "Hello players!"',
      )
    })

    it("should handle server filter validation", async () => {
      // Mock server service to return empty list (no servers match filter)
      mockServerService.findActiveServersWithRcon.mockResolvedValue([])

      const schedule: ScheduledCommand = {
        id: "test-msg",
        name: "Test Message",
        cronExpression: "0 * * * * *",
        command: { type: "say", message: "Hello players!" },
        enabled: true,
        serverFilter: {
          serverIds: [999], // No servers available
        },
      }

      const context: ScheduleExecutionContext = {
        schedule,
        scheduleId: schedule.id,
        executionId: "test-execution",
        startTime: new Date(),
      }

      const result = await command.execute(context)

      expect(result.serversProcessed).toBe(0)
      expect(result.commandsSent).toBe(0)
    })

    it("should handle placeholder replacement", async () => {
      const schedule: ScheduledCommand = {
        id: "test-msg",
        name: "Test Message",
        cronExpression: "0 * * * * *",
        command: {
          type: "say",
          message: "Welcome to {server.name}! Players: {server.playerCount}/{server.maxPlayers}",
        },
        enabled: true,
      }

      const context: ScheduleExecutionContext = {
        schedule,
        scheduleId: schedule.id,
        executionId: "test-execution",
        startTime: new Date(),
      }

      const result = await command.execute(context)

      expect(result.serversProcessed).toBe(1)
      expect(result.commandsSent).toBe(1)
      expect(mockRconService.executeCommand).toHaveBeenCalledWith(
        mockServer.serverId,
        'say "Welcome to Test Server! Players: 0/N/A"',
      )
    })

    it("should handle function-based commands", async () => {
      const schedule: ScheduledCommand = {
        id: "test-msg",
        name: "Test Message",
        cronExpression: "0 * * * * *",
        command: { type: "say", message: "Dynamic message for {server.name}" },
        enabled: true,
      }

      const context: ScheduleExecutionContext = {
        schedule,
        scheduleId: schedule.id,
        executionId: "test-execution",
        startTime: new Date(),
      }

      const result = await command.execute(context)

      expect(result.serversProcessed).toBe(1)
      expect(result.commandsSent).toBe(1)
      expect(mockRconService.executeCommand).toHaveBeenCalledWith(
        mockServer.serverId,
        'say "Dynamic message for Test Server"',
      )
    })

    it("should handle RCON connection failure", async () => {
      mockRconService.isConnected.mockReturnValue(false)

      const schedule: ScheduledCommand = {
        id: "test-msg",
        name: "Test Message",
        cronExpression: "0 * * * * *",
        command: { type: "say", message: "Hello!" },
        enabled: true,
      }

      const context: ScheduleExecutionContext = {
        schedule,
        scheduleId: schedule.id,
        executionId: "test-execution",
        startTime: new Date(),
      }

      const result = await command.execute(context)

      expect(result.serversProcessed).toBe(0)
      expect(result.commandsSent).toBe(0)
    })

    it("should handle RCON command execution failure", async () => {
      mockRconService.executeCommand.mockRejectedValue(new Error("RCON timeout"))

      const schedule: ScheduledCommand = {
        id: "test-msg",
        name: "Test Message",
        cronExpression: "0 * * * * *",
        command: { type: "say", message: "Hello!" },
        enabled: true,
      }

      const context: ScheduleExecutionContext = {
        schedule,
        scheduleId: schedule.id,
        executionId: "test-execution",
        startTime: new Date(),
      }

      const result = await command.execute(context)

      expect(result.serversProcessed).toBe(1) // We processed the server but command failed
      expect(result.commandsSent).toBe(0) // No commands succeeded
    })

    it("should log successful message delivery", async () => {
      const schedule: ScheduledCommand = {
        id: "test-msg",
        name: "Test Message",
        cronExpression: "0 * * * * *",
        command: { type: "say", message: "Hello players!" },
        enabled: true,
      }

      const context: ScheduleExecutionContext = {
        schedule,
        scheduleId: schedule.id,
        executionId: "test-execution",
        startTime: new Date(),
      }

      const result = await command.execute(context)

      expect(result.serversProcessed).toBe(1)
      expect(result.commandsSent).toBe(1)
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Server message delivered successfully",
        expect.objectContaining({
          scheduleId: schedule.id,
          serverId: mockServer.serverId,
        }),
      )
    })

    it("should handle minimum player count filter", async () => {
      const schedule: ScheduledCommand = {
        id: "test-msg",
        name: "Test Message",
        cronExpression: "0 * * * * *",
        command: { type: "say", message: "Hello!" },
        enabled: true,
        serverFilter: {
          minPlayers: 0, // Should pass with 5 players
        },
      }

      const context: ScheduleExecutionContext = {
        schedule,
        scheduleId: schedule.id,
        executionId: "test-execution",
        startTime: new Date(),
      }

      const result = await command.execute(context)

      expect(result.serversProcessed).toBe(1)
      expect(result.commandsSent).toBe(1)
    })
  })
})
