import type { AppContext } from "@/context"
import type { ILogger } from "@/shared/utils/logger.types"

export class DatabaseConnectionService {
  private context: AppContext
  private logger: ILogger

  constructor(context: AppContext) {
    this.context = context
    this.logger = context.logger
  }

  async testConnection(): Promise<boolean> {
    this.logger.connecting("database")
    
    try {
      const isConnected = await this.context.database.testConnection()
      
      if (isConnected) {
        this.logger.connected("database")
        return true
      } else {
        this.logger.failed("Database connection test failed", "Connection test returned false")
        return false
      }
    } catch (error) {
      this.logger.failed(
        "Database connection test failed",
        error instanceof Error ? error.message : String(error),
      )
      return false
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.context.database.disconnect()
      this.logger.info("Database connection closed")
    } catch (error) {
      this.logger.failed(
        "Error closing database connection",
        error instanceof Error ? error.message : String(error),
      )
    }
  }
}