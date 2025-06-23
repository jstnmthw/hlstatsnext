/**
 * HLStats Daemon v2 - Main Entry Point
 *
 * Modern TypeScript rewrite of the legacy Perl HLstatsX daemon.
 * Collects and processes statistics from Half-Life dedicated game servers.
 */

import { DatabaseClient } from "./database/client.js";
import { GatewayService } from "./services/gateway/gateway.service.js";
import { IngressService } from "./services/ingress/ingress.service.js";
import { EventProcessorService } from "./services/processor/processor.service.js";
import { RconService } from "./services/rcon/rcon.service.js";
import { StatisticsService } from "./services/statistics/statistics.service.js";

class HLStatsDaemon {
  private db: DatabaseClient;
  private gateway: GatewayService;
  private ingress: IngressService;
  private processor: EventProcessorService;
  private rcon: RconService;
  private statistics: StatisticsService;

  constructor() {
    console.log("🚀 Initializing HLStats Daemon v2...");

    this.db = new DatabaseClient();
    this.gateway = new GatewayService();
    this.ingress = new IngressService();
    this.processor = new EventProcessorService();
    this.rcon = new RconService();
    this.statistics = new StatisticsService();
  }

  async start(): Promise<void> {
    try {
      // Test database connectivity first
      console.log("📊 Testing database connection...");
      const dbConnected = await this.processor.testDatabaseConnection();

      if (!dbConnected) {
        throw new Error("Failed to connect to database");
      }

      console.log("✅ Database connection successful");

      // Start all services
      console.log("🔧 Starting services...");
      await Promise.all([
        this.gateway.start(),
        this.ingress.start(),
        this.rcon.start(),
        this.statistics.start(),
      ]);

      console.log("✅ All services started successfully");
      console.log("🎮 HLStats Daemon v2 is ready to receive game server data!");
    } catch (error) {
      console.error("❌ Failed to start daemon:", error);
      process.exit(1);
    }
  }

  async stop(): Promise<void> {
    console.log("🛑 Shutting down HLStats Daemon v2...");

    try {
      await Promise.all([
        this.gateway.stop(),
        this.ingress.stop(),
        this.rcon.stop(),
        this.statistics.stop(),
        this.processor.disconnect(),
      ]);

      console.log("✅ Daemon shutdown complete");
    } catch (error) {
      console.error("❌ Error during shutdown:", error);
    }
  }
}

// Handle graceful shutdown
const daemon = new HLStatsDaemon();

process.on("SIGINT", async () => {
  console.log("\n📡 Received SIGINT, shutting down gracefully...");
  await daemon.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n📡 Received SIGTERM, shutting down gracefully...");
  await daemon.stop();
  process.exit(0);
});

// Start the daemon
daemon.start().catch((error) => {
  console.error("💥 Fatal error:", error);
  process.exit(1);
});

console.log("🎯 HLStats Daemon v2 - Phase 1 Complete!");
console.log("📋 Features implemented:");
console.log("  ✅ TypeScript microservices architecture");
console.log("  ✅ Database integration with @repo/database");
console.log("  ✅ Event processing pipeline");
console.log("  ✅ UDP log ingress with rate limiting");
console.log("  ✅ Redis queue management");
console.log("  ✅ Player statistics tracking");
console.log("  ✅ ELO ranking system");
console.log("  ✅ Weapon statistics calculation");
console.log("  ✅ Match state management");
console.log("  ✅ Comprehensive test suite");
