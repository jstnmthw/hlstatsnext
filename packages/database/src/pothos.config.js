/** @type {import('prisma-generator-pothos-codegen').Config} */
import { readFileSync, writeFileSync } from "fs"
import { glob } from "glob"

export const inputs = {
  outputFilePath: `./src/generated/graphql/pothos-inputs.ts`,
  prismaImporter: `import { Prisma } from "@repo/database/client";`,
  prismaCaller: "Prisma",
}
export const crud = {
  outputDir: `./src/generated/graphql/pothos-crud`,
  inputsImporter: `import * as Inputs from "@/generated/graphql/pothos-inputs"`,
  resolverImports: `\nimport { db } from "@repo/database/client";`,
  builderImporter: `import { builder } from "@/modules/pothos/builder.service";`,
  prismaImporter: `import { db } from "@repo/database/client";`,
  prismaCaller: "db",
}

export const global = {
  afterGenerate: () => {
    // Get all generated files that might contain the incorrect import
    const files = glob.sync(`./src/generated/graphql/pothos-crud/**/*.ts`)

    // Also include the pothos-inputs.ts file
    const inputsFile = `./src/generated/graphql/pothos-inputs.ts`
    if (glob.sync(inputsFile).length > 0) {
      files.push(inputsFile)
    }

    // Also include the pothos-types.ts file
    const typesFile = `./src/generated/graphql/pothos-types.ts`
    if (glob.sync(typesFile).length > 0) {
      files.push(typesFile)
    }

    // Define the regular expression to find and replace the incorrect builder import
    const wrongBuilderImportRegex =
      /import { builder } from ['"]([./]+builder|[./]*@\/builder)['"];/g
    const correctBuilderImport = `import { builder } from "@/modules/pothos/builder.service";`

    // Define regex to fix the inputs import issue
    // const wrongInputsImportRegex = /import \* as Inputs from ["']([./]+)pothos-inputs["'];/g
    // const correctInputsImport = `import * as Inputs from "@/generated/graphql/pothos-inputs";`

    // Define regex to fix client imports
    // const wrongClientImportRegex = /import { db } from ["']([./]+)client["'];/g
    // const correctClientImport = `import { db } from "@repo/database/client";`

    // Loop through each file and fix the imports
    for (const file of files) {
      let content = readFileSync(file, "utf8")
      let modified = false

      // Add @ts-nocheck at the top if not already present
      if (!content.startsWith("// @ts-nocheck")) {
        content = "// @ts-nocheck\n" + content
        modified = true
      }

      if (wrongBuilderImportRegex.test(content)) {
        content = content.replace(wrongBuilderImportRegex, correctBuilderImport)
        modified = true
      }

      // Fix inputs imports
      // if (wrongInputsImportRegex.test(content)) {
      //   content = content.replace(wrongInputsImportRegex, correctInputsImport)
      //   modified = true
      // }

      // Fix client imports
      // if (wrongClientImportRegex.test(content)) {
      //   content = content.replace(wrongClientImportRegex, correctClientImport)
      //   modified = true
      // }

      if (modified) {
        writeFileSync(file, content, "utf8")
      }
    }

    // Create index.d.ts for TypeScript declarations
    const indexDtsContent = `// Type declarations for generated Pothos CRUD code
// This bypasses TypeScript compilation issues with generated files

export declare function generateAllCrud(opts?: CrudOptions): void
export declare function generateAllObjects(opts?: CrudOptions): any[]
export declare function generateAllQueries(opts?: CrudOptions): void
export declare function generateAllMutations(opts?: CrudOptions): void
export declare function generateAllResolvers(opts?: CrudOptions): void

export interface CrudOptions {
  include?: string[]
  exclude?: string[]
  handleResolver?: (props: {
    modelName: string
    field: any
    operationName: string
    resolverName: string
    t: any
    isPrismaField: boolean
    type: "Query" | "Mutation"
  }) => any
}
`

    // Create index.js for runtime re-export
    const indexJsContent = `// Runtime re-export of the autocrud implementation
// This allows the code to run while TypeScript uses the .d.ts declarations

export * from './autocrud.js'
`

    // Write the index files
    writeFileSync(`./src/generated/graphql/pothos-crud/index.d.ts`, indexDtsContent, "utf8")
    writeFileSync(`./src/generated/graphql/pothos-crud/index.js`, indexJsContent, "utf8")
  },
}
