/**
 * Validation Utilities Unit Tests
 */

import { describe, expect, it } from "vitest"
import {
  sanitizePlayerName,
  validateEventType,
  validatePlayerName,
  validateServerId,
  validateSteamId,
} from "./validation"

describe("Validation Utilities", () => {
  describe("validateSteamId", () => {
    it("should validate correct Steam64 IDs", () => {
      const validSteamIds = [
        "76561198000000000",
        "76561198123456789",
        "76561198999999999",
        "76561197960265728", // Gabe Newell's Steam ID
        "11111111111111111",
        "99999999999999999",
      ]

      validSteamIds.forEach((steamId) => {
        expect(validateSteamId(steamId)).toBe(true)
      })
    })

    it("should accept BOT as valid Steam ID", () => {
      expect(validateSteamId("BOT")).toBe(true)
      expect(validateSteamId("bot")).toBe(true)
      expect(validateSteamId("Bot")).toBe(true)
      expect(validateSteamId("bOt")).toBe(true)
    })

    it("should accept BOT:name format as valid Steam ID", () => {
      expect(validateSteamId("BOT:Easy")).toBe(true)
      expect(validateSteamId("BOT:Hard")).toBe(true)
      expect(validateSteamId("BOT:Expert")).toBe(true)
      expect(validateSteamId("BOT:Bot_Name_123")).toBe(true)
      expect(validateSteamId("BOT:Player-Name")).toBe(true)
      expect(validateSteamId("BOT:Test Bot")).toBe(true)
      expect(validateSteamId("bot:lowercase")).toBe(true)
      expect(validateSteamId("Bot:MixedCase")).toBe(true)
      expect(validateSteamId("bOt:WeIrDcAsE")).toBe(true)
    })

    it("should handle BOT edge cases", () => {
      expect(validateSteamId("BOT:")).toBe(true) // Empty name after colon
      expect(validateSteamId("BOT: ")).toBe(true) // Just space after colon
      expect(validateSteamId("BOT:  Multiple  Spaces  ")).toBe(true)
      expect(validateSteamId(" BOT:Name ")).toBe(true) // Whitespace around entire string
    })

    it("should reject invalid Steam ID formats (after normalization)", () => {
      const invalidSteamIds = [
        "1234567890123456", // 16 digits
        "123456789012345678", // 18 digits
        "7656119800000000a", // Contains letter
        "765611980000000-0", // Contains dash
        "STEAM_X:0:12345", // Bad X
        "[Z:1:12345]", // Unsupported type
        "", // Empty string
        "12345", // Too short
        "765611980000000000000", // Too long
      ]

      invalidSteamIds.forEach((steamId) => {
        expect(validateSteamId(steamId)).toBe(false)
      })
    })

    it("should accept Steam2 and Steam3 formats via normalization", () => {
      expect(validateSteamId("STEAM_0:1:470900")).toBe(true)
      expect(validateSteamId("STEAM_1:0:12345")).toBe(true)
      expect(validateSteamId("[U:1:12345]")).toBe(true)
    })

    it("should handle null and undefined inputs", () => {
      expect(validateSteamId(null as unknown)).toBe(false)
      expect(validateSteamId(undefined as unknown)).toBe(false)
    })

    it("should handle non-string inputs", () => {
      expect(validateSteamId(76561198000000000 as unknown)).toBe(false)
      expect(validateSteamId({} as unknown)).toBe(false)
      expect(validateSteamId([] as unknown)).toBe(false)
      expect(validateSteamId(true as unknown)).toBe(false)
    })

    it("should handle whitespace in Steam IDs", () => {
      // Leading/trailing whitespace should be trimmed and accepted
      expect(validateSteamId(" 76561198000000000")).toBe(true)
      expect(validateSteamId("76561198000000000 ")).toBe(true)
      expect(validateSteamId(" 76561198000000000 ")).toBe(true)
      // Internal whitespace remains invalid
      expect(validateSteamId("76561198 000000000")).toBe(false)
    })

    it("should handle special characters", () => {
      // Trailing control characters should be trimmed and accepted
      expect(validateSteamId("76561198000000000\n")).toBe(true)
      expect(validateSteamId("76561198000000000\t")).toBe(true)
      expect(validateSteamId("76561198000000000\r")).toBe(true)
    })
  })

  describe("validatePlayerName", () => {
    it("should validate correct player names", () => {
      const validNames = [
        "Player1",
        "TestPlayer",
        "Pro_Gamer_2023",
        "User with spaces",
        "ñoñó", // Unicode
        "🎮 Gamer",
        "A", // Single character
        "A".repeat(64), // Maximum length
        "Player-Name",
        "Player.Name",
        "[TAG] PlayerName",
      ]

      validNames.forEach((name) => {
        expect(validatePlayerName(name)).toBe(true)
      })
    })

    it("should reject invalid player names", () => {
      const invalidNames = [
        "", // Empty
        "   ", // Only spaces
        "\t\n\r", // Only whitespace
        "A".repeat(65), // Too long
      ]

      invalidNames.forEach((name) => {
        expect(validatePlayerName(name)).toBe(false)
      })
    })

    it("should handle null and undefined inputs", () => {
      expect(validatePlayerName(null as unknown)).toBe(false)
      expect(validatePlayerName(undefined as unknown)).toBe(false)
    })

    it("should handle non-string inputs", () => {
      expect(validatePlayerName(123 as unknown)).toBe(false)
      expect(validatePlayerName({} as unknown)).toBe(false)
      expect(validatePlayerName([] as unknown)).toBe(false)
      expect(validatePlayerName(true as unknown)).toBe(false)
    })

    it("should trim whitespace when validating", () => {
      expect(validatePlayerName(" Player ")).toBe(true)
      expect(validatePlayerName("\tPlayer\t")).toBe(true)
      expect(validatePlayerName("\nPlayer\n")).toBe(true)
      expect(validatePlayerName("  A  ")).toBe(true)
    })

    it("should handle boundary length cases", () => {
      expect(validatePlayerName("A".repeat(1))).toBe(true) // Minimum valid
      expect(validatePlayerName("A".repeat(64))).toBe(true) // Maximum valid
      expect(validatePlayerName("A".repeat(65))).toBe(false) // Too long

      // With spaces that get trimmed
      expect(validatePlayerName(" " + "A".repeat(62) + " ")).toBe(true) // Trims to 62
      expect(validatePlayerName(" " + "A".repeat(64) + " ")).toBe(true) // Trims to 64, valid
    })
  })

  describe("validateServerId", () => {
    it("should validate correct server IDs", () => {
      const validServerIds = [1, 10, 999, 1000000, Number.MAX_SAFE_INTEGER]

      validServerIds.forEach((serverId) => {
        expect(validateServerId(serverId)).toBe(true)
      })
    })

    it("should reject invalid server IDs", () => {
      const invalidServerIds = [0, -1, -999, Number.NEGATIVE_INFINITY, Number.NaN]

      invalidServerIds.forEach((serverId) => {
        expect(validateServerId(serverId)).toBe(false)
      })
    })

    it("should handle null and undefined inputs", () => {
      expect(validateServerId(null)).toBe(false)
      expect(validateServerId(undefined)).toBe(false)
    })

    it("should handle non-number inputs", () => {
      expect(validateServerId("1")).toBe(false)
      expect(validateServerId("123")).toBe(false)
      expect(validateServerId({})).toBe(false)
      expect(validateServerId([])).toBe(false)
      expect(validateServerId(true)).toBe(false)
    })

    it("should handle floating point numbers", () => {
      expect(validateServerId(1.5)).toBe(true) // JavaScript treats as number > 0
      expect(validateServerId(0.1)).toBe(true)
      expect(validateServerId(0.0)).toBe(false)
      expect(validateServerId(-0.1)).toBe(false)
    })

    it("should handle edge cases", () => {
      expect(validateServerId(Number.MAX_VALUE)).toBe(true)
      expect(validateServerId(Number.MIN_VALUE)).toBe(true) // Smallest positive number
      expect(validateServerId(Number.POSITIVE_INFINITY)).toBe(true)
    })
  })

  describe("validateEventType", () => {
    it("should validate correct event types", () => {
      const validEventTypes = [
        "PLAYER_CONNECT",
        "PLAYER_KILL",
        "WEAPON_FIRE",
        "ROUND_START",
        "BOMB_PLANT",
        "custom_event",
        "Event_With_Underscores",
        "Event-With-Dashes",
        "Event.With.Dots",
        "EventWithNumbers123",
        "A", // Single character
        "A".repeat(64), // Maximum length event type
      ]

      validEventTypes.forEach((eventType) => {
        expect(validateEventType(eventType)).toBe(true)
      })
    })

    it("should reject invalid event types", () => {
      const invalidEventTypes = [
        "", // Empty string
      ]

      invalidEventTypes.forEach((eventType) => {
        expect(validateEventType(eventType)).toBe(false)
      })
    })

    it("should handle null and undefined inputs", () => {
      expect(validateEventType(null as unknown)).toBe(false)
      expect(validateEventType(undefined as unknown)).toBe(false)
    })

    it("should handle non-string inputs", () => {
      expect(validateEventType(123 as unknown)).toBe(false)
      expect(validateEventType({} as unknown)).toBe(false)
      expect(validateEventType([] as unknown)).toBe(false)
      expect(validateEventType(true as unknown)).toBe(false)
    })

    it("should handle whitespace event types", () => {
      expect(validateEventType(" ")).toBe(true) // Single space is valid
      expect(validateEventType("  ")).toBe(true) // Multiple spaces valid
      expect(validateEventType("\t")).toBe(true) // Tab is valid
      expect(validateEventType("\n")).toBe(true) // Newline is valid
    })

    it("should handle special characters", () => {
      expect(validateEventType("EVENT_TYPE!")).toBe(true)
      expect(validateEventType("EVENT@TYPE")).toBe(true)
      expect(validateEventType("EVENT#TYPE")).toBe(true)
      expect(validateEventType("EVENT$TYPE")).toBe(true)
      expect(validateEventType("EVENT%TYPE")).toBe(true)
    })
  })

  describe("sanitizePlayerName", () => {
    it("should sanitize basic player names", () => {
      expect(sanitizePlayerName("Player Name")).toBe("Player_Name")
      expect(sanitizePlayerName("Pro Gamer 2023")).toBe("Pro_Gamer_2023")
      expect(sanitizePlayerName("User-With-Dashes")).toBe("User-With-Dashes")
      expect(sanitizePlayerName("User_With_Underscores")).toBe("User_With_Underscores")
    })

    it("should remove exotic characters", () => {
      expect(sanitizePlayerName("Player@Name")).toBe("PlayerName")
      expect(sanitizePlayerName("Player#123")).toBe("Player123")
      expect(sanitizePlayerName("Player$Money")).toBe("PlayerMoney")
      expect(sanitizePlayerName("Player%Percent")).toBe("PlayerPercent")
      expect(sanitizePlayerName("Player&Ampersand")).toBe("PlayerAmpersand")
      expect(sanitizePlayerName("Player*Star")).toBe("PlayerStar")
      expect(sanitizePlayerName("Player+Plus")).toBe("PlayerPlus")
      expect(sanitizePlayerName("Player=Equals")).toBe("PlayerEquals")
    })

    it("should handle Unicode and special characters", () => {
      expect(sanitizePlayerName("Plàyér Ñáme")).toBe("Plyr_me")
      expect(sanitizePlayerName("🎮 Gamer 🎯")).toBe("_Gamer_")
      expect(sanitizePlayerName("тест игрок")).toBe("_")
      expect(sanitizePlayerName("ñoñó")).toBe("o")
    })

    it("should trim whitespace", () => {
      expect(sanitizePlayerName("  Player Name  ")).toBe("Player_Name")
      expect(sanitizePlayerName("\tPlayer\tName\t")).toBe("Player_Name")
      expect(sanitizePlayerName("\nPlayer\nName\n")).toBe("Player_Name")
    })

    it("should replace multiple spaces with single underscores", () => {
      expect(sanitizePlayerName("Player    Name")).toBe("Player_Name")
      expect(sanitizePlayerName("Pro  Gamer   2023")).toBe("Pro_Gamer_2023")
      expect(sanitizePlayerName("Multiple     Spaces")).toBe("Multiple_Spaces")
    })

    it("should limit length to 48 characters", () => {
      const longName = "A".repeat(60)
      const sanitized = sanitizePlayerName(longName)
      expect(sanitized).toBe("A".repeat(48))
      expect(sanitized.length).toBe(48)
    })

    it("should handle edge cases", () => {
      expect(sanitizePlayerName("")).toBe("")
      expect(sanitizePlayerName("   ")).toBe("")
      expect(sanitizePlayerName("A")).toBe("A")
      expect(sanitizePlayerName("123")).toBe("123")
    })

    it("should preserve valid characters", () => {
      const validName = "PlayerName123_Test-User"
      expect(sanitizePlayerName(validName)).toBe(validName)
    })

    it("should handle only exotic characters", () => {
      expect(sanitizePlayerName("!@#$%^&*()")).toBe("")
      expect(sanitizePlayerName("🎮🎯🎲")).toBe("")
      expect(sanitizePlayerName("ñáéíóú")).toBe("")
    })

    it("should handle mixed valid and invalid characters", () => {
      expect(sanitizePlayerName("Player@123#Name")).toBe("Player123Name")
      expect(sanitizePlayerName("User$Money_123")).toBe("UserMoney_123")
      expect(sanitizePlayerName("Test&User-Name")).toBe("TestUser-Name")
    })

    it("should handle length boundary with spaces and exotic chars", () => {
      // Create a name that's long and has chars that will be removed
      const longNameWithSpaces =
        "Player Name With Many Spaces And @#$ Special Chars That Will Be Removed And Make This Very Long"
      const sanitized = sanitizePlayerName(longNameWithSpaces)

      expect(sanitized.length).toBeLessThanOrEqual(48)
      expect(sanitized).not.toContain("@")
      expect(sanitized).not.toContain("#")
      expect(sanitized).not.toContain("$")
    })

    it("should be consistent with multiple calls", () => {
      const input = "Test@Player Name#123"
      const result1 = sanitizePlayerName(input)
      const result2 = sanitizePlayerName(input)

      expect(result1).toBe(result2)
      expect(result1).toBe("TestPlayer_Name123")
    })

    it("should handle inputs that become empty after sanitization", () => {
      expect(sanitizePlayerName("!@#$%^&*()")).toBe("")
      expect(sanitizePlayerName("   !@#   ")).toBe("")
      expect(sanitizePlayerName("ñáéíóú")).toBe("")
    })
  })

  describe("Integration and edge cases", () => {
    it("should handle all validation functions with null inputs", () => {
      expect(validateSteamId(null)).toBe(false)
      expect(validatePlayerName(null)).toBe(false)
      expect(validateServerId(null)).toBe(false)
      expect(validateEventType(null)).toBe(false)

      // sanitizePlayerName should handle null gracefully
      expect(sanitizePlayerName(null)).toBe("")
    })

    it("should handle all validation functions with undefined inputs", () => {
      expect(validateSteamId(undefined as unknown)).toBe(false)
      expect(validatePlayerName(undefined as unknown)).toBe(false)
      expect(validateServerId(undefined as unknown)).toBe(false)
      expect(validateEventType(undefined as unknown)).toBe(false)

      // sanitizePlayerName should handle undefined gracefully
      expect(sanitizePlayerName(undefined as unknown)).toBe("")
    })

    it("should handle typical gaming scenarios", () => {
      // Valid gaming data
      expect(validateSteamId("76561198123456789")).toBe(true)
      expect(validatePlayerName("[CLAN] Pro_Player_2023")).toBe(true)
      expect(validateServerId(1)).toBe(true)
      expect(validateEventType("PLAYER_KILL")).toBe(true)

      // Sanitize clan tag
      expect(sanitizePlayerName("[CLAN] Pro Player!")).toBe("CLAN_Pro_Player")
    })

    it("should handle bot scenarios", () => {
      expect(validateSteamId("BOT")).toBe(true)
      expect(validateSteamId("BOT:Easy")).toBe(true)
      expect(validateSteamId("BOT:Expert Bot")).toBe(true)
      expect(validatePlayerName("Bot_Easy")).toBe(true)
      expect(validatePlayerName("Expert Bot")).toBe(true)
      expect(sanitizePlayerName("Bot Expert (Hard)")).toBe("Bot_Expert_Hard")
    })

    it("should handle malicious inputs safely", () => {
      // SQL injection attempts
      expect(validatePlayerName("'; DROP TABLE players; --")).toBe(true) // Valid length
      expect(sanitizePlayerName("'; DROP TABLE players; --")).toBe("_DROP_TABLE_players_--")

      // XSS attempts
      expect(sanitizePlayerName('<script>alert("xss")</script>')).toBe("scriptalertxssscript")

      // Path traversal
      expect(sanitizePlayerName("../../../etc/passwd")).toBe("etcpasswd")
    })

    it("should handle very long inputs", () => {
      const veryLongName = "A".repeat(1000)
      const veryLongSteamId = "7".repeat(1000)
      const veryLongEventType = "EVENT_".repeat(100)

      expect(validatePlayerName(veryLongName)).toBe(false)
      expect(validateSteamId(veryLongSteamId)).toBe(false)
      expect(validateEventType(veryLongEventType)).toBe(false)

      const sanitized = sanitizePlayerName(veryLongName)
      expect(sanitized.length).toBe(48)
    })
  })
})
