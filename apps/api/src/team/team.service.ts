import type { PrismaClient, Team, Prisma } from "@repo/database/client";
import {
  Result,
  success,
  failure,
  AppError,
  PaginatedResult,
} from "../types/common";
import { isRecordNotFoundError } from "../utils/prisma-error-handler";

export class TeamService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Get all teams with optional filtering
   */
  async getTeams(params: {
    game?: string;
    hidden?: boolean;
    page?: number;
    limit?: number;
  }): Promise<Result<PaginatedResult<Team>, AppError>> {
    try {
      const { game, hidden, page = 1, limit = 20 } = params;
      const skip = (page - 1) * limit;

      const where: Prisma.TeamWhereInput = {
        ...(game && { game }),
        ...(hidden !== undefined && { hidden: hidden ? "1" : "0" }),
      };

      const [teams, total] = await Promise.all([
        this.db.team.findMany({
          where,
          skip,
          take: limit,
          orderBy: { name: "asc" },
        }),
        this.db.team.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return success({
        items: teams,
        total,
        page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      });
    } catch (error) {
      console.error(error);
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to fetch teams",
        operation: "getTeams",
      });
    }
  }

  /**
   * Get a single team by ID
   */
  async getTeamById(teamId: number): Promise<Result<Team, AppError>> {
    try {
      const team = await this.db.team.findUnique({
        where: { teamId },
      });

      if (!team) {
        return failure({
          type: "NOT_FOUND",
          message: "Team not found",
          resource: "team",
          id: teamId.toString(),
        });
      }

      return success(team);
    } catch (error) {
      console.error(error);
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to fetch team",
        operation: "getTeamById",
      });
    }
  }

  /**
   * Get teams for a specific game
   */
  async getGameTeams(game: string): Promise<Result<Team[], AppError>> {
    try {
      const teams = await this.db.team.findMany({
        where: { game },
        orderBy: { playerlist_index: "asc" },
      });

      return success(teams);
    } catch (error) {
      console.error(error);
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to fetch game teams",
        operation: "getGameTeams",
      });
    }
  }

  /**
   * Create a new team
   */
  async createTeam(
    input: Prisma.TeamCreateInput
  ): Promise<Result<Team, AppError>> {
    try {
      const team = await this.db.team.create({
        data: input,
      });

      return success(team);
    } catch (error) {
      console.error(error);
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to create team",
        operation: "createTeam",
      });
    }
  }

  /**
   * Update a team
   */
  async updateTeam(
    teamId: number,
    input: Prisma.TeamUpdateInput
  ): Promise<Result<Team, AppError>> {
    try {
      const team = await this.db.team.update({
        where: { teamId },
        data: input,
      });

      return success(team);
    } catch (error: unknown) {
      console.error(error);
      if (isRecordNotFoundError(error)) {
        return failure({
          type: "NOT_FOUND",
          message: "Team not found",
          resource: "team",
          id: teamId.toString(),
        });
      }

      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to update team",
        operation: "updateTeam",
      });
    }
  }

  /**
   * Delete a team
   */
  async deleteTeam(teamId: number): Promise<Result<boolean, AppError>> {
    try {
      await this.db.team.delete({
        where: { teamId },
      });

      return success(true);
    } catch (error: unknown) {
      console.error(error);
      if (isRecordNotFoundError(error)) {
        return failure({
          type: "NOT_FOUND",
          message: "Team not found",
          resource: "team",
          id: teamId.toString(),
        });
      }

      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to delete team",
        operation: "deleteTeam",
      });
    }
  }
}
