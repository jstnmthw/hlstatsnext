/** @type {import('prisma-generator-pothos-codegen').Config} */

import { readdir, readFile, writeFile, stat } from "fs/promises"
import { join } from "path"

// Import replacement configuration
const IMPORT_REPLACEMENTS = [
  {
    // Find any relative import path to builder (any number of ../)
    pattern: /import\s+\{\s*builder\s*\}\s+from\s+['"](\.\.\/)+builder['"];?/g,
    replacement: 'import { builder } from "@repo/database";',
    description: "Fix builder imports to use absolute path",
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

  for (const replacement of IMPORT_REPLACEMENTS) {
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
  outputDir: `./src/generated/graphql/pothos-crud`,
  simple: true,
  excludeResolversContain: [],
  prismaCaller: "db",
  disabled: false,
  inputsImporter: `import { GraphQLInputs as Inputs } from "@repo/database"`,
  deleteOutputDirBeforeGenerate: true,
  exportEverythingInObjectsDotTs: false,
  prismaImporter: `import { Prisma } from "@repo/database";`,
  resolverImports: `\nimport { db } from "@repo/database";`,
  builderImporter: `import { builder } from "@/builder"`,
}

export const inputs = {
  outputFilePath: `./src/generated/graphql/pothos-inputs.ts`,
  prismaImporter: `import { Prisma } from "@repo/database";`,
  prismaCaller: "db",
  builderImporter: `import { builder } from "@/builder"`,
}

export const global = {
  builderImporter: `import { builder } from "@/builder"`,
  afterGenerate: fixGeneratedImports,
}
