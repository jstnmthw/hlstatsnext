import { db, Prisma } from "../client"
import { log, logWarning } from "./logger"

const countries: Prisma.CountryCreateManyInput[] = [
  { flag: "US", name: "United States" },
  { flag: "CA", name: "Canada" },
  { flag: "GB", name: "United Kingdom" },
  { flag: "DE", name: "Germany" },
  { flag: "FR", name: "France" },
  { flag: "AU", name: "Australia" },
  { flag: "JP", name: "Japan" },
  { flag: "CN", name: "China" },
  { flag: "RU", name: "Russia" },
  { flag: "BR", name: "Brazil" },
  { flag: "OT", name: "Other" },
]

export async function seedCountries() {
  const existingCount = await db.country.count()
  if (existingCount > 0) {
    logWarning("Countries already exist, skipping seed.")
    return
  }

  const result = await db.country.createMany({
    data: countries,
    skipDuplicates: true,
  })

  log(`✔ Created ${result.count} countries.`)
}
