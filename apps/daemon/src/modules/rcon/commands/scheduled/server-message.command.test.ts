/**
 * Server Message Command Tests
 *
 * Tests for the scheduled server message command implementation.
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

    it("should handle non-Error objects thrown by executeCommand", async () => {
      mockRconService.executeCommand.mockRejectedValue("string error")

      const schedule: ScheduledCommand = {
        id: "test-non-error",
        name: "Non Error",
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

      expect(result.serversProcessed).toBe(1) // processed but failed
      expect(result.commandsSent).toBe(0)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Failed to execute message command on server 1: string error"),
      )
    })

    it("should execute with multiple servers", async () => {
      const server2 = {
        serverId: 2,
        game: "cstrike",
        name: "Test Server 2",
        address: "127.0.0.2",
        port: 27016,
      }
      mockServerService.findActiveServersWithRcon.mockResolvedValue([mockServer, server2])

      const schedule: ScheduledCommand = {
        id: "test-multi",
        name: "Multi Server",
        cronExpression: "0 * * * * *",
        command: { type: "say", message: "Hello all!" },
        enabled: true,
      }

      const context: ScheduleExecutionContext = {
        schedule,
        scheduleId: schedule.id,
        executionId: "test-execution",
        startTime: new Date(),
      }

      const result = await command.execute(context)

      expect(result.serversProcessed).toBe(2)
      expect(result.commandsSent).toBe(2)
    })

    it("should handle mixed success and failure across servers", async () => {
      const server2 = {
        serverId: 2,
        game: "cstrike",
        name: "Test Server 2",
        address: "127.0.0.2",
        port: 27016,
      }
      mockServerService.findActiveServersWithRcon.mockResolvedValue([mockServer, server2])

      // Server 1 succeeds, Server 2 fails
      mockRconService.executeCommand.mockImplementation(async (serverId: number) => {
        if (serverId === 2) {
          throw new Error("RCON timeout")
        }
        return "OK"
      })

      const schedule: ScheduledCommand = {
        id: "test-mixed",
        name: "Mixed",
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

      expect(result.serversProcessed).toBe(2) // Both processed
      expect(result.commandsSent).toBe(1) // Only server 1 succeeded
    })

    it("should handle {server.serverId} placeholder replacement", async () => {
      const schedule: ScheduledCommand = {
        id: "test-placeholder",
        name: "Placeholder Test",
        cronExpression: "0 * * * * *",
        command: {
          type: "say",
          message: "Server ID: {server.serverId}",
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

      expect(result.commandsSent).toBe(1)
      expect(mockRconService.executeCommand).toHaveBeenCalledWith(1, 'say "Server ID: 1"')
    })

    it("should handle string command format (legacy)", async () => {
      // Cast to any to bypass TypeScript's strict typing for legacy format
      const schedule = {
        id: "test-legacy",
        name: "Legacy String",
        cronExpression: "0 * * * * *",
        command: 'say "Hello from legacy"' as unknown as { type: string; [key: string]: unknown },
        enabled: true,
      } as ScheduledCommand

      const context: ScheduleExecutionContext = {
        schedule,
        scheduleId: schedule.id,
        executionId: "test-execution",
        startTime: new Date(),
      }

      const result = await command.execute(context)

      expect(result.serversProcessed).toBe(1)
      expect(result.commandsSent).toBe(1)
      expect(mockRconService.executeCommand).toHaveBeenCalledWith(1, 'say "Hello from legacy"')
    })

    it("should return 0 counts for invalid command format (no message, no string)", async () => {
      // Command object without message property
      const schedule: ScheduledCommand = {
        id: "test-no-message",
        name: "No Message",
        cronExpression: "0 * * * * *",
        command: { type: "say" },
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
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Invalid message command"),
      )
    })
  })

  describe("validate (additional coverage)", () => {
    it("should reject command object with no type", async () => {
      const schedule: ScheduledCommand = {
        id: "test-no-type",
        name: "No Type",
        cronExpression: "0 * * * * *",
        command: { type: "", message: "hello" },
        enabled: true,
      }

      const isValid = await command.validate(schedule)
      // Base class validates type exists, empty string is falsy
      // But the object format checks command.type which is empty string
      // The validateCommand method checks validMessageTypes.includes("")
      expect(isValid).toBe(false)
    })

    it("should reject command object with no message", async () => {
      const schedule: ScheduledCommand = {
        id: "test-no-msg",
        name: "No Msg",
        cronExpression: "0 * * * * *",
        command: { type: "say" },
        enabled: true,
      }

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(false)
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Empty message content"))
    })

    it("should validate echo command type", async () => {
      const schedule: ScheduledCommand = {
        id: "test-echo",
        name: "Echo Test",
        cronExpression: "0 * * * * *",
        command: { type: "echo", message: "Echo message" },
        enabled: true,
      }

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(true)
    })

    it("should validate amx_tsay command type", async () => {
      const schedule: ScheduledCommand = {
        id: "test-amx-tsay",
        name: "AMX TSay",
        cronExpression: "0 * * * * *",
        command: { type: "amx_tsay", message: "Top say message" },
        enabled: true,
      }

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(true)
    })

    it("should validate hlx_tsay command type", async () => {
      const schedule: ScheduledCommand = {
        id: "test-hlx-tsay",
        name: "HLX TSay",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_tsay", message: "HLX top say" },
        enabled: true,
      }

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(true)
    })

    it("should validate hlx_csay command type", async () => {
      const schedule: ScheduledCommand = {
        id: "test-hlx-csay",
        name: "HLX CSay",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", message: "HLX center say" },
        enabled: true,
      }

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(true)
    })

    it("should validate hlx_typehud command type", async () => {
      const schedule: ScheduledCommand = {
        id: "test-hlx-typehud",
        name: "HLX TypeHud",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_typehud", message: "HLX type hud" },
        enabled: true,
      }

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(true)
    })

    it("should validate server-message command type", async () => {
      const schedule: ScheduledCommand = {
        id: "test-server-message",
        name: "Server Message",
        cronExpression: "0 * * * * *",
        command: { type: "server-message", message: "Announcement" },
        enabled: true,
      }

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(true)
    })

    it("should reject message that is exactly 201 characters", async () => {
      const schedule: ScheduledCommand = {
        id: "test-exactly-long",
        name: "Exactly Long",
        cronExpression: "0 * * * * *",
        command: { type: "say", message: "a".repeat(201) },
        enabled: true,
      }

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(false)
    })

    it("should accept message that is exactly 200 characters", async () => {
      const schedule: ScheduledCommand = {
        id: "test-exactly-200",
        name: "Exactly 200",
        cronExpression: "0 * * * * *",
        command: { type: "say", message: "a".repeat(200) },
        enabled: true,
      }

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(true)
    })

    it("should reject whitespace-only message content", async () => {
      const schedule: ScheduledCommand = {
        id: "test-whitespace",
        name: "Whitespace",
        cronExpression: "0 * * * * *",
        command: { type: "say", message: "   " },
        enabled: true,
      }

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(false)
    })

    // String format validation tests
    it("should validate legacy string format: say Hello", async () => {
      const schedule = {
        id: "test-legacy-say",
        name: "Legacy Say",
        cronExpression: "0 * * * * *",
        command: 'say "Hello World"' as unknown as { type: string; [key: string]: unknown },
        enabled: true,
      } as ScheduledCommand

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(true)
    })

    it("should validate legacy string format: say_team message", async () => {
      const schedule = {
        id: "test-legacy-sayteam",
        name: "Legacy SayTeam",
        cronExpression: "0 * * * * *",
        command: 'say_team "Team message"' as unknown as {
          type: string
          [key: string]: unknown
        },
        enabled: true,
      } as ScheduledCommand

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(true)
    })

    it("should reject legacy string format with non-message command", async () => {
      const schedule = {
        id: "test-legacy-invalid",
        name: "Legacy Invalid",
        cronExpression: "0 * * * * *",
        command: "changelevel de_dust2" as unknown as { type: string; [key: string]: unknown },
        enabled: true,
      } as ScheduledCommand

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(false)
    })

    it("should validate legacy string format: admin_say message", async () => {
      const schedule = {
        id: "test-legacy-admin",
        name: "Legacy Admin",
        cronExpression: "0 * * * * *",
        command: 'admin_say "Admin announcement"' as unknown as {
          type: string
          [key: string]: unknown
        },
        enabled: true,
      } as ScheduledCommand

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(true)
    })

    it("should validate legacy string format: echo message", async () => {
      const schedule = {
        id: "test-legacy-echo",
        name: "Legacy Echo",
        cronExpression: "0 * * * * *",
        command: 'echo "Echo test"' as unknown as { type: string; [key: string]: unknown },
        enabled: true,
      } as ScheduledCommand

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(true)
    })

    it("should validate legacy string format: amx_say message", async () => {
      const schedule = {
        id: "test-legacy-amx-say",
        name: "Legacy AMX Say",
        cronExpression: "0 * * * * *",
        command: 'amx_say "AMX announcement"' as unknown as {
          type: string
          [key: string]: unknown
        },
        enabled: true,
      } as ScheduledCommand

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(true)
    })

    it("should validate legacy string format: amx_csay with color", async () => {
      const schedule = {
        id: "test-legacy-amx-csay",
        name: "Legacy AMX CSay",
        cronExpression: "0 * * * * *",
        command: 'amx_csay green "Center message"' as unknown as {
          type: string
          [key: string]: unknown
        },
        enabled: true,
      } as ScheduledCommand

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(true)
    })

    it("should validate legacy string format: amx_tsay message", async () => {
      const schedule = {
        id: "test-legacy-amx-tsay",
        name: "Legacy AMX TSay",
        cronExpression: "0 * * * * *",
        command: 'amx_tsay "Top message"' as unknown as {
          type: string
          [key: string]: unknown
        },
        enabled: true,
      } as ScheduledCommand

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(true)
    })

    it("should validate legacy string format: hlx_tsay with color", async () => {
      const schedule = {
        id: "test-legacy-hlx-tsay",
        name: "Legacy HLX TSay",
        cronExpression: "0 * * * * *",
        command: 'hlx_tsay red "HLX top message"' as unknown as {
          type: string
          [key: string]: unknown
        },
        enabled: true,
      } as ScheduledCommand

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(true)
    })

    it("should validate legacy string format: hlx_csay with color", async () => {
      const schedule = {
        id: "test-legacy-hlx-csay",
        name: "Legacy HLX CSay",
        cronExpression: "0 * * * * *",
        command: 'hlx_csay blue "HLX center message"' as unknown as {
          type: string
          [key: string]: unknown
        },
        enabled: true,
      } as ScheduledCommand

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(true)
    })

    it("should validate legacy string format: hlx_typehud with color", async () => {
      const schedule = {
        id: "test-legacy-hlx-typehud",
        name: "Legacy HLX TypeHud",
        cronExpression: "0 * * * * *",
        command: 'hlx_typehud white "HLX type hud"' as unknown as {
          type: string
          [key: string]: unknown
        },
        enabled: true,
      } as ScheduledCommand

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(true)
    })

    it("should reject unknown hlx_ command in string format when content cant be extracted", async () => {
      // hlx_newcommand is recognized by hlx_ regex but extractMessageContent fails for it
      // because the specific regex patterns don't cover hlx_newcommand
      const schedule = {
        id: "test-legacy-hlx-future",
        name: "Legacy HLX Future",
        cronExpression: "0 * * * * *",
        command: 'hlx_newcommand "Future message"' as unknown as {
          type: string
          [key: string]: unknown
        },
        enabled: true,
      } as ScheduledCommand

      const isValid = await command.validate(schedule)
      // hlx_newcommand matches isHlxCommand but extractMessageContent returns ""
      // Since isHlxCommand is true, it falls into the "known commands should have content" branch
      expect(isValid).toBe(false)
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Skipping schedule"))
    })

    it("should reject unknown hlx_ command type in object format", async () => {
      const schedule: ScheduledCommand = {
        id: "test-hlx-unknown-obj",
        name: "Unknown HLX Obj",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_newcommand", message: "Future message" },
        enabled: true,
      }

      const isValid = await command.validate(schedule)
      // Object format uses validMessageTypes array, hlx_newcommand is not in it
      expect(isValid).toBe(false)
    })

    it("should handle legacy string with message-like keywords (permissive)", async () => {
      const schedule = {
        id: "test-legacy-message-like",
        name: "Legacy Message Like",
        cronExpression: "0 * * * * *",
        command: 'custom_announce "Hello"' as unknown as {
          type: string
          [key: string]: unknown
        },
        enabled: true,
      } as ScheduledCommand

      const isValid = await command.validate(schedule)
      // custom_announce has quoted content, should be permissive
      expect(isValid).toBe(true)
    })

    it("should reject legacy string with unknown command and no quotes", async () => {
      const schedule = {
        id: "test-unknown-no-quotes",
        name: "Unknown No Quotes",
        cronExpression: "0 * * * * *",
        command: "restart_server now" as unknown as { type: string; [key: string]: unknown },
        enabled: true,
      } as ScheduledCommand

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(false)
    })

    it("should reject valid say command with empty quoted content", async () => {
      const schedule = {
        id: "test-say-empty",
        name: "Say Empty",
        cronExpression: "0 * * * * *",
        command: 'say ""' as unknown as { type: string; [key: string]: unknown },
        enabled: true,
      } as ScheduledCommand

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(false)
    })

    it("should handle say command with unquoted message", async () => {
      const schedule = {
        id: "test-say-unquoted",
        name: "Say Unquoted",
        cronExpression: "0 * * * * *",
        command: "say Hello World" as unknown as { type: string; [key: string]: unknown },
        enabled: true,
      } as ScheduledCommand

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(true)
    })

    it("should handle amx_csay with color and unquoted message", async () => {
      const schedule = {
        id: "test-amx-csay-unquoted",
        name: "AMX CSay Unquoted",
        cronExpression: "0 * * * * *",
        command: "amx_csay green Hello World" as unknown as {
          type: string
          [key: string]: unknown
        },
        enabled: true,
      } as ScheduledCommand

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(true)
    })

    it("should reject non-object/non-string command format", async () => {
      const schedule = {
        id: "test-number-cmd",
        name: "Number Command",
        cronExpression: "0 * * * * *",
        command: 12345 as unknown as { type: string; [key: string]: unknown },
        enabled: true,
      } as ScheduledCommand

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(false)
    })

    it("should reject invalid cron expression in base validate", async () => {
      const schedule: ScheduledCommand = {
        id: "test-bad-cron",
        name: "Bad Cron",
        cronExpression: "invalid",
        command: { type: "say", message: "test" },
        enabled: true,
      }

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(false)
    })

    it("should reject schedule with no id", async () => {
      const schedule = {
        id: "",
        name: "No ID",
        cronExpression: "0 * * * * *",
        command: { type: "say", message: "test" },
        enabled: true,
      } as ScheduledCommand

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(false)
    })

    it("should reject schedule with no command", async () => {
      const schedule = {
        id: "test-no-cmd",
        name: "No Command",
        cronExpression: "0 * * * * *",
        command: null as unknown as { type: string; [key: string]: unknown },
        enabled: true,
      } as ScheduledCommand

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(false)
    })

    it("should handle validation error in subclass gracefully", async () => {
      // Create a command that throws during validateCommand
      const throwingSchedule = {
        id: "test-throw",
        name: "Throw Test",
        cronExpression: "0 * * * * *",
        command: {
          type: "say",
          get message() {
            throw new Error("getter error")
          },
        },
        enabled: true,
      } as unknown as ScheduledCommand

      const isValid = await command.validate(throwingSchedule)
      expect(isValid).toBe(false)
    })

    it("should validate 5-part cron expression", async () => {
      const schedule: ScheduledCommand = {
        id: "test-5part",
        name: "5 Part Cron",
        cronExpression: "* * * * *",
        command: { type: "say", message: "Hello" },
        enabled: true,
      }

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(true)
    })

    it("should validate 6-part cron expression", async () => {
      const schedule: ScheduledCommand = {
        id: "test-6part",
        name: "6 Part Cron",
        cronExpression: "0 * * * * *",
        command: { type: "say", message: "Hello" },
        enabled: true,
      }

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(true)
    })

    it("should reject 4-part cron expression", async () => {
      const schedule: ScheduledCommand = {
        id: "test-4part",
        name: "4 Part Cron",
        cronExpression: "* * * *",
        command: { type: "say", message: "Hello" },
        enabled: true,
      }

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(false)
    })

    it("should reject 7-part cron expression", async () => {
      const schedule: ScheduledCommand = {
        id: "test-7part",
        name: "7 Part Cron",
        cronExpression: "* * * * * * *",
        command: { type: "say", message: "Hello" },
        enabled: true,
      }

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(false)
    })
  })

  describe("execute (error in base class)", () => {
    it("should catch errors from executeCommand and return zero counts", async () => {
      // Make findActiveServersWithRcon throw to trigger base class catch
      mockServerService.findActiveServersWithRcon.mockRejectedValue(new Error("DB error"))

      const schedule: ScheduledCommand = {
        id: "test-base-error",
        name: "Base Error",
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
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Scheduled command failed"),
        expect.any(Object),
      )
    })
  })

  describe("formatExecutionTime", () => {
    it("should format milliseconds less than 1000 as ms", () => {
      // Access protected method via any cast
      const formatted = (command as any).formatExecutionTime(500)
      expect(formatted).toBe("500ms")
    })

    it("should format milliseconds >= 1000 as seconds", () => {
      const formatted = (command as any).formatExecutionTime(2500)
      expect(formatted).toBe("2.50s")
    })

    it("should format exactly 1000ms as seconds", () => {
      const formatted = (command as any).formatExecutionTime(1000)
      expect(formatted).toBe("1.00s")
    })
  })
})
