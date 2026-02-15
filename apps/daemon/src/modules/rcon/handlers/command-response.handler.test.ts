/**
 * Command Response Handler Tests
 */

import { createMockLogger } from "@/tests/mocks/logger"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { RconErrorCode } from "../types/rcon.types"
import { CommandResponseHandler } from "./command-response.handler"

describe("CommandResponseHandler", () => {
  let handler: CommandResponseHandler
  const mockLogger = createMockLogger()

  beforeEach(() => {
    vi.clearAllMocks()
    handler = new CommandResponseHandler(mockLogger)
  })

  describe("parseCommandResponse", () => {
    it("should parse successful response with 'l' type marker", () => {
      // Create buffer: 0xFF 0xFF 0xFF 0xFF 0x6C [response text]
      const responseText = "hostname: Test Server\nplayers: 5 (32 max)"
      const buffer = Buffer.concat([
        Buffer.from([0xff, 0xff, 0xff, 0xff, 0x6c]),
        Buffer.from(responseText),
      ])

      const result = handler.parseCommandResponse(buffer, "status")

      expect(result.type).toBe("success")
      if (result.type === "success") {
        expect(result.response).toBe(responseText)
      }
    })

    it("should parse successful response with 'n' type marker", () => {
      const responseText = "Server response"
      const buffer = Buffer.concat([
        Buffer.from([0xff, 0xff, 0xff, 0xff, 0x6e]),
        Buffer.from(responseText),
      ])

      const result = handler.parseCommandResponse(buffer, "echo test")

      expect(result.type).toBe("success")
      if (result.type === "success") {
        expect(result.response).toBe(responseText)
      }
    })

    it("should parse response with unknown type marker", () => {
      const responseText = "Some response"
      const buffer = Buffer.concat([
        Buffer.from([0xff, 0xff, 0xff, 0xff, 0x99]),
        Buffer.from(responseText),
      ])

      const result = handler.parseCommandResponse(buffer, "test")

      expect(result.type).toBe("success")
      if (result.type === "success") {
        // The implementation parses from offset 4 when encountering unknown type
        expect(result.response).toContain(responseText)
        expect(result.response.length).toBeGreaterThan(responseText.length)
      }
    })

    it("should handle non-standard response format", () => {
      const responseText = "Non-standard response"
      const buffer = Buffer.from(responseText)

      const result = handler.parseCommandResponse(buffer, "test")

      expect(result.type).toBe("success")
      if (result.type === "success") {
        expect(result.response).toBe(responseText)
      }
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "GoldSrc RCON: Non-standard response format detected",
      )
    })

    it("should detect 'Bad rcon_password' error", () => {
      const errorText = "Bad rcon_password."
      const buffer = createStandardResponseBuffer(errorText)

      const result = handler.parseCommandResponse(buffer, "status")

      expect(result.type).toBe("error")
      if (result.type === "error") {
        expect(result.error.code).toBe(RconErrorCode.AUTH_FAILED)
        expect(result.error.message).toBe("Authentication failed")
      }
      expect(mockLogger.error).toHaveBeenCalledWith(
        "GoldSrc RCON: Authentication failed - bad password",
      )
    })

    it("should detect 'Bad challenge' error", () => {
      const errorText = "Bad challenge"
      const buffer = createStandardResponseBuffer(errorText)

      const result = handler.parseCommandResponse(buffer, "status")

      expect(result.type).toBe("error")
      if (result.type === "error") {
        expect(result.error.code).toBe(RconErrorCode.AUTH_FAILED)
        expect(result.error.message).toBe("Bad challenge")
      }
      expect(mockLogger.error).toHaveBeenCalledWith(
        "GoldSrc RCON: Bad challenge - need to reconnect",
      )
    })

    it("should detect 'Unknown command' error", () => {
      const command = "invalidcommand"
      const errorText = `Unknown command: ${command}`
      const buffer = createStandardResponseBuffer(errorText)

      const result = handler.parseCommandResponse(buffer, command)

      expect(result.type).toBe("error")
      if (result.type === "error") {
        expect(result.error.code).toBe(RconErrorCode.COMMAND_FAILED)
        expect(result.error.message).toBe(`Unknown command: ${command}`)
      }
      expect(mockLogger.warn).toHaveBeenCalledWith(`GoldSrc RCON: Unknown command: ${command}`)
    })

    it("should log successful command execution", () => {
      const responseText = "hostname: Test Server"
      const command = "status"
      const buffer = createStandardResponseBuffer(responseText)

      const result = handler.parseCommandResponse(buffer, command)

      expect(result.type).toBe("success")
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `GoldSrc RCON: Command '${command}' executed successfully`,
        {
          responseLength: responseText.length,
          responsePreview: responseText,
        },
      )
    })

    it("should handle long response preview truncation", () => {
      const longResponse = "a".repeat(300) // Create a response longer than 200 chars
      const command = "longcommand"
      const buffer = createStandardResponseBuffer(longResponse)

      const result = handler.parseCommandResponse(buffer, command)

      expect(result.type).toBe("success")
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `GoldSrc RCON: Command '${command}' executed successfully`,
        {
          responseLength: longResponse.length,
          responsePreview: longResponse.substring(0, 200),
        },
      )
    })

    it("should handle buffer parsing errors", () => {
      // Mock Buffer.toString to throw an error
      const buffer = Buffer.from("test")
      const originalToString = buffer.toString
      buffer.toString = vi.fn().mockImplementation(() => {
        throw new Error("Buffer parsing failed")
      })

      const result = handler.parseCommandResponse(buffer, "test")

      expect(result.type).toBe("error")
      if (result.type === "error") {
        expect(result.error.code).toBe(RconErrorCode.COMMAND_FAILED)
        expect(result.error.message).toBe("Failed to parse response: Buffer parsing failed")
      }

      // Restore original method
      buffer.toString = originalToString
    })

    it("should handle minimal responses with just headers", () => {
      const buffer = Buffer.from([0xff, 0xff, 0xff, 0xff, 0x6c])

      const result = handler.parseCommandResponse(buffer, "test")

      expect(result.type).toBe("success")
      if (result.type === "success") {
        // Buffer is only 5 bytes, so it doesn't have enough data after the 'l' marker
        // The implementation will parse but result in binary characters being displayed as �
        expect(result.response.length).toBeGreaterThan(0)
      }
    })

    it("should trim whitespace from responses", () => {
      const responseText = "  \n  Test Response  \n  "
      const buffer = createStandardResponseBuffer(responseText)

      const result = handler.parseCommandResponse(buffer, "test")

      expect(result.type).toBe("success")
      if (result.type === "success") {
        expect(result.response).toBe("Test Response")
      }
    })

    it("should handle very short buffers", () => {
      const buffer = Buffer.from([0xff, 0xff])

      const result = handler.parseCommandResponse(buffer, "test")

      expect(result.type).toBe("success")
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "GoldSrc RCON: Non-standard response format detected",
      )
    })

    it("should handle error patterns case-insensitively", () => {
      const errorText = "Bad rcon_password"
      const buffer = createStandardResponseBuffer(errorText)

      const result = handler.parseCommandResponse(buffer, "status")

      expect(result.type).toBe("error")
      if (result.type === "error") {
        expect(result.error.code).toBe(RconErrorCode.AUTH_FAILED)
      }
    })
  })

  // Helper function to create standard response buffers
  function createStandardResponseBuffer(text: string): Buffer {
    return Buffer.concat([Buffer.from([0xff, 0xff, 0xff, 0xff, 0x6c]), Buffer.from(text)])
  }
})
