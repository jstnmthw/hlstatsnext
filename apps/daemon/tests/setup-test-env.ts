import { config } from "dotenv"
import path from "path"

// Resolve the path to the root of the daemon-v2 package
const packageRoot = path.resolve(__dirname, "..")

// Load .env.test file from the package root
const envFile = path.resolve(packageRoot, ".env.test")

console.log(`Loading test environment from: ${envFile}`)

config({ path: envFile })
