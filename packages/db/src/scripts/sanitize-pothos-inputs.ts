/**
 * Sanitize the auto-generated pothos-inputs file by stripping filter/orderBy/
 * mutation fields that reference sensitive columns. This runs as a post-step
 * after `prisma generate`.
 *
 * The Prisma plugin generates `<Model>WhereInput`, `<Model>OrderByWithRelationInput`,
 * etc. based on the datamodel — without this sanitizer, an unauthenticated caller
 * could enumerate `Player.email` character-by-character via
 *   `findManyPlayer(where: { email: { startsWith: "a" } })`
 * even though the custom Player object hides the field on output.
 *
 * Stripping happens per-model: only inputs whose name starts with `<Model>` lose
 * the configured field. Strips both the per-field input declaration and any
 * `_min`/`_max`/`_count` aggregate references that point at it.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

interface SensitiveField {
  /** Column name as declared in schema.prisma (matches the field on the generated input) */
  field: string
}

interface ModelSanitizerConfig {
  /** Pothos model name (matches the export prefix `<Model>WhereInputFields` etc.) */
  model: string
  fields: SensitiveField[]
}

const SANITIZER_CONFIG: ModelSanitizerConfig[] = [
  {
    model: "Player",
    fields: [
      { field: "email" },
      { field: "lastAddress" },
      { field: "fullName" },
      { field: "lat" },
      { field: "lng" },
    ],
  },
  {
    model: "EventConnect",
    fields: [{ field: "ipAddress" }, { field: "hostname" }, { field: "hostgroup" }],
  },
  {
    model: "EventRcon",
    fields: [{ field: "password" }],
  },
  {
    model: "Server",
    fields: [{ field: "rconPassword" }],
  },
  {
    model: "ServerToken",
    fields: [{ field: "tokenHash" }, { field: "rconPassword" }],
  },
]

// Resolve from this file's location so the script works regardless of cwd.
// `__dirname` is available because @repo/db is CommonJS (NodeNext module
// resolution with no `"type": "module"` in package.json).
const INPUT_FILE = resolve(__dirname, "../../generated/graphql/pothos-inputs.ts")

function buildBlockRegex(model: string): RegExp {
  // Matches `export const <Model><Anything> = (t: any) => ({ ... });`
  // (also covers the `.implement({ fields: ... })` style at the bottom of each block,
  // but those are tiny and don't list scalar fields, so harmless to skip there.)
  return new RegExp(
    String.raw`(export const ${model}[A-Za-z0-9]*(?:Fields)?\s*=\s*\(t: any\) => \(\{)([\s\S]*?)(\}\);)`,
    "g",
  )
}

function stripFieldsFromBlock(block: string, fields: string[]): string {
  let stripped = block
  for (const field of fields) {
    // Each field declaration in the generated pothos-inputs file occupies
    // exactly one line, even when the value contains commas inside `{...}`.
    // Match the whole line including its trailing newline.
    const lineRegex = new RegExp(String.raw`^[ \t]+${field}:[^\n]*\n`, "gm")
    stripped = stripped.replace(lineRegex, "")
  }
  return stripped
}

function sanitize(source: string): { output: string; stripped: number } {
  let output = source
  let stripped = 0

  for (const { model, fields } of SANITIZER_CONFIG) {
    const blockRegex = buildBlockRegex(model)
    const fieldNames = fields.map((f) => f.field)

    output = output.replace(blockRegex, (_match, open, body, close) => {
      const before = body.length
      const newBody = stripFieldsFromBlock(body, fieldNames)
      if (newBody.length !== before) stripped += 1
      return `${open}${newBody}${close}`
    })
  }

  return { output, stripped }
}

function main(): void {
  const source = readFileSync(INPUT_FILE, "utf8")
  const { output, stripped } = sanitize(source)

  if (output === source) {
    console.log("[sanitize-pothos-inputs] no changes (already sanitized or no matches)")
    return
  }

  writeFileSync(INPUT_FILE, output, "utf8")
  console.log(`[sanitize-pothos-inputs] stripped sensitive fields from ${stripped} input block(s)`)
}

main()
