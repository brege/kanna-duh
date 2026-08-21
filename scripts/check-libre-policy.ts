#!/usr/bin/env bun
/**
 * Mechanical enforcement of docs/libre-policy.md.
 *
 * Scans tracked source for anti-feature signatures the fork removed, so an
 * upstream merge that reintroduces one fails loudly instead of shipping. This
 * is the first of two layers: it catches verbatim reintroduction. A renamed
 * or restructured anti-feature needs the semantic review the policy describes.
 */

import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

const ROOT = path.join(import.meta.dir, "..")
const SCAN_DIRS = ["src", "scripts", "bin"]
const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".html", ".css"])
/** This file names every forbidden pattern, so it cannot scan itself. */
const SELF = path.join("scripts", "check-libre-policy.ts")

interface Rule {
  id: string
  pattern: RegExp
  reason: string
}

const RULES: Rule[] = [
  {
    id: "kanna-operated-host",
    // Any kanna.sh host: analytics (/api/t), cloud control plane, share upload.
    pattern: /\bkanna\.sh\b/i,
    reason: "requests to a Kanna-operated service",
  },
  {
    id: "analytics",
    pattern: /\bANALYTICS_ENDPOINT\b|\banalyticsUserId\b|\banalyticsEnabled\b|\btrackLaunch\b/,
    reason: "analytics or telemetry reporting",
  },
  {
    id: "persistent-analytics-id",
    pattern: /anon_\$\{|\bcreateAnalyticsUserId\b/,
    reason: "a persistent analytics installation identifier",
  },
  {
    id: "commit-attribution",
    pattern: /co-authored-by:\s*kanna|shipped with kanna|\bKanna-Agent\b|\bbuildKanna(Commit|Pr|Agent|Attribution)/i,
    reason: "commit, pull-request, or prompt attribution",
  },
  {
    id: "cloud",
    pattern: /\bcloud-api\b|\bcreateCloudRuntime\b|\bCloudIdentity\b|\bpairSession\b|\bCLOUD_[A-Z_]+\b|\bcloud\.json\b/,
    reason: "Kanna Cloud pairing, heartbeat, or tunnel functionality",
  },
  {
    id: "startup-self-update",
    pattern: /\bmaybeSelfUpdate\b|\binstallNightlyBuild\b|codeload\.github\.com/,
    reason: "self-update that installs remote code on startup",
  },
]

/**
 * Hosts the fork is allowed to contact. Adding an entry is a deliberate policy
 * change, which is the point: an upstream merge that introduces a new
 * destination fails here until someone justifies it in the diff.
 */
const ALLOWED_HOSTS = new Set([
  "127.0.0.1",
  "localhost",
  "api.github.com",
  "github.com",
  "raw.githubusercontent.com",
  "objects.githubusercontent.com",
  "api.openai.com",
  "auth.openai.com",
  "openrouter.ai",
  "api.anthropic.com",
  "console.anthropic.com",
  "claude.ai",
  "claude.com",
  "docs.claude.com",
  "cursor.com",
  "registry.npmjs.org",
  "skills.sh",
])

/** Cloudflare quick/named tunnels, which back the user-initiated --share flag. */
const ALLOWED_HOST_SUFFIXES = [".trycloudflare.com"]

/**
 * Reserved and illustrative names. These appear in doc comments, placeholders,
 * and fixtures rather than real requests, so they never reach the network.
 */
const ILLUSTRATIVE_HOST_SUFFIXES = [
  ".test",
  ".example",
  ".invalid",
  ".localhost",
  ".internal",
  // RFC 2606 reserved documentation domains.
  ".example.com",
  ".example.net",
  ".example.org",
]
const ILLUSTRATIVE_HOSTS = new Set([
  "example.com",
  "example.com.",
  "example.net",
  "example.org",
  "gitlab.com",
  "dev-box",
  "host",
  "user",
  "gho_token",
])

interface Violation {
  file: string
  line: number
  rule: string
  reason: string
  text: string
}

async function collectFiles(dir: string): Promise<string[]> {
  const absolute = path.join(ROOT, dir)
  let entries
  try {
    entries = await readdir(absolute, { withFileTypes: true })
  } catch {
    return []
  }

  const files: string[] = []
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue
      files.push(...await collectFiles(entryPath))
      continue
    }
    if (entry.isFile() && SCAN_EXTENSIONS.has(path.extname(entry.name)) && entryPath !== SELF) {
      files.push(entryPath)
    }
  }
  return files
}

function checkRules(file: string, lines: string[], violations: Violation[]) {
  for (const [index, text] of lines.entries()) {
    for (const rule of RULES) {
      if (rule.pattern.test(text)) {
        violations.push({
          file,
          line: index + 1,
          rule: rule.id,
          reason: rule.reason,
          text: text.trim().slice(0, 160),
        })
      }
    }
  }
}

function checkHosts(file: string, lines: string[], violations: Violation[]) {
  // Matches the host portion of an absolute URL literal.
  const urlPattern = /https?:\/\/([a-zA-Z0-9._-]+)/g
  for (const [index, text] of lines.entries()) {
    for (const match of text.matchAll(urlPattern)) {
      const host = match[1]
      if (!host || ALLOWED_HOSTS.has(host)) continue
      if (ALLOWED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) continue
      if (ILLUSTRATIVE_HOSTS.has(host) || ILLUSTRATIVE_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
        continue
      }
      // Template-interpolated hosts (`https://${identity.host}`) resolve at
      // runtime; the rule patterns above cover the ones that mattered.
      if (host.startsWith("$")) continue
      violations.push({
        file,
        line: index + 1,
        rule: "network-allowlist",
        reason: `outbound host "${host}" is not in the allowlist`,
        text: text.trim().slice(0, 160),
      })
    }
  }
}

const files = (await Promise.all(SCAN_DIRS.map(collectFiles))).flat()
const violations: Violation[] = []

for (const file of files) {
  const contents = await readFile(path.join(ROOT, file), "utf8")
  const lines = contents.split("\n")
  checkRules(file, lines, violations)
  checkHosts(file, lines, violations)
}

if (violations.length > 0) {
  console.error(`libre-policy: ${violations.length} violation(s) found\n`)
  for (const violation of violations) {
    console.error(`  ${violation.file}:${violation.line}  [${violation.rule}] ${violation.reason}`)
    console.error(`      ${violation.text}`)
  }
  console.error("\nSee docs/libre-policy.md. If a change is intentional, update the policy and this check together.")
  process.exit(1)
}

console.log(`libre-policy: clean (${files.length} files scanned)`)
