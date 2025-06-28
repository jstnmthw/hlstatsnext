import { IngressService } from "./services/ingress/ingress.service"
import { DatabaseClient } from "./database/client"
import { EventProcessorService } from "./services/processor/processor.service"
import { logger } from "./utils/logger"

;(async () => {
  // Determine environment once - fall back to NODE_ENV for convenience
  const appEnv = process.env.NODE_ENV ?? "development"
  const isDev = appEnv === "development"

  // 1. DB
  const db = new DatabaseClient()
  await db.testConnection()

  // 2. Processor
  const processor = new EventProcessorService(db, {
    logBots: process.env.LOG_BOTS ? process.env.LOG_BOTS === "true" : isDev,
  })

  // 3. Ingress - skip auth automatically in dev unless explicitly disabled
  const ingress = new IngressService(27500, processor, db, {
    skipAuth: appEnv === "development",
  })

  await ingress.start()
  logger.ready("🚀 DEV daemon initialised; log processing active on port 27500")

  process.on("SIGINT", async () => {
    await ingress.stop()
    await db.disconnect()
    process.exit(0)
  })
})()
