import { mysqlSplitterOptions, splitQuery } from "dbgate-query-splitter"
import fs from "fs/promises"
import path from "path"
import { db } from "./client"
import { seedAdmin } from "./seeders"
import { log, logDivider, logError, logHeader, logStep, logSuccess } from "./seeders/fake/logger"

type SqlStatement = string | { text: string }

async function main() {
  logHeader("HLStatsNext Default Seeder")

  const startTime = Date.now()

  try {
    logStep("Seeding default data...")
    const sqlPath = path.resolve("src/sql/default-seeder.sql")
    const sql = await fs.readFile(sqlPath, "utf-8")
    const statements = splitQuery(sql, mysqlSplitterOptions) as SqlStatement[]

    let executed = 0
    await db.$transaction(async (tx) => {
      for (const statement of statements) {
        const text = typeof statement === "string" ? statement : statement.text
        if (text.trim().length === 0) continue
        await tx.$executeRawUnsafe(text)
        executed++
      }
    })
    log(`✔ ${executed} SQL statements executed`)

    logStep("Seeding admin account...")
    await seedAdmin()

    const duration = Math.round((Date.now() - startTime) / 1000)

    logDivider()
    logSuccess(`Completed in ${duration}s`)
  } catch (error) {
    logError("Default seeding failed:")
    console.error(error)
    process.exit(1)
  }
}

main().finally(async () => {
  await db.$disconnect()
})
