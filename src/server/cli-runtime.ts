import process from "node:process"
import { spawnSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import { hasCommand, spawnDetached } from "./process-utils"
import { APP_NAME, CLI_COMMAND, getDataDirDisplay, LOG_PREFIX } from "../shared/branding"
import type { ShareMode } from "../shared/share"
import { assertNoHostOverride, getShareCliFlag, isShareEnabled, isTokenShareMode } from "../shared/share"
import type { UpdateInstallErrorCode } from "../shared/types"
import { PROD_SERVER_PORT } from "../shared/ports"
import { CLI_SUPPRESS_OPEN_ONCE_ENV_VAR } from "./restart"
import { logShareDetails, renderTerminalQr, startShareTunnel, type StartedShareTunnel } from "./share"
import { probeExistingInstance, type ExistingInstance } from "./instance"

export interface CliOptions {
  port: number
  host: string
  openBrowser: boolean
  share: ShareMode
  password: string | null
  strictPort: boolean
}

export interface CliUpdateOptions {
  version: string
  fetchLatestVersion: (packageName: string) => Promise<string>
  installVersion: (packageName: string, version: string) => UpdateInstallAttemptResult
  argv: string[]
  command: string
}

export interface StartedCli {
  kind: "started"
  stop: () => Promise<void>
}

export interface RestartingCli {
  kind: "restarting"
  reason: "startup_update" | "ui_update"
}

export interface ExitedCli {
  kind: "exited"
  code: number
}

export type CliRunResult = StartedCli | RestartingCli | ExitedCli

export interface CliRuntimeDeps {
  version: string
  bunVersion: string
  startServer: (options: CliOptions & {
    update: CliUpdateOptions
    onMigrationProgress?: (message: string) => void
    trustProxy?: boolean
  }) => Promise<{ port: number; stop: () => Promise<void> }>
  fetchLatestVersion: (packageName: string) => Promise<string>
  installVersion: (packageName: string, version: string) => UpdateInstallAttemptResult
  openUrl: (url: string) => void
  log: (message: string) => void
  warn: (message: string) => void
  renderShareQr?: (url: string) => Promise<string>
  startShareTunnel?: (localUrl: string, shareMode: Exclude<ShareMode, false>) => Promise<StartedShareTunnel>
  probeExistingInstanceImpl?: (port: number) => Promise<ExistingInstance | null>
}

export interface UpdateInstallAttemptResult {
  ok: boolean
  errorCode: UpdateInstallErrorCode | null
  userTitle: string | null
  userMessage: string | null
}

type ParsedArgs =
  | { kind: "run"; options: CliOptions }
  | { kind: "help" }
  | { kind: "version" }

const MINIMUM_BUN_VERSION = "1.3.5"

function throwShareConflict(share: Exclude<ShareMode, false>, hostFlag: "--host" | "--remote"): never {
  throw new Error(`${getShareCliFlag(share)} cannot be used with ${hostFlag}`)
}

function printHelp() {
  console.log(`${APP_NAME} — local-only project chat UI

Usage:
  ${CLI_COMMAND} [options]

Options:
  --port <number>      Port to listen on (default: ${PROD_SERVER_PORT})
  --host <host>        Bind to a specific host or IP
  --remote             Shortcut for --host 0.0.0.0
  --share              Create a public Cloudflare quick tunnel with terminal QR
  --cloudflared <token>
                       Run a named Cloudflare tunnel from a token
  --password <secret>  Require a password before loading the app
  --strict-port        Fail instead of trying another port
  --no-open            Don't open browser automatically
  --version            Print version and exit
  --help               Show this help message`)
}

export function parseArgs(argv: string[]): ParsedArgs {
  let port = PROD_SERVER_PORT
  let host = "127.0.0.1"
  let openBrowser = true
  let share: ShareMode = false
  let password: string | null = null
  let sawHost = false
  let sawRemote = false
  let strictPort = false

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--version" || arg === "-v") {
      return { kind: "version" }
    }
    if (arg === "--help" || arg === "-h") {
      return { kind: "help" }
    }
    if (arg === "--port") {
      const next = argv[index + 1]
      if (!next) throw new Error("Missing value for --port")
      port = Number(next)
      index += 1
      continue
    }
    if (arg === "--host") {
      const next = argv[index + 1]
      if (!next || next.startsWith("-")) throw new Error("Missing value for --host")
      if (isShareEnabled(share)) {
        throwShareConflict(share, "--host")
      }
      host = next
      sawHost = true
      index += 1
      continue
    }
    if (arg === "--remote") {
      if (isShareEnabled(share)) {
        throwShareConflict(share, "--remote")
      }
      host = "0.0.0.0"
      sawRemote = true
      continue
    }
    if (arg === "--share") {
      assertNoHostOverride("--share", sawHost, sawRemote)
      share = "quick"
      continue
    }
    if (arg === "--cloudflared") {
      assertNoHostOverride("--cloudflared", sawHost, sawRemote)
      const next = argv[index + 1]
      if (!next || next.startsWith("-")) throw new Error("Missing value for --cloudflared")
      share = { kind: "token", token: next }
      index += 1
      continue
    }
    if (arg === "--no-open") {
      openBrowser = false
      continue
    }
    if (arg === "--password") {
      const next = argv[index + 1]
      if (!next || next.startsWith("-")) throw new Error("Missing value for --password")
      password = next
      index += 1
      continue
    }
    if (arg === "--strict-port") {
      strictPort = true
      continue
    }
    if (!arg.startsWith("-")) throw new Error(`Unexpected positional argument: ${arg}`)
  }

  return {
    kind: "run",
    options: {
      port,
      host,
      openBrowser,
      share,
      password,
      strictPort,
    },
  }
}

