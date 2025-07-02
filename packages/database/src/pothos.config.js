/** @type {import('prisma-generator-pothos-codegen').Config} */
import { readFileSync, writeFileSync } from "fs"
import { glob } from "glob"

export const inputs = {
  outputFilePath: `./src/generated/graphql/pothos-inputs.ts`,
  prismaImporter: `import { db } from "@/client";`,
  prismaCaller: "db",
}
export const crud = {
  outputDir: `./src/generated/graphql/pothos-inputs`,
  inputsImporter: `import * as Inputs from "@/generated/graphql/pothos-inputs";`,
  resolverImports: `\nimport { db } from "@/client";`,
  builderImporter: `import { builder } from "@/builder";`,
  prismaImporter: `import { db } from "@/client";`,
  prismaCaller: "db",
}

export const global = {
  builderLocation: "@/builder",
  afterGenerate: () => {
    // Get all generated files that might contain the incorrect import
    const files = glob.sync(`./src/generated/graphql/pothos-inputs/**/*.ts`)

    // Define the regular expression to find and replace the incorrect builder import
    const wrongBuilderImportRegex = /import { builder } from '(\.\.\/)+@\/builder';/g
    const correctBuilderImport = "import { builder } from '@/builder';"

    // Loop through each file and fix the import
    for (const file of files) {
      try {
        let content = readFileSync(file, "utf8")
        if (wrongBuilderImportRegex.test(content)) {
          content = content.replace(wrongBuilderImportRegex, correctBuilderImport)
          writeFileSync(file, content, "utf8")
          console.log(`✅ Fixed builder import in: ${file}`)
        }
      } catch (err) {
        console.error(`❌ Error processing file ${file}:`, err)
      }
    }
  },
}
