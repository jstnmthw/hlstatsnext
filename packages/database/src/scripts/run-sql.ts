import { PrismaMariaDb } from "@prisma/adapter-mariadb"
import { mysqlSplitterOptions, splitQuery } from "dbgate-query-splitter"
import "dotenv/config"
import fs from "fs/promises"
import path from "path"
import { PrismaClient } from "../../generated/prisma/client"

type SqlStatement = string | { text: string }

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!)
const prisma = new PrismaClient({ adapter })

async function main() {
  const filePath = process.argv[process.argv.length - 1]

  if (process.argv.length < 3 || !filePath) {
    console.error("Please provide a path to the SQL file.")
    process.exit(1)
  }

  try {
    const sql = await fs.readFile(path.resolve(filePath), "utf-8")
    const statements = splitQuery(sql, mysqlSplitterOptions) as SqlStatement[]

    console.log(`Found ${statements.length} statements to execute.`)

    await prisma.$transaction(async (tx) => {
      for (const statement of statements) {
        const statementText = typeof statement === "string" ? statement : statement.text
        if (statementText.trim().length === 0) continue
        console.log(`Executing: ${statementText.substring(0, 100).trim()}...`)
        await tx.$executeRawUnsafe(statementText)
      }
    })

    console.log("✅ SQL script executed successfully.")
  } catch (e) {
    console.error("Error executing SQL script:")
    console.error(e)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
