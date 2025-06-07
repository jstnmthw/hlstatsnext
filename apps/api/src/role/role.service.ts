import type { PrismaClient, Role, Prisma } from "@repo/database/client";
import {
  Result,
  success,
  failure,
  AppError,
  PaginatedResult,
} from "../types/common";
import { isRecordNotFoundError } from "../utils/prisma-error-handler";

export class RoleService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Get all roles with optional filtering
   */
  async getRoles(params: {
    game?: string;
    hidden?: boolean;
    page?: number;
    limit?: number;
  }): Promise<Result<PaginatedResult<Role>, AppError>> {
    try {
      const { game, hidden, page = 1, limit = 20 } = params;
      const skip = (page - 1) * limit;

      const where: Prisma.RoleWhereInput = {
        ...(game && { game }),
        ...(hidden !== undefined && { hidden: hidden ? "1" : "0" }),
      };

      const [roles, total] = await Promise.all([
        this.db.role.findMany({
          where,
          skip,
          take: limit,
          orderBy: { name: "asc" },
        }),
        this.db.role.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return success({
        items: roles,
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
        message: "Failed to fetch roles",
        operation: "getRoles",
      });
    }
  }

  /**
   * Get a single role by ID
   */
  async getRoleById(roleId: number): Promise<Result<Role, AppError>> {
    try {
      const role = await this.db.role.findUnique({
        where: { roleId },
      });

      if (!role) {
        return failure({
          type: "NOT_FOUND",
          message: "Role not found",
          resource: "role",
          id: roleId.toString(),
        });
      }

      return success(role);
    } catch (error) {
      console.error(error);
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to fetch role",
        operation: "getRoleById",
      });
    }
  }

  /**
   * Get roles for a specific game
   */
  async getGameRoles(game: string): Promise<Result<Role[], AppError>> {
    try {
      const roles = await this.db.role.findMany({
        where: { game },
        orderBy: { name: "asc" },
      });

      return success(roles);
    } catch (error) {
      console.error(error);
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to fetch game roles",
        operation: "getGameRoles",
      });
    }
  }

  /**
   * Get role statistics (most picked roles)
   */
  async getRoleStatistics(params: {
    game?: string;
    limit?: number;
  }): Promise<Result<Role[], AppError>> {
    try {
      const { game, limit = 10 } = params;

      const where: Prisma.RoleWhereInput = {
        ...(game && { game }),
        hidden: "0", // Only show visible roles
      };

      const roles = await this.db.role.findMany({
        where,
        orderBy: { picked: "desc" },
        take: limit,
      });

      return success(roles);
    } catch (error) {
      console.error(error);
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to fetch role statistics",
        operation: "getRoleStatistics",
      });
    }
  }

  /**
   * Create a new role
   */
  async createRole(
    input: Prisma.RoleCreateInput,
  ): Promise<Result<Role, AppError>> {
    try {
      const role = await this.db.role.create({
        data: input,
      });

      return success(role);
    } catch (error) {
      console.error(error);
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to create role",
        operation: "createRole",
      });
    }
  }

  /**
   * Update a role
   */
  async updateRole(
    roleId: number,
    input: Prisma.RoleUpdateInput,
  ): Promise<Result<Role, AppError>> {
    try {
      const role = await this.db.role.update({
        where: { roleId },
        data: input,
      });

      return success(role);
    } catch (error: unknown) {
      console.error(error);
      if (isRecordNotFoundError(error)) {
        return failure({
          type: "NOT_FOUND",
          message: "Role not found",
          resource: "role",
          id: roleId.toString(),
        });
      }

      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to update role",
        operation: "updateRole",
      });
    }
  }

  /**
   * Delete a role
   */
  async deleteRole(roleId: number): Promise<Result<boolean, AppError>> {
    try {
      await this.db.role.delete({
        where: { roleId },
      });

      return success(true);
    } catch (error: unknown) {
      console.error(error);
      if (isRecordNotFoundError(error)) {
        return failure({
          type: "NOT_FOUND",
          message: "Role not found",
          resource: "role",
          id: roleId.toString(),
        });
      }

      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to delete role",
        operation: "deleteRole",
      });
    }
  }
}
