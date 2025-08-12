import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { pipeline } from "node:stream/promises"
import { createWriteStream, createReadStream } from "node:fs"
import { createInterface } from "node:readline"
import { db } from "../client"
import unzipper from "unzipper"

// Archive extraction helpers prefer system tools to avoid extra dependencies.
// - For .zip: uses `unzip`
// - For .tar.gz: uses `tar`

type LocationRecord = {
  locId: bigint
  country: string
  region?: string | null
  city?: string | null
  postalCode?: string | null
  latitude?: number | null
  longitude?: number | null
}

type BlockRecord = {
  startIpNum: bigint
  endIpNum: bigint
  locId: bigint
}

// Optional env reader – returns undefined if missing
function readEnv(name: string): string | undefined {
  const value = process.env[name]
  if (!value || !value.trim()) return undefined
  return value.trim()
}

function ipv4ToNum(ip: string): number {
  const parts = ip.split(".").map((p) => Number(p))
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    throw new Error(`Invalid IPv4 address: ${ip}`)
  }
  const [a, b, c, d] = parts as [number, number, number, number]
  return ((a << 24) >>> 0) + (b << 16) + (c << 8) + d
}

function cidrToRange(cidr: string): { start: number; end: number } {
  const [base, prefixStr] = cidr.split("/")
  const prefix = Number(prefixStr)
  if (!base || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new Error(`Invalid CIDR: ${cidr}`)
  }
  const baseNum = ipv4ToNum(base)
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  const start = (baseNum & mask) >>> 0
  const end = (start | (~mask >>> 0)) >>> 0
  return { start, end }
}

