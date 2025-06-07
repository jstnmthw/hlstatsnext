import type { PrismaClient, Server } from "@repo/database/client";
import type { Result, AppError } from "../types/common";
import { success, failure } from "../types";
import type {
  ServerDetails,
  CreateServerInput,
  UpdateServerInput,
} from "../types/database/server.types";

/**
 * Service for server-related business logic
 */
export class ServerService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Get all servers with basic details
   * NOTE: The Prisma schema for Server does not have a 'hidden' or 'disabled' flag.
   * Filtering has been removed for now.
   */
  async getServers(): Promise<Result<Server[], AppError>> {
    try {
      const servers = await this.db.server.findMany({
        orderBy: { sortorder: "asc" },
      });
      return success(servers);
    } catch (error) {
      console.error(error);
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to fetch servers",
        operation: "getServers",
      });
    }
  }

  /**
   * Get detailed information for a single server, including live player data
   */
  async getServerDetails(id: string): Promise<Result<ServerDetails, AppError>> {
    try {
      const serverId = parseInt(id);
      if (isNaN(serverId)) {
        return failure({
          type: "VALIDATION_ERROR",
          message: "Invalid server ID format",
          field: "id",
          value: id,
        });
      }

      const server = await this.db.server.findUnique({
        where: { serverId },
      });

      if (!server) {
        return failure({
          type: "NOT_FOUND",
          message: "Server not found",
          resource: "server",
          id,
        });
      }

      // NOTE: Live player data would be fetched from a cache or the daemon here.
      // For now, we simulate this with a database query.
      const currentPlayers = await this.db.player.findMany({
        where: {
          AND: [{ game: server.game }, { last_event: { gte: 0 } }], // Simplified logic
        },
        take: server.players, // Assumes `players` field on server is current count
      });

      const gameData = await this.db.game.findUnique({
        where: { code: server.game },
      });

      const details: ServerDetails = {
        ...server,
        gameData,
        currentPlayers,
        playerCount: server.players,
        isOnline: server.players > 0, // Simplified online status check
      };

      return success(details);
    } catch (error) {
      console.error(error);
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to fetch server details",
        operation: "getServerDetails",
      });
    }
  }

  /**
   * Create a new server
   */
  async createServer(
    input: CreateServerInput,
  ): Promise<Result<Server, AppError>> {
    try {
      const server = await this.db.server.create({
        data: {
          address: input.address,
          port: input.port,
          game: input.gameId,
          name: input.name ?? `${input.address}:${input.port}`,
          rcon_password: input.rconPassword ?? "",
          publicaddress: input.privateAddress ?? "",
        },
      });
      return success(server);
    } catch (error) {
      console.error(error);
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to create server",
        operation: "createServer",
      });
    }
  }

  /**
   * Update an existing server
   */
  async updateServer(
    id: string,
    input: UpdateServerInput,
  ): Promise<Result<Server, AppError>> {
    try {
      const serverId = parseInt(id);
      if (isNaN(serverId)) {
        return failure({
          type: "VALIDATION_ERROR",
          message: "Invalid server ID format",
          field: "id",
          value: id,
        });
      }

      const server = await this.db.server.update({
        where: { serverId },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.rconPassword && { rcon_password: input.rconPassword }),
          ...(input.privateAddress && { publicaddress: input.privateAddress }),
        },
      });

      return success(server);
    } catch (error) {
      console.error(error);
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to update server",
        operation: "updateServer",
      });
    }
  }
}
