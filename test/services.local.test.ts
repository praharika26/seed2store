// @vitest-environment node
import { mkdtempSync } from "fs"
import { tmpdir } from "os"
import path from "path"
import { runServiceSuite } from "./services.suite"

delete process.env.MONGODB_URI
process.env.DEMO_SEED = "true"
process.env.S2S_DATA_DIR = mkdtempSync(path.join(tmpdir(), "s2s-test-"))

runServiceSuite("local")
