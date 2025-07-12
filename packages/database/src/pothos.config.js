/** @type {import('prisma-generator-pothos-codegen').Config} */

import { readdir, readFile, writeFile, stat } from "fs/promises"
import { join } from "path"

// Import replacement configuration
const IMPORT_REPLACEMENTS = [
  {
    // Find any relative import path to builder (any number of ../)
    pattern: /import\s+\{\s*builder\s*\}\s+from\s+['"](\.\.\/)+builder['"];?/g,
    replacement: 'import { builder } from "@repo/database/builder";',
    description: "Fix builder imports to use absolute path",
  },
  // Fix bigint type issues for GraphQL
  {
    pattern: /resolve:\s*\(parent\)\s*=>\s*parent\.startIpNum,/g,
    replacement: "resolve: (parent) => String(parent.startIpNum),",
    description: "Convert startIpNum bigint to string for GraphQL compatibility",
  },
  {
    pattern: /resolve:\s*\(parent\)\s*=>\s*parent\.endIpNum,/g,
    replacement: "resolve: (parent) => String(parent.endIpNum),",
    description: "Convert endIpNum bigint to string for GraphQL compatibility",
  },
  {
    pattern: /resolve:\s*\(parent\)\s*=>\s*parent\.locId,/g,
    replacement: "resolve: (parent) => String(parent.locId),",
    description: "Convert locId bigint to string for GraphQL compatibility",
  },
  // Fix compound unique key issues
  {
    pattern: /findUnique:\s*\(fields\)\s*=>\s*\(\{\s*\.\.\.fields\s*\}\)/g,
    replacement:
      "findUnique: ({ eventTime, playerId, game }) => ({ eventTime_playerId_game: { eventTime, playerId, game } })",
    description: "Fix compound unique key handling",
  },
  // Fix prismaModelName type issues
  {
    pattern: /export const (\w+)Object = definePrismaObject\('([^']+)',/g,
    replacement: "export const $1Object = definePrismaObject('$2' as any,",
    description: "Fix prismaModelName type issues by casting to any",
  },
  // Fix the entire object definition to avoid type issues
  {
    pattern: /export const (\w+)Object = definePrismaObject\('([^']+)' as any, \{/g,
    replacement: "export const $1Object = definePrismaObject('$2' as any, {",
    description: "Ensure consistent any casting",
  },
  // Cast the entire export to avoid type issues
  {
    pattern: /export const (\w+)Object = definePrismaObject\('([^']+)' as any,/g,
    replacement: "export const $1Object = definePrismaObject('$2' as any,",
    description: "Cast entire definePrismaObject call",
  },
  // Cast the entire variable to any to avoid type issues
  {
    pattern: /export const (\w+)Object = definePrismaObject\('([^']+)' as any,/g,
    replacement: "export const $1Object: any = definePrismaObject('$2' as any,",
    description: "Cast entire variable to any",
  },
  // Add @ts-nocheck to all generated files EXCEPT autocrud.ts
  {
    pattern: /^(import.*\n)/,
    replacement: "// @ts-nocheck\n$1",
    description: "Add TypeScript ignore comment to generated files",
  },
  // Add more patterns here as needed:
  // {
  //   pattern: /import\s+\{\s*someOtherImport\s*\}\s+from\s+['"](\.\.\/)+someOtherPath['"];?/g,
  //   replacement: 'import { someOtherImport } from "@/someOtherPath";',
  //   description: 'Fix someOtherImport imports to use absolute path'
  // }
]

// Recursively find all TypeScript files in a directory
async function findTsFiles(dir, files = []) {
  const items = await readdir(dir)

  for (const item of items) {
    const fullPath = join(dir, item)
    const stats = await stat(fullPath)

    if (stats.isDirectory()) {
      await findTsFiles(fullPath, files)
    } else if (item.endsWith(".ts") || item.endsWith(".tsx")) {
      files.push(fullPath)
    }
  }

  return files
}

// Process a single file with all replacement patterns
async function processFile(filePath) {
  const content = await readFile(filePath, "utf8")
  let modifiedContent = content
  let hasChanges = false

  // Skip @ts-nocheck for autocrud.ts since it's the main export file
  const isAutocrudFile = filePath.includes("autocrud.ts")

  for (const replacement of IMPORT_REPLACEMENTS) {
    // Skip the @ts-nocheck pattern for autocrud.ts
    if (isAutocrudFile && replacement.description.includes("TypeScript ignore comment")) {
      continue
    }

    const newContent = modifiedContent.replace(replacement.pattern, replacement.replacement)
    if (newContent !== modifiedContent) {
      hasChanges = true
      modifiedContent = newContent
    }
  }

  if (hasChanges) {
    await writeFile(filePath, modifiedContent, "utf8")
    return true
  }

  return false
}

// Create the index.ts file for pothos-crud directory
async function createPothosCrudIndex() {
  const pothosCrudDir = "./src/generated/graphql/pothos-crud"
  const indexFilePath = join(pothosCrudDir, "index.ts")

  const indexContent = `// Re-export everything from autocrud.ts to make it available as a namespace
export * from './autocrud';
`

  await writeFile(indexFilePath, indexContent, "utf8")
  return true
}

// Main function to process all generated files
async function fixGeneratedImports() {
  const generatedDir = "./src/generated"

  // First, create the index.ts file for pothos-crud
  await createPothosCrudIndex()

  const tsFiles = await findTsFiles(generatedDir)

  for (const file of tsFiles) {
    await processFile(file)
  }
}

export const crud = {
  outputDir: `./src/generated/graphql/`,
  exportEverythingInObjectsDotTs: false,
}

export const inputs = {
  outputFilePath: `./src/generated/graphql/inputs.ts`,
  simple: true,
}

export const global = {
  builderLocation: "./src/builder",
}