export function compareVersions(currentVersion: string, latestVersion: string) {
  const currentParts = normalizeVersion(currentVersion)
  const latestParts = normalizeVersion(latestVersion)
  const length = Math.max(currentParts.length, latestParts.length)

  for (let index = 0; index < length; index += 1) {
    const current = currentParts[index] ?? 0
    const latest = latestParts[index] ?? 0
    if (current === latest) continue
    return current < latest ? -1 : 1
  }

  return 0
}

function normalizeVersion(version: string) {
  return version
    .trim()
    .replace(/^v/i, "")
    .split("-")[0]
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part))
}

export async function runCli(argv: string[], deps: CliRuntimeDeps): Promise<CliRunResult> {
  let parsedArgs = parseArgs(argv)
  if (parsedArgs.kind === "version") {
    deps.log(deps.version)
    return { kind: "exited", code: 0 }
  }
  if (parsedArgs.kind === "help") {
    printHelp()
    return { kind: "exited", code: 0 }
  }

  if (parsedArgs.kind !== "run") {
    // Unreachable: every non-run kind returned above.
    return { kind: "exited", code: 0 }
  }
  const runOptions = parsedArgs.options

  if (compareVersions(deps.bunVersion, MINIMUM_BUN_VERSION) < 0) {
    deps.warn(`${LOG_PREFIX} Bun ${MINIMUM_BUN_VERSION}+ is required for the embedded terminal. Current Bun: ${deps.bunVersion}`)
    return { kind: "exited", code: 1 }
  }

  const suppressOpenBrowser = process.env[CLI_SUPPRESS_OPEN_ONCE_ENV_VAR] === "1"

  // Single-instance guard: two servers on one data dir mean two JSONL
  // writers. If this data dir is already being served on the configured
  // port, just point the user (and browser) at it. A different fingerprint
  // (e.g. dev profile) keeps the try-next-port behavior.
  const existing = await (deps.probeExistingInstanceImpl ?? probeExistingInstance)(runOptions.port)
  if (existing) {
    deps.log(`${LOG_PREFIX} ${APP_NAME} is already running at ${existing.localUrl}`)
    if (runOptions.openBrowser && !suppressOpenBrowser) {
      deps.openUrl(existing.localUrl)
    }
    return { kind: "exited", code: 0 }
  }

  const started = await deps.startServer({
    ...runOptions,
    trustProxy: isShareEnabled(runOptions.share),
    onMigrationProgress: deps.log,
    update: {
      version: deps.version,
      fetchLatestVersion: deps.fetchLatestVersion,
      installVersion: deps.installVersion,
      argv,
      command: CLI_COMMAND,
    },
  })
  const { port, stop } = started
  const bindHost = runOptions.host
  const displayHost = isShareEnabled(runOptions.share) || bindHost === "127.0.0.1" || bindHost === "0.0.0.0" ? "localhost" : bindHost
  const launchUrl = `http://${displayHost}:${port}`
  let shareTunnelStop: (() => void) | null = null

  deps.log(`${LOG_PREFIX} listening on http://${bindHost}:${port}`)
  deps.log(`${LOG_PREFIX} data dir: ${getDataDirDisplay()}`)

  if (isShareEnabled(runOptions.share)) {
    try {
      const shareTunnel = await (deps.startShareTunnel ?? ((localUrl, shareMode) => startShareTunnel(localUrl, shareMode, {
        log: (message) => deps.log(`${LOG_PREFIX} ${message}`),
      })))(launchUrl, runOptions.share)
      shareTunnelStop = shareTunnel.stop
      if (shareTunnel.publicUrl) {
        await logShareDetails(deps.log, shareTunnel.publicUrl, launchUrl, deps.renderShareQr ?? renderTerminalQr)
      } else {
        deps.warn(`${LOG_PREFIX} named tunnel started but no public hostname was detected`)
        if (isTokenShareMode(runOptions.share)) {
          deps.warn(`${LOG_PREFIX} use the hostname configured for the provided Cloudflare tunnel token`)
        }
        deps.log("Local URL:")
        deps.log(launchUrl)
      }
    } catch (error) {
      await stop()
      deps.warn(`${LOG_PREFIX} failed to start Cloudflare share tunnel`)
      if (error instanceof Error && error.message) {
        deps.warn(`${LOG_PREFIX} ${error.message}`)
      }
      return { kind: "exited", code: 1 }
    }
  }

  if (runOptions.openBrowser && !isShareEnabled(runOptions.share) && !suppressOpenBrowser) {
    deps.openUrl(launchUrl)
  }

  return {
    kind: "started",
    stop: async () => {
      shareTunnelStop?.()
      await stop()
    },
  }
}

