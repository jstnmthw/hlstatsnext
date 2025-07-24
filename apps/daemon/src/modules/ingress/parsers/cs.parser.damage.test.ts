import { describe, it, expect } from "vitest"
import { CsParser } from "./cs.parser"
import { EventType } from "@/shared/types/events"
import type { PlayerDamageEvent } from "@/modules/player/player.types"

describe("CsParser - Damage Events", () => {
  const parser = new CsParser("cstrike")
  const serverId = 1

  describe("parseDamageEvent", () => {
    it("should parse standard damage event", () => {
      const logLine = `"Player1<2><STEAM_0:1:12345><CT>" attacked "Player2<3><STEAM_0:1:67890><TERRORIST>" with "ak47" (damage "27") (damage_armor "0") (health "73") (armor "100") (hitgroup "chest")`

      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      expect(result.event).toBeDefined()
      expect(result.event?.eventType).toBe(EventType.PLAYER_DAMAGE)

      const damageEvent = result.event as PlayerDamageEvent
      const data = damageEvent.data
      expect(data.attackerId).toBe(2)
      expect(data.victimId).toBe(3)
      expect(data.weapon).toBe("ak47")
      expect(data.damage).toBe(27)
      expect(data.damageArmor).toBe(0)
      expect(data.healthRemaining).toBe(73)
      expect(data.armorRemaining).toBe(100)
      expect(data.hitgroup).toBe("chest")
      expect(data.attackerTeam).toBe("CT")
      expect(data.victimTeam).toBe("TERRORIST")
    })

    it("should parse headshot damage event", () => {
      const logLine = `"Sniper<5><STEAM_0:1:11111><CT>" attacked "Target<8><STEAM_0:1:22222><TERRORIST>" with "awp" (damage "448") (damage_armor "0") (health "0") (armor "0") (hitgroup "head")`

      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      const damageEvent = result.event as PlayerDamageEvent
      const data = damageEvent.data
      expect(data.weapon).toBe("awp")
      expect(data.damage).toBe(448)
      expect(data.hitgroup).toBe("head")
      expect(data.healthRemaining).toBe(0)
    })

    it("should parse damage event without hitgroup", () => {
      const logLine = `"Player1<2><STEAM_0:1:12345><CT>" attacked "Player2<3><STEAM_0:1:67890><TERRORIST>" with "glock" (damage "20") (damage_armor "5") (health "80") (armor "95")`

      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      const damageEvent = result.event as PlayerDamageEvent
      const data = damageEvent.data
      expect(data.hitgroup).toBe("generic")
      expect(data.damage).toBe(20)
      expect(data.damageArmor).toBe(5)
    })

    it("should handle bot damage events", () => {
      const logLine = `"Bot01<2><BOT><CT>" attacked "Player<3><STEAM_0:1:67890><TERRORIST>" with "m4a1" (damage "30") (damage_armor "10") (health "70") (armor "90") (hitgroup "stomach")`

      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      const damageEvent = result.event as PlayerDamageEvent
      const meta = damageEvent.meta
      expect(meta?.killer.isBot).toBe(true)
      expect(meta?.victim.isBot).toBe(false)
    })

    it("should handle team damage", () => {
      const logLine = `"Player1<2><STEAM_0:1:12345><CT>" attacked "Player2<3><STEAM_0:1:67890><CT>" with "he_grenade" (damage "50") (damage_armor "0") (health "50") (armor "100") (hitgroup "generic")`

      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      const damageEvent = result.event as PlayerDamageEvent
      const data = damageEvent.data
      expect(data.attackerTeam).toBe("CT")
      expect(data.victimTeam).toBe("CT")
    })
  })
})