async function download(
  fileUrl: string,
  destPath: string,
  headers: Record<string, string> = {},
): Promise<void> {
  const res = await fetch(fileUrl, { redirect: "follow", headers })
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download ${fileUrl}: ${res.status} ${res.statusText}`)
  }
  await pipeline(res.body as unknown as NodeJS.ReadableStream, createWriteStream(destPath))
}

async function extractTarGz(archivePath: string, targetDir: string): Promise<void> {
  // Prefer system tar for speed and reliability
  const { spawn } = await import("node:child_process")
  await new Promise<void>((resolve, reject) => {
    const proc = spawn("tar", ["-xzf", archivePath, "-C", targetDir])
    proc.on("error", reject)
    proc.on("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`tar exited with code ${code}`))
    })
  })
}

async function extractZipWithNode(archivePath: string, targetDir: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    createReadStream(archivePath)
      .pipe(unzipper.Extract({ path: targetDir }))
      .on("close", () => resolve())
      .on("error", (err: unknown) => reject(err))
  })
}

async function extractZip(archivePath: string, targetDir: string): Promise<void> {
  try {
    const { spawn } = await import("node:child_process")
    await new Promise<void>((resolve, reject) => {
      const proc = spawn("unzip", ["-o", "-q", archivePath, "-d", targetDir])
      proc.on("error", reject)
      proc.on("close", (code) => {
        if (code === 0) resolve()
        else reject(new Error(`unzip exited with code ${code}`))
      })
    })
  } catch {
    // Fallback to Node-based unzip when system 'unzip' is unavailable
    await extractZipWithNode(archivePath, targetDir)
  }
}

async function extractArchive(archivePath: string, targetDir: string): Promise<void> {
  if (/\.zip$/i.test(archivePath)) {
    return extractZip(archivePath, targetDir)
  }
  if (/\.tar\.gz$/i.test(archivePath) || /\.tgz$/i.test(archivePath)) {
    return extractTarGz(archivePath, targetDir)
  }
  throw new Error(`Unsupported archive format: ${path.basename(archivePath)}`)
}

async function findFileRecursive(
  rootDir: string,
  predicate: (p: string) => boolean,
): Promise<string | null> {
  const entries = await fs.promises.readdir(rootDir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(rootDir, entry.name)
    if (entry.isDirectory()) {
      const nested = await findFileRecursive(full, predicate)
      if (nested) return nested
    } else if (predicate(full)) {
      return full
    }
  }
  return null
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        const next = line[i + 1]
        if (next === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === ",") {
        result.push(current)
        current = ""
      } else if (ch === '"') {
        inQuotes = true
      } else {
        current += ch
      }
    }
  }
  result.push(current)
  return result
}

async function parseCsv(
  filePath: string,
  onRow: (row: Record<string, string>) => Promise<void> | void,
): Promise<void> {
  const stream = createReadStream(filePath, { encoding: "utf8" })
  const rl = createInterface({ input: stream, crlfDelay: Infinity })
  let headers: string[] | null = null
  for await (const rawLine of rl) {
    const line = rawLine.replace(/\r$/, "")
    if (!headers) {
      if (!line) continue
      headers = parseCsvLine(line).map((h) => h.replace(/^"|"$/g, ""))
      continue
    }
    if (!line) continue
    const cols = parseCsvLine(line)
    const row: Record<string, string> = {}
    for (let i = 0; i < headers.length; i++) {
      const key = headers[i]
      if (!key) continue
      row[key] = (cols[i] ?? "").toString()
    }
    await onRow(row)
  }
}

async function seedGeoLite(): Promise<void> {
  // Credentials: Basic Auth (Account ID + License Key) as per MaxMind documentation.
  const accountId = readEnv("MAXMIND_ACCOUNT_ID") || readEnv("MAXMIND_ACCOUNT")
  const licenseKey = readEnv("MAXMIND_LICENSE_KEY")
  if (!accountId || !licenseKey) {
    console.warn(
      "[GeoIP] MAXMIND_ACCOUNT_ID and MAXMIND_LICENSE_KEY not set (or missing). Skipping GeoLite2 CSV seeding.",
    )
    return
  }
  const EDITION = "GeoLite2-City-CSV"
  // Per MaxMind docs, CSV downloads are provided as .zip
  const SUFFIX = "zip"
  const url = `https://download.maxmind.com/geoip/databases/${EDITION}/download?suffix=${SUFFIX}`

  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "geolite2-"))
  const archivePath = path.join(tmpDir, `${EDITION}.zip`)

  console.log(`Downloading ${EDITION} from MaxMind...`)
  const basic = Buffer.from(`${accountId}:${licenseKey}`).toString("base64")
  await download(url, archivePath, { Authorization: `Basic ${basic}` })

  console.log("Extracting archive...")
  await extractArchive(archivePath, tmpDir)

  // Locate CSV files (English locations + IPv4 blocks)
  const locationsCsv = await findFileRecursive(tmpDir, (p) =>
    /GeoLite2-City-Locations-en\.csv$/i.test(p),
  )
  const blocksCsv = await findFileRecursive(tmpDir, (p) =>
    /GeoLite2-City-Blocks-IPv4\.csv$/i.test(p),
  )
  if (!locationsCsv || !blocksCsv) {
    throw new Error("Could not find required CSV files in the extracted archive")
  }

  console.log("Preparing GeoLite tables (clearing existing data)...")
  await db.$transaction([db.geoLiteCityBlock.deleteMany(), db.geoLiteCityLocation.deleteMany()])

  // First pass over blocks to gather representative lat/lon per geoname_id
  const locIdToCoords = new Map<bigint, { lat: number; lon: number }>()
  console.log("Scanning blocks for representative coordinates...")
  await parseCsv(blocksCsv, async (row) => {
    const geonameIdStr = row["geoname_id"]?.trim()
    const latStr = row["latitude"]?.trim()
    const lonStr = row["longitude"]?.trim()
    if (!geonameIdStr) return
    const locId = BigInt(geonameIdStr)
    if (!locIdToCoords.has(locId)) {
      const lat = latStr ? Number(latStr) : NaN
      const lon = lonStr ? Number(lonStr) : NaN
      if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
        locIdToCoords.set(locId, { lat, lon })
      }
    }
  })

  // Parse locations and insert
  console.log("Inserting locations (this may take a while)...")
  const locationBatch: LocationRecord[] = []
  const flushLocations = async () => {
    if (locationBatch.length === 0) return
    await db.geoLiteCityLocation.createMany({ data: locationBatch, skipDuplicates: true })
    locationBatch.length = 0
  }
  await parseCsv(locationsCsv, async (row) => {
    const geonameIdStr = row["geoname_id"]?.trim()
    if (!geonameIdStr) return
    const locId = BigInt(geonameIdStr)
    const country = (row["country_iso_code"] || "").trim()
    const city = (row["city_name"] || "").trim() || null
    const region = (row["subdivision_1_name"] || row["subdivision_1_iso_code"] || "").trim() || null
    const coords = locIdToCoords.get(locId)
    locationBatch.push({
      locId,
      country,
      city,
      region,
      postalCode: null,
      latitude: coords?.lat ?? null,
      longitude: coords?.lon ?? null,
    })
    if (locationBatch.length >= 5_000) {
      await flushLocations()
    }
  })
  await flushLocations()

  // Parse blocks and insert
  console.log("Inserting IPv4 blocks (this will take a while)...")
  const blockBatch: BlockRecord[] = []
  const flushBlocks = async () => {
    if (blockBatch.length === 0) return
    await db.geoLiteCityBlock.createMany({ data: blockBatch, skipDuplicates: true })
    blockBatch.length = 0
  }
  await parseCsv(blocksCsv, async (row) => {
    const network = row["network"]?.trim()
    const geonameIdStr = row["geoname_id"]?.trim()
    if (!network || !geonameIdStr) return
    try {
      const { start, end } = cidrToRange(network)
      const record: BlockRecord = {
        startIpNum: BigInt(start >>> 0),
        endIpNum: BigInt(end >>> 0),
        locId: BigInt(geonameIdStr),
      }
      blockBatch.push(record)
      if (blockBatch.length >= 10_000) {
        await flushBlocks()
      }
    } catch {
      // skip invalid CIDR rows
    }
  })
  await flushBlocks()

  console.log("✅ GeoLite2 CSV seeding completed successfully.")
}

async function main(): Promise<void> {
  try {
    await seedGeoLite()
  } catch (err) {
    console.error("GeoIP seeding failed:", err)
    process.exit(1)
  } finally {
    await db.$disconnect()
  }
}

void main()
