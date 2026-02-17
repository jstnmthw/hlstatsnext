/**
 * Aggregate vitest coverage from all packages and set GitHub Actions outputs.
 *
 * Reads coverage-final.json (Istanbul format) from each package that produces
 * coverage, computes an overall line-coverage percentage, and writes the
 * `coverage` and `color` outputs expected by the CI workflow badge step.
 */

import { readFileSync, existsSync, appendFileSync } from "node:fs"
import { resolve } from "node:path"

const COVERAGE_PATHS = [
  "apps/daemon/coverage/coverage-final.json",
  "apps/web/coverage/coverage-final.json",
]

let totalStatements = 0
let coveredStatements = 0

for (const rel of COVERAGE_PATHS) {
  const abs = resolve(rel)
  if (!existsSync(abs)) {
    console.warn(`Coverage file not found, skipping: ${rel}`)
    continue
  }

  const data = JSON.parse(readFileSync(abs, "utf-8"))

  for (const file of Object.values(data)) {
    const s = file.s ?? {}
    for (const count of Object.values(s)) {
      totalStatements++
      if (count > 0) coveredStatements++
    }
  }
}

const pct = totalStatements > 0 ? ((coveredStatements / totalStatements) * 100).toFixed(1) : "0.0"
const num = parseFloat(pct)

let color
if (num >= 80) color = "brightgreen"
else if (num >= 60) color = "yellow"
else if (num >= 40) color = "orange"
else color = "red"

console.log(`Aggregate coverage: ${pct}% (${coveredStatements}/${totalStatements} statements)`)

const outputFile = process.env.GITHUB_OUTPUT
if (outputFile) {
  appendFileSync(outputFile, `coverage=${pct}\n`)
  appendFileSync(outputFile, `color=${color}\n`)
} else {
  console.log(`coverage=${pct}`)
  console.log(`color=${color}`)
}
