import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { pipeline } from "node:stream/promises"
import { createWriteStream, createReadStream } from "node:fs"
import { createInterface } from "node:readline"
import { db } from "../client"
import unzipper from "unzipper"
import {
  log,
  logStep,
  logSuccess,
  logWarning,
  logError,
  logHeader,
  logDivider,
} from "../seeders/fake/logger"

// Archive extraction helpers prefer system tools to avoid extra dependencies.
// - For .zip: uses `unzip`
// - For .tar.gz: uses `tar`

// GeoIP data cache configuration
const GEOIP_CACHE_DIR = path.join(process.cwd(), "data", "geoip")
const METADATA_FILE = path.join(GEOIP_CACHE_DIR, "metadata.json")

type CacheMetadata = {
  lastModified?: string
  downloadDate: number
  filePath: string
  edition: string
}

type LocationRecord = {
  locId: number
  country: string
  region: string | null
  city: string | null
  latitude: number | null
  longitude: number | null
}

type BlockRecord = {
  startIpNum: number
  endIpNum: number
  locId: number
}

// Optional env reader – returns undefined if missing
function readEnv(name: string): string | undefined {
  const value = process.env[name]
  if (!value || !value.trim()) return undefined
  return value.trim()
}

function escapeSql(str: string): string {
  return str.replace(/[\0\x08\x09\x1a\n\r"'\\%]/g, (ch) => {
    switch (ch) {
      case "'":
        return "''"
      case "\\":
        return "\\\\"
      case "\0":
        return "\\0"
      case "\n":
        return "\\n"
      case "\r":
        return "\\r"
      case "\x1a":
        return "\\Z"
      default:
        return ch
    }
  })
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

async function ensureCacheDir(): Promise<void> {
  await fs.promises.mkdir(GEOIP_CACHE_DIR, { recursive: true })
}

async function loadCacheMetadata(): Promise<CacheMetadata | null> {
  try {
    const data = await fs.promises.readFile(METADATA_FILE, "utf8")
    return JSON.parse(data) as CacheMetadata
  } catch {
    return null
  }
}

async function saveCacheMetadata(metadata: CacheMetadata): Promise<void> {
  await ensureCacheDir()
  await fs.promises.writeFile(METADATA_FILE, JSON.stringify(metadata, null, 2))
}

async function checkRemoteFileModified(
  url: string,
  headers: Record<string, string> = {},
): Promise<string | null> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers,
      redirect: "follow",
    })
    if (!response.ok) {
      logWarning(`Failed to check remote file: ${response.status} ${response.statusText}`)
      return null
    }
    return response.headers.get("last-modified")
  } catch (error) {
    logWarning(`Failed to check remote file modification time: ${error}`)
    return null
  }
}

async function shouldDownloadFile(
  url: string,
  edition: string,
  headers: Record<string, string> = {},
): Promise<{ shouldDownload: boolean; cachedFilePath?: string }> {
  const metadata = await loadCacheMetadata()

  // If no cache or different edition, download
  if (!metadata || metadata.edition !== edition) {
    return { shouldDownload: true }
  }

  // Check if cached file still exists
  const cachedExists = await fs.promises
    .access(metadata.filePath)
    .then(() => true)
    .catch(() => false)
  if (!cachedExists) {
    return { shouldDownload: true }
  }

  // Check remote file modification time
  const remoteLastModified = await checkRemoteFileModified(url, headers)
  if (!remoteLastModified) {
    // If we can't check remote, use cached file if it exists
    log("Using cached file (unable to check remote modification time)")
    return { shouldDownload: false, cachedFilePath: metadata.filePath }
  }

  // Compare modification times
  if (metadata.lastModified && metadata.lastModified === remoteLastModified) {
    log("Using cached file (up to date)")
    return { shouldDownload: false, cachedFilePath: metadata.filePath }
  }

  log("Remote file has been updated, downloading new version")
  return { shouldDownload: true }
}

