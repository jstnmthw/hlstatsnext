/**
 * Player Status Enricher Tests
 */

import type { GeoIPService } from "@/modules/geoip/geoip.service"
import type { PlayerInfo } from "@/modules/rcon/types/rcon.types"
import { createMockGeoIPService } from "@/tests/mocks/geoip.service.mock"
import { createMockLogger } from "@/tests/mocks/logger"
import { createMockPlayerRepository } from "@/tests/mocks/player.repository.mock"
import { createMockServerService } from "@/tests/mocks/server.service.mock"
import type { Player } from "@repo/db/client"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PlayerStatusEnricher } from "./player-status-enricher"

describe("PlayerStatusEnricher", () => {
  let enricher: PlayerStatusEnricher
  const mockLogger = createMockLogger()
  const mockPlayerRepository = createMockPlayerRepository()
  const mockServerService = createMockServerService()
  const mockGeoipService = createMockGeoIPService() as unknown as GeoIPService

  beforeEach(() => {
    vi.clearAllMocks()
    enricher = new PlayerStatusEnricher(
      mockPlayerRepository,
      mockServerService,
      mockGeoipService,
      mockLogger,
    )
  })

  describe("enrichPlayerGeoData", () => {
    const mockPlayer = {
      playerId: 1,
      lastName: "TestPlayer",
      lastAddress: "192.168.1.100",
      city: "",
      country: "",
      flag: null,
      lat: null,
      lng: null,
    } as Player

    const mockPlayerInfo: PlayerInfo = {
      name: "TestPlayer",
      userid: 1,
      uniqueid: "STEAM_0:1:123456",
      isBot: false,
      frag: 5,
      time: "00:10",
      ping: 25,
      loss: 0,
      address: "192.168.1.100:27005",
    }

    it("should enrich player geo data when enrichment is enabled", async () => {
      // Mock server configurations
      vi.mocked(mockServerService.getServerConfigBoolean)
        .mockResolvedValueOnce(true) // EnableGeoIPEnrichment = true
        .mockResolvedValueOnce(true) // IgnoreBots = true

      // Mock server service
      vi.mocked(mockServerService.findById).mockResolvedValue({
        serverId: 1,
        game: "cstrike",
        name: "Test Server",
        address: "127.0.0.1",
        port: 27015,
        activeMap: "de_dust2",
        lastEvent: new Date(),
      })

      // Mock player repository
      vi.mocked(mockPlayerRepository.findByUniqueId).mockResolvedValue(mockPlayer)

      // Mock GeoIP service
      vi.mocked(mockGeoipService.lookup).mockResolvedValue({
        city: "New York",
        country: "United States",
        flag: "US",
        latitude: 40.7128,
        longitude: -74.006,
      })

      await enricher.enrichPlayerGeoData(1, [mockPlayerInfo])

      expect(mockServerService.getServerConfigBoolean).toHaveBeenCalledWith(
        1,
        "EnableGeoIPEnrichment",
        true,
      )
      expect(mockServerService.getServerConfigBoolean).toHaveBeenCalledWith(1, "IgnoreBots", true)
      expect(mockPlayerRepository.findByUniqueId).toHaveBeenCalledWith(
        "STEAM_0:1:123456",
        "cstrike",
      )
      expect(mockGeoipService.lookup).toHaveBeenCalledWith("192.168.1.100")
      expect(mockPlayerRepository.update).toHaveBeenCalledWith(1, {
        city: "New York",
        country: "United States",
        flag: "US",
        lat: 40.7128,
        lng: -74.006,
        lastAddress: "192.168.1.100",
      })
    })

    it("should skip enrichment when disabled", async () => {
      vi.mocked(mockServerService.getServerConfigBoolean).mockResolvedValue(false) // EnableGeoIPEnrichment = false

      await enricher.enrichPlayerGeoData(1, [mockPlayerInfo])

      expect(mockLogger.debug).toHaveBeenCalledWith("GeoIP enrichment disabled for server 1")
      expect(mockPlayerRepository.findByUniqueId).not.toHaveBeenCalled()
      expect(mockGeoipService.lookup).not.toHaveBeenCalled()
      expect(mockPlayerRepository.update).not.toHaveBeenCalled()
    })

    it("should skip bots when IgnoreBots is enabled", async () => {
      const botPlayerInfo: PlayerInfo = {
        ...mockPlayerInfo,
        name: "BOT Alice",
        uniqueid: "BOT",
        isBot: true,
      }

      vi.mocked(mockServerService.getServerConfigBoolean)
        .mockResolvedValueOnce(true) // EnableGeoIPEnrichment = true
        .mockResolvedValueOnce(true) // IgnoreBots = true

      vi.mocked(mockServerService.findById).mockResolvedValue({
        serverId: 1,
        game: "cstrike",
        name: "Test Server",
        address: "127.0.0.1",
        port: 27015,
        activeMap: "de_dust2",
        lastEvent: new Date(),
      })

      await enricher.enrichPlayerGeoData(1, [botPlayerInfo])

      expect(mockLogger.debug).toHaveBeenCalledWith("No players need geo enrichment on server 1")
      expect(mockPlayerRepository.findByUniqueId).not.toHaveBeenCalled()
      expect(mockGeoipService.lookup).not.toHaveBeenCalled()
      expect(mockPlayerRepository.update).not.toHaveBeenCalled()
    })

    it("should include bots when IgnoreBots is disabled", async () => {
      const botPlayerInfo: PlayerInfo = {
        ...mockPlayerInfo,
        name: "BOT Alice",
        uniqueid: "STEAM_0:1:999999", // Use real Steam ID instead of "BOT"
        isBot: true,
        address: "127.0.0.1:27005",
      }

      const mockBot: Player = {
        ...mockPlayer,
        playerId: 2,
        lastName: "BOT Alice",
        lastAddress: "127.0.0.1",
      }

      vi.mocked(mockServerService.getServerConfigBoolean)
        .mockResolvedValueOnce(true) // EnableGeoIPEnrichment = true
        .mockResolvedValueOnce(false) // IgnoreBots = false

      vi.mocked(mockServerService.findById).mockResolvedValue({
        serverId: 1,
        game: "cstrike",
        name: "Test Server",
        address: "127.0.0.1",
        port: 27015,
        activeMap: "de_dust2",
        lastEvent: new Date(),
      })

      vi.mocked(mockPlayerRepository.findByUniqueId).mockResolvedValue(mockBot)
      vi.mocked(mockGeoipService.lookup).mockResolvedValue({
        city: "Local",
        country: "Local Network",
        flag: "LO",
        latitude: 0,
        longitude: 0,
      })

      await enricher.enrichPlayerGeoData(1, [botPlayerInfo])

      expect(mockPlayerRepository.findByUniqueId).toHaveBeenCalledWith(
        "STEAM_0:1:999999",
        "cstrike",
      )
      expect(mockGeoipService.lookup).toHaveBeenCalledWith("127.0.0.1")
      expect(mockPlayerRepository.update).toHaveBeenCalledWith(2, {
        city: "Local",
        country: "Local Network",
        flag: "LO",
        lat: 0,
        lng: 0,
        lastAddress: "127.0.0.1",
      })
    })

    it("should skip players without valid IP addresses", async () => {
      const playersWithoutIPs = [
        { ...mockPlayerInfo, address: undefined },
        { ...mockPlayerInfo, address: "loopback" },
        { ...mockPlayerInfo, address: "" },
      ]

      vi.mocked(mockServerService.getServerConfigBoolean)
        .mockResolvedValueOnce(true) // EnableGeoIPEnrichment = true
        .mockResolvedValueOnce(true) // IgnoreBots = true

      vi.mocked(mockServerService.findById).mockResolvedValue({
        serverId: 1,
        game: "cstrike",
        name: "Test Server",
        address: "127.0.0.1",
        port: 27015,
        activeMap: "de_dust2",
        lastEvent: new Date(),
      })

      await enricher.enrichPlayerGeoData(1, playersWithoutIPs)

      expect(mockLogger.debug).toHaveBeenCalledWith("No players need geo enrichment on server 1")
      expect(mockPlayerRepository.findByUniqueId).not.toHaveBeenCalled()
      expect(mockGeoipService.lookup).not.toHaveBeenCalled()
      expect(mockPlayerRepository.update).not.toHaveBeenCalled()
    })

    it("should skip players with invalid Steam IDs", async () => {
      const playersWithoutSteamIDs = [
        { ...mockPlayerInfo, uniqueid: "" },
        { ...mockPlayerInfo, uniqueid: "BOT", isBot: false }, // Non-bot with BOT ID
      ]

      vi.mocked(mockServerService.getServerConfigBoolean)
        .mockResolvedValueOnce(true) // EnableGeoIPEnrichment = true
        .mockResolvedValueOnce(true) // IgnoreBots = true

      vi.mocked(mockServerService.findById).mockResolvedValue({
        serverId: 1,
        game: "cstrike",
        name: "Test Server",
        address: "127.0.0.1",
        port: 27015,
        activeMap: "de_dust2",
        lastEvent: new Date(),
      })

      await enricher.enrichPlayerGeoData(1, playersWithoutSteamIDs)

      expect(mockLogger.debug).toHaveBeenCalledWith("No players need geo enrichment on server 1")
      expect(mockPlayerRepository.findByUniqueId).not.toHaveBeenCalled()
      expect(mockGeoipService.lookup).not.toHaveBeenCalled()
      expect(mockPlayerRepository.update).not.toHaveBeenCalled()
    })

    it("should skip players already enriched recently", async () => {
      // First enrichment
      vi.mocked(mockServerService.getServerConfigBoolean)
        .mockResolvedValueOnce(true) // EnableGeoIPEnrichment = true
        .mockResolvedValueOnce(true) // IgnoreBots = true

      vi.mocked(mockServerService.findById).mockResolvedValue({
        serverId: 1,
        game: "cstrike",
        name: "Test Server",
        address: "127.0.0.1",
        port: 27015,
        activeMap: "de_dust2",
        lastEvent: new Date(),
      })

      vi.mocked(mockPlayerRepository.findByUniqueId).mockResolvedValue(mockPlayer)
      vi.mocked(mockGeoipService.lookup).mockResolvedValue({
        city: "New York",
        country: "United States",
        flag: "US",
        latitude: 40.7128,
        longitude: -74.006,
      })

      // First call should process
      await enricher.enrichPlayerGeoData(1, [mockPlayerInfo])

      expect(mockPlayerRepository.update).toHaveBeenCalledTimes(1)
      vi.clearAllMocks()

      // Second call immediately after should be cached
      vi.mocked(mockServerService.getServerConfigBoolean)
        .mockResolvedValueOnce(true) // EnableGeoIPEnrichment = true
        .mockResolvedValueOnce(true) // IgnoreBots = true

      vi.mocked(mockServerService.findById).mockResolvedValue({
        serverId: 1,
        game: "cstrike",
        name: "Test Server",
        address: "127.0.0.1",
        port: 27015,
        activeMap: "de_dust2",
        lastEvent: new Date(),
      })

      await enricher.enrichPlayerGeoData(1, [mockPlayerInfo])

      expect(mockPlayerRepository.findByUniqueId).not.toHaveBeenCalled()
      expect(mockGeoipService.lookup).not.toHaveBeenCalled()
      expect(mockPlayerRepository.update).not.toHaveBeenCalled()
    })

    it("should handle GeoIP lookup failures gracefully", async () => {
      vi.mocked(mockServerService.getServerConfigBoolean)
        .mockResolvedValueOnce(true) // EnableGeoIPEnrichment = true
        .mockResolvedValueOnce(true) // IgnoreBots = true

      vi.mocked(mockServerService.findById).mockResolvedValue({
        serverId: 1,
        game: "cstrike",
        name: "Test Server",
        address: "127.0.0.1",
        port: 27015,
        activeMap: "de_dust2",
        lastEvent: new Date(),
      })

      vi.mocked(mockPlayerRepository.findByUniqueId).mockResolvedValue(mockPlayer)
      vi.mocked(mockGeoipService.lookup).mockRejectedValue(new Error("GeoIP service unavailable"))

      await enricher.enrichPlayerGeoData(1, [mockPlayerInfo])

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "GeoIP lookup failed for 192.168.1.100: Error: GeoIP service unavailable",
      )
      expect(mockPlayerRepository.update).not.toHaveBeenCalled()
    })

    it("should handle player not found in database", async () => {
      vi.mocked(mockServerService.getServerConfigBoolean)
        .mockResolvedValueOnce(true) // EnableGeoIPEnrichment = true
        .mockResolvedValueOnce(true) // IgnoreBots = true

      vi.mocked(mockServerService.findById).mockResolvedValue({
        serverId: 1,
        game: "cstrike",
        name: "Test Server",
        address: "127.0.0.1",
        port: 27015,
        activeMap: "de_dust2",
        lastEvent: new Date(),
      })

      vi.mocked(mockPlayerRepository.findByUniqueId).mockResolvedValue(null)

      await enricher.enrichPlayerGeoData(1, [mockPlayerInfo])

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Player not found: TestPlayer (STEAM_0:1:123456)",
      )
      expect(mockGeoipService.lookup).not.toHaveBeenCalled()
      expect(mockPlayerRepository.update).not.toHaveBeenCalled()
    })

    it("should process players in batches", async () => {
      // Create 7 players to test batch size of 5
      const players: PlayerInfo[] = Array.from({ length: 7 }, (_, i) => ({
        ...mockPlayerInfo,
        name: `Player${i}`,
        userid: i + 1,
        uniqueid: `STEAM_0:1:${i}`,
        address: `192.168.1.${100 + i}:27005`,
      }))

      vi.mocked(mockServerService.getServerConfigBoolean).mockResolvedValue(true) // Both configs enabled

      vi.mocked(mockServerService.findById).mockResolvedValue({
        serverId: 1,
        game: "cstrike",
        name: "Test Server",
        address: "127.0.0.1",
        port: 27015,
        activeMap: "de_dust2",
        lastEvent: new Date(),
      })

      vi.mocked(mockPlayerRepository.findByUniqueId).mockResolvedValue(mockPlayer)
      vi.mocked(mockGeoipService.lookup).mockResolvedValue({
        city: "New York",
        country: "United States",
        flag: "US",
        latitude: 40.7128,
        longitude: -74.006,
      })

      await enricher.enrichPlayerGeoData(1, players)

      // Should process all 7 players
      expect(mockPlayerRepository.findByUniqueId).toHaveBeenCalledTimes(7)
      expect(mockGeoipService.lookup).toHaveBeenCalledTimes(7)
      expect(mockPlayerRepository.update).toHaveBeenCalledTimes(7)

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Processed 7 players for geo enrichment on server 1",
      )
    })
  })

  describe("cleanCache", () => {
    it("should clean expired cache entries", () => {
      // This is a simple test since we can't easily test private cache behavior
      // Just ensure the method doesn't throw
      expect(() => enricher.cleanCache()).not.toThrow()
    })
  })
})