export function openUrl(url: string) {
  const platform = process.platform
  if (platform === "darwin") {
    void spawnDetached("open", [url]).catch(() => {})
  } else if (platform === "win32") {
    void spawnDetached("cmd", ["/c", "start", "", url]).catch(() => {})
  } else {
    void spawnDetached("xdg-open", [url]).catch(() => {})
  }
  console.log(`${LOG_PREFIX} opened in default browser`)
}

export async function fetchLatestPackageVersion(packageName: string) {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`)
  if (!response.ok) {
    throw new Error(`registry returned ${response.status}`)
  }

  const payload = await response.json() as { version?: unknown }
  if (typeof payload.version !== "string" || !payload.version.trim()) {
    throw new Error("registry response did not include a version")
  }

  return payload.version
}

export function classifyInstallVersionFailure(output: string): UpdateInstallAttemptResult {
  const normalizedOutput = output.trim()
  if (/No version matching .* found|failed to resolve/i.test(normalizedOutput)) {
    return {
      ok: false,
      errorCode: "version_not_live_yet",
      userTitle: "Update not live yet",
      userMessage: "This update is still propagating. Try again in a few minutes.",
    }
  }

  return {
    ok: false,
    errorCode: "install_failed",
    userTitle: "Update failed",
    userMessage: `${APP_NAME} could not install the update. Try again later.`,
  }
}

function bunGlobalDir(): string {
  return process.env.BUN_INSTALL || path.join(homedir(), ".bun")
}

/**
 * Strip corrupt entries from Bun's global package manifest. A global install
 * of `.` is mis-parsed by Bun: it installs nothing but records a junk
 * dependency (key "" or "@", value "." / "@."). While one is present, Bun
 * refuses EVERY further global install with a DependencyLoop error, so the
 * installer repairs the manifest first. Returns true when it was repaired.
 */
export function repairBunGlobalManifest(globalDir = bunGlobalDir()): boolean {
  const manifestPath = path.join(globalDir, "install", "global", "package.json")
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { dependencies?: Record<string, unknown> }
    const dependencies = manifest.dependencies
    if (!dependencies) return false
    let repaired = false
    for (const [name, value] of Object.entries(dependencies)) {
      const junkName = name === "" || name === "@"
      // A junk value is a bare ".", optionally prefixed with "@" or "file:".
      const junkValue = typeof value === "string" && /^(?:@|file:)?\.$/.test(value)
      if (junkName || junkValue) {
        delete dependencies[name]
        repaired = true
      }
    }
    if (repaired) {
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n")
    }
    return repaired
  } catch {
    // Missing or unreadable manifest — nothing to repair.
    return false
  }
}

export function installPackageVersion(packageName: string, version: string) {
  if (!hasCommand("bun")) {
    return {
      ok: false,
      errorCode: "command_missing",
      userTitle: "Bun not found",
      userMessage: `${APP_NAME} could not find Bun to install the update.`,
    } satisfies UpdateInstallAttemptResult
  }

  // A corrupt global manifest (see repairBunGlobalManifest) makes every
  // global install fail with a DependencyLoop error — heal it first so
  // machines that hit 0.57.0's nightly bug can still auto-update.
  repairBunGlobalManifest()

  const result = spawnSync("bun", ["install", "-g", `${packageName}@${version}`], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  })
  const stdout = result.stdout ?? ""
  const stderr = result.stderr ?? ""
  if (stdout) process.stdout.write(stdout)
  if (stderr) process.stderr.write(stderr)
  if (result.status === 0) {
    return {
      ok: true,
      errorCode: null,
      userTitle: null,
      userMessage: null,
    } satisfies UpdateInstallAttemptResult
  }

  return classifyInstallVersionFailure(`${stdout}\n${stderr}`)
}
