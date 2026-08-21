import { readFileSync } from "node:fs"
import { query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk"

type SdkManifest = {
  version: string
  claudeCodeVersion: string
}

const manifestUrl = new URL("../../../../node_modules/@anthropic-ai/claude-agent-sdk/package.json", import.meta.url)
const manifestInput = JSON.parse(readFileSync(manifestUrl, "utf8")) as Record<string, unknown>
if (typeof manifestInput.version !== "string" || typeof manifestInput.claudeCodeVersion !== "string") {
  throw new Error("Claude Agent SDK package metadata is invalid")
}
const manifest: SdkManifest = {
  version: manifestInput.version,
  claudeCodeVersion: manifestInput.claudeCodeVersion,
}

async function* prompts(): AsyncGenerator<SDKUserMessage> {
  await new Promise<never>(() => undefined)
}

const session = query({
  prompt: prompts(),
  options: {
    cwd: process.cwd(),
    settingSources: ["user", "project", "local"],
    tools: [],
  },
})

try {
  const models = await session.supportedModels()
  process.stdout.write(`${JSON.stringify({
    sdkVersion: manifest.version,
    claudeCodeVersion: manifest.claudeCodeVersion,
    models,
  }, null, 2)}\n`)
} finally {
  session.close()
}