async function downloadWithCache(
  url: string,
  edition: string,
  headers: Record<string, string> = {},
): Promise<string> {
  await ensureCacheDir()

  const cachedFilePath = path.join(GEOIP_CACHE_DIR, `${edition}.zip`)
  const { shouldDownload, cachedFilePath: existingFile } = await shouldDownloadFile(
    url,
    edition,
    headers,
  )

  if (!shouldDownload && existingFile) {
    return existingFile
  }

  log(`Downloading ${edition} from MaxMind...`)
  await download(url, cachedFilePath, headers)

  // Get the last-modified header after successful download
  const remoteLastModified = await checkRemoteFileModified(url, headers)

  // Save metadata
  const metadata: CacheMetadata = {
    lastModified: remoteLastModified || undefined,
    downloadDate: Date.now(),
    filePath: cachedFilePath,
    edition,
  }
  await saveCacheMetadata(metadata)

  return cachedFilePath
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
    logWarning("MAXMIND_ACCOUNT_ID and MAXMIND_LICENSE_KEY not set. Skipping GeoIP seeding.")
    return
  }
  const EDITION = "GeoLite2-City-CSV"
  // Per MaxMind docs, CSV downloads are provided as .zip
  const SUFFIX = "zip"
  const url = `https://download.maxmind.com/geoip/databases/${EDITION}/download?suffix=${SUFFIX}`

  const basic = Buffer.from(`${accountId}:${licenseKey}`).toString("base64")
  const archivePath = await downloadWithCache(url, EDITION, { Authorization: `Basic ${basic}` })

  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "geolite2-extract-"))

  log("Extracting archive...")
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

  logStep("Preparing GeoLite tables...")
  await db.$executeRawUnsafe("DELETE FROM `geo_lite_city_block`")
  await db.$executeRawUnsafe("DELETE FROM `geo_lite_city_location`")

  // First pass over blocks to gather representative lat/lon per geoname_id
  const locIdToCoords = new Map<number, { lat: number; lon: number }>()
  log("Scanning blocks for representative coordinates...")
  await parseCsv(blocksCsv, (row) => {
    const geonameIdStr = row["geoname_id"]?.trim()
    const latStr = row["latitude"]?.trim()
    const lonStr = row["longitude"]?.trim()
    if (!geonameIdStr) return
    const locId = Number(geonameIdStr)
    if (!locIdToCoords.has(locId)) {
      const lat = latStr ? Number(latStr) : NaN
      const lon = lonStr ? Number(lonStr) : NaN
      if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
        locIdToCoords.set(locId, { lat, lon })
      }
    }
  })

  // Parse locations and insert using raw SQL to avoid Prisma v7 adapter OOM
  logStep("Inserting locations...")
  let locationBatch: LocationRecord[] = []
  const flushLocations = async () => {
    if (locationBatch.length === 0) return
    const values = locationBatch
      .map((l) => {
        const lat = l.latitude !== null ? l.latitude.toFixed(4) : "NULL"
        const lon = l.longitude !== null ? l.longitude.toFixed(4) : "NULL"
        const country = escapeSql(l.country)
        const region = l.region !== null ? `'${escapeSql(l.region)}'` : "NULL"
        const city = l.city !== null ? `'${escapeSql(l.city)}'` : "NULL"
        return `(${l.locId},'${country}',${region},${city},NULL,${lat},${lon})`
      })
      .join(",")
    await db.$executeRawUnsafe(
      `INSERT IGNORE INTO \`geo_lite_city_location\` (\`loc_id\`,\`country\`,\`region\`,\`city\`,\`postal_code\`,\`latitude\`,\`longitude\`) VALUES ${values}`,
    )
    locationBatch = []
  }
  await parseCsv(locationsCsv, async (row) => {
    const geonameIdStr = row["geoname_id"]?.trim()
    if (!geonameIdStr) return
    const locId = Number(geonameIdStr)
    const country = (row["country_iso_code"] || "").trim()
    const city = (row["city_name"] || "").trim() || null
    const region = (row["subdivision_1_name"] || row["subdivision_1_iso_code"] || "").trim() || null
    const coords = locIdToCoords.get(locId)
    locationBatch.push({
      locId,
      country,
      city,
      region,
      latitude: coords?.lat ?? null,
      longitude: coords?.lon ?? null,
    })
    if (locationBatch.length >= 5_000) {
      await flushLocations()
    }
  })
  await flushLocations()

  // Free coordinate lookup memory before processing blocks
  locIdToCoords.clear()

  // Parse blocks and insert using raw SQL to avoid Prisma v7 adapter OOM
  logStep("Inserting IPv4 blocks...")
  let blockBatch: BlockRecord[] = []
  let blockCount = 0
  const flushBlocks = async () => {
    if (blockBatch.length === 0) return
    const values = blockBatch.map((b) => `(${b.startIpNum},${b.endIpNum},${b.locId})`).join(",")
    await db.$executeRawUnsafe(
      `INSERT IGNORE INTO \`geo_lite_city_block\` (\`start_ip_num\`,\`end_ip_num\`,\`loc_id\`) VALUES ${values}`,
    )
    blockCount += blockBatch.length
    if (blockCount % 500_000 === 0) {
      log(`${blockCount.toLocaleString()} blocks inserted...`)
    }
    blockBatch = []
  }
  await parseCsv(blocksCsv, async (row) => {
    const network = row["network"]?.trim()
    const geonameIdStr = row["geoname_id"]?.trim()
    if (!network || !geonameIdStr) return
    try {
      const { start, end } = cidrToRange(network)
      blockBatch.push({
        startIpNum: start >>> 0,
        endIpNum: end >>> 0,
        locId: Number(geonameIdStr),
      })
      if (blockBatch.length >= 10_000) {
        await flushBlocks()
      }
    } catch {
      // skip invalid CIDR rows
    }
  })
  await flushBlocks()
  log(`Total: ${blockCount.toLocaleString()} blocks inserted`)

  logDivider()
  logSuccess("GeoIP seeding completed")
}

async function forceUpdate(): Promise<void> {
  logHeader("HLStatsNext GeoIP Seeder")
  logStep("Force updating GeoIP data...")
  try {
    const metadata = await loadCacheMetadata()
    if (metadata?.filePath) {
      try {
        await fs.promises.unlink(metadata.filePath)
        await fs.promises.unlink(METADATA_FILE)
        log("Cleared existing cache")
      } catch {
        // Ignore errors if files don't exist
      }
    }
    await seedGeoLite()
  } catch (err) {
    logError(`GeoIP force update failed: ${err}`)
    process.exit(1)
  } finally {
    await db.$disconnect()
  }
}

async function updateIfNeeded(): Promise<void> {
  logHeader("HLStatsNext GeoIP Seeder")
  logStep("Checking for GeoIP data updates...")
  try {
    await seedGeoLite()
  } catch (err) {
    logError(`GeoIP update check failed: ${err}`)
    process.exit(1)
  } finally {
    await db.$disconnect()
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const command = args[0]

  switch (command) {
    case "force":
    case "--force":
      await forceUpdate()
      break
    case "update":
    case "--update":
      await updateIfNeeded()
      break
    default:
      // Default behavior (backward compatibility)
      await updateIfNeeded()
      break
  }
}

void main()
