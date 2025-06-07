import type { PrismaClient, Action, Prisma } from "@repo/database/client";
import {
  Result,
  success,
  failure,
  AppError,
  PaginatedResult,
} from "../types/common";

export class ActionService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Get all actions with optional filtering
   */
  async getActions(params: {
    game?: string;
    team?: string;
    page?: number;
    limit?: number;
  }): Promise<Result<PaginatedResult<Action>, AppError>> {
    try {
      const { game, team, page = 1, limit = 20 } = params;
      const skip = (page - 1) * limit;

      const where: Prisma.ActionWhereInput = {
        ...(game && { game }),
        ...(team && { team }),
      };

      const [actions, total] = await Promise.all([
        this.db.action.findMany({
          where,
          skip,
          take: limit,
          orderBy: { description: "asc" },
        }),
        this.db.action.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return success({
        items: actions,
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
        message: "Failed to fetch actions",
        operation: "getActions",
      });
    }
  }

  /**
   * Get a single action by ID
   */
  async getActionById(id: number): Promise<Result<Action, AppError>> {
    try {
      const action = await this.db.action.findUnique({
        where: { id },
      });

      if (!action) {
        return failure({
          type: "NOT_FOUND",
          message: "Action not found",
          resource: "action",
          id: id.toString(),
        });
      }

      return success(action);
    } catch (error) {
      console.error(error);
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to fetch action",
        operation: "getActionById",
      });
    }
  }

  /**
   * Get actions for a specific game
   */
  async getGameActions(game: string): Promise<Result<Action[], AppError>> {
    try {
      const actions = await this.db.action.findMany({
        where: { game },
        orderBy: { description: "asc" },
      });

      return success(actions);
    } catch (error) {
      console.error(error);
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to fetch game actions",
        operation: "getGameActions",
      });
    }
  }

  /**
   * Create a new action
   */
  async createAction(
    input: Prisma.ActionCreateInput,
  ): Promise<Result<Action, AppError>> {
    try {
      const action = await this.db.action.create({
        data: input,
      });

      return success(action);
    } catch (error) {
      console.error(error);
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to create action",
        operation: "createAction",
      });
    }
  }

  /**
   * Update an action
   */
  async updateAction(
    id: number,
    input: Prisma.ActionUpdateInput,
  ): Promise<Result<Action, AppError>> {
    try {
      const action = await this.db.action.update({
        where: { id },
        data: input,
      });

      return success(action);
    } catch (error: any) {
      if (error?.code === "P2025") {
        console.error(error);
        return failure({
          type: "NOT_FOUND",
          message: "Action not found",
          resource: "action",
          id: id.toString(),
        });
      }

      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to update action",
        operation: "updateAction",
      });
    }
  }

  /**
   * Delete an action
   */
  async deleteAction(id: number): Promise<Result<boolean, AppError>> {
    try {
      await this.db.action.delete({
        where: { id },
      });

      return success(true);
    } catch (error: any) {
      if (error?.code === "P2025") {
        return failure({
          type: "NOT_FOUND",
          message: "Action not found",
          resource: "action",
          id: id.toString(),
        });
      }

      console.error(error);
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to delete action",
        operation: "deleteAction",
      });
    }
  }
}
