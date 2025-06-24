/**
 * HLStats Daemon v2 - Main Entry Point
 *
 * Modern TypeScript rewrite of the legacy Perl HLstatsX daemon.
 * Collects and processes statistics from Half-Life dedicated game servers.
 */

import { DatabaseClient } from "./database/client";
import { GatewayService } from "./services/gateway/gateway.service";
import { IngressService } from "./services/ingress/ingress.service";
import { EventProcessorService } from "./services/processor/processor.service";
import { RconService } from "./services/rcon/rcon.service";
import { StatisticsService } from "./services/statistics/statistics.service";

export class HLStatsDaemon {
  private db: DatabaseClient;
  private gateway: GatewayService;
  private ingress: IngressService;
  private processor: EventProcessorService;
  private rcon: RconService;
  private statistics: StatisticsService;

  constructor() {
    console.log("🚀 Initializing HLStats Daemon v2...");

    this.db = new DatabaseClient();
    this.processor = new EventProcessorService();
    this.gateway = new GatewayService();
    this.ingress = new IngressService(27500, this.processor, this.db);
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

function main() {
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
}

// This allows the file to be imported for testing without executing the startup logic.
// Vitest automatically sets the process.env.VITEST variable.
if (process.env.VITEST === undefined) {
  main();
}
