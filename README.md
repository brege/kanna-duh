<p align="center">
  <img src="assets/icon.png" alt="kanna-duh" width="80" />
</p>

<h1 align="center">kanna-duh</h1>

<p align="center">
  <strong>A local web UI for the Claude Code, Codex, Cursor, and Pi CLIs</strong>
</p>

<p align="center">
  The libre fork of <a href="https://github.com/jakemor/kanna">Kanna</a>, with analytics, attribution, cloud, and product promotion removed.
</p>

<br />

> **Status: in testing. Distributed through GitHub Releases, not npm.**
> Release tarballs contain the prebuilt client and the standalone Bun server. There is no website: this repository is the only home.

<br />

## What this fork removes

Every item below is gone from the code, not merely disabled. The full rules and the removal table live in **[docs/libre-policy.md](docs/libre-policy.md)**, and `bun run check:policy` fails the build if any of it comes back.

| Removed | Was |
| --- | --- |
| Analytics and telemetry | Events posted to a vendor endpoint, on by default, keyed to a persistent installation id |
| Commit and PR attribution | A commit footer, a `Co-Authored-By` trailer, a `Kanna-Agent` trailer, and an advertisement appended to pull request bodies |
| Prompt branding injection | Instructions appended to every provider's system prompt telling the model to emit that attribution |
| Kanna Cloud | Account pairing, control-plane heartbeat, reverse tunnel, and the hosted proxy integration |
| Promotion in exports | A marketing banner and vendor links baked into every exported transcript |
| Transcript upload | Exports uploaded to a vendor host and served from a public link. Export is now local-only |
| Silent self-update | A check-and-install-and-restart that ran on every launch, and a nightly channel that built and installed code from the upstream repo |

Removal was the only option for several of these: attribution had no opt-out, and analytics defaulted to enabled.

<br />

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/screenshot.png" />
    <source media="(prefers-color-scheme: light)" srcset="assets/screenshot-light.png" />
    <img src="assets/screenshot.png" alt="kanna-duh screenshot" width="800" />
  </picture>
</p>

## Install

Requires [Bun](https://bun.sh) v1.3.5+. If Bun isn't installed:

```bash
curl -fsSL https://bun.sh/install | bash
```

Install the latest prebuilt release:

```bash
bun install --global https://github.com/brege/kanna-duh/releases/latest/download/kanna-duh.tgz
```

Or build and install from source:

```bash
git clone https://github.com/brege/kanna-duh.git
cd kanna-duh
bun install
bun run build
bun install --global .
```

Then run from any project directory:

```bash
kanna
```

It opens in your browser at [`localhost:3210`](http://localhost:3210).

The global command is still `kanna`. If you have upstream `kanna-code` installed, uninstall it first (`bun remove -g kanna-code`), since both provide the same command name.

The Settings update action checks GitHub Releases and installs the same prebuilt tarball before restarting Kanna.

## Features

- **Multi-provider support** — switch between Claude, Codex (OpenAI), Cursor, and Pi from the chat input, with per-provider model selection, reasoning effort controls, and Codex fast mode
- **Bundled Pi agent** — the [pi coding agent](https://github.com/badlogic/pi-mono) ships as a dependency and runs in-process through the Model Registry (Settings): point it at OpenRouter, OpenAI, or any custom OpenAI-compatible endpoint, pin fave models to the picker, and use any model id with standardized reasoning efforts — no local pi installation involved
- **Project-first sidebar** — chats grouped under projects, with live status indicators (idle, running, waiting, failed)
- **Drag-and-drop project ordering** — reorder project groups in the sidebar with persistent ordering
- **Local project discovery** — auto-discovers projects from both Claude and Codex local history
- **Rich transcript rendering** — hydrated tool calls, collapsible tool groups, plan mode dialogs, and interactive prompts with full result display
- **Quick responses** — lightweight structured queries (e.g. title generation) via Haiku with automatic Codex fallback
- **Plan mode** — review and approve agent plans before execution
- **Persistent local history** — refresh-safe routes backed by JSONL event logs and compacted snapshots
- **Auto-generated titles** — chat titles generated in the background via Claude Haiku
- **Session resumption** — resume agent sessions with full context preservation
- **WebSocket-driven** — real-time subscription model with reactive state broadcasting

## Architecture

```
Browser (React + Zustand)
    ↕  WebSocket
Bun Server (HTTP + WS)
    ├── WSRouter ─── subscription & command routing
    ├── AgentCoordinator ─── multi-provider turn management
    ├── ProviderCatalog ─── provider/model/effort normalization
    ├── QuickResponseAdapter ─── structured queries with provider fallback
    ├── EventStore ─── JSONL persistence + snapshot compaction
    └── ReadModels ─── derived views (sidebar, chat, projects)
    ↕  stdio
Claude Agent SDK / Codex App Server (local processes)
    ↕
Local File System (~/.kanna/data/, project dirs)
```

**Key patterns:** Event sourcing for all state mutations. CQRS with separate write (event log) and read (derived snapshots) paths. Reactive broadcasting — subscribers get pushed fresh snapshots on every state change. Multi-provider agent coordination with tool gating for user-approval flows. Provider-agnostic transcript hydration for unified rendering.

## Requirements

- [Bun](https://bun.sh) v1.3.5+
- A working [Claude Code](https://docs.anthropic.com/en/docs/claude-code) environment
- _(Optional)_ [Codex CLI](https://github.com/openai/codex) for Codex provider support

Embedded terminal support uses Bun's native PTY APIs and currently works on macOS/Linux.

## Usage

```bash
kanna                  # start with defaults (localhost only)
kanna --port 4000      # custom port
kanna --no-open        # don't open browser
kanna --password <secret>      # require a password before loading the app
kanna --share                # create a public quick tunnel + terminal QR
kanna --cloudflared <token>  # run a named Cloudflare tunnel from a token
```

Default URL: `http://localhost:3210`

### Network access (Tailscale / LAN)

By default it binds to `127.0.0.1` (localhost only). Use `--host` to bind a specific interface, or `--remote` as a shorthand for `0.0.0.0`:

```bash
kanna --remote                     # bind all interfaces — browser opens localhost:3210
kanna --host dev-box               # bind to a specific hostname — browser opens http://dev-box:3210
kanna --host 192.168.1.x           # bind to a specific LAN IP
kanna --host 100.64.x.x            # bind to a specific Tailscale IP
```

When `--host <hostname>` is given, the browser opens `http://<hostname>:3210` automatically. Other machines on your network can connect to the same URL.

### Password protection

Use `--password` to require a launch password before the app or websocket can connect:

```bash
kanna --password my-secret
bun run dev --password my-secret
```

The password is verified once, then a browser-session cookie is set. The password itself is not stored in the browser. When password protection is enabled, the backend requires authentication for API routes and `/ws`. The SPA shell still loads, `/health` remains public for restart detection, and the same in-app password screen is used in both dev and production.

### Public share link

Use `--share` to create a temporary public `trycloudflare.com` URL and print a terminal QR code:

```bash
kanna --share
kanna --share --port 4000
kanna --cloudflared <token>
```

This is a Cloudflare tunnel you start explicitly. It is not a hosted service, and nothing is registered with a vendor.

`--share` is incompatible with `--host` and `--remote`. It does not open a browser automatically.

Without a token, it prints:

```text
QR Code:
...

Public URL:
https://<random>.trycloudflare.com

Local URL:
http://localhost:3210
```

With `--cloudflared <token>`, it runs `cloudflared tunnel run --token <token> --url <local-url>`. If the public hostname can be detected from cloudflared output, it prints the same QR/public/local block. If not, it keeps the tunnel running, warns that no public hostname was detected, and prints the local URL so you can use the hostname already configured for that tunnel in Cloudflare.

## Development

```bash
bun run dev
```

`--port` sets the Vite client port and the backend runs on `port + 1`. Both use strict port binding, so a busy port fails loudly instead of silently moving:

```bash
bun run dev --port 5180     # client 5180, backend 5181
npm run dev -- --port 5180  # npm needs the -- separator
```

The same `--remote` and `--host` flags work in dev. `--share` is also supported and exposes the Vite client URL publicly:

```bash
bun run dev --share
bun run dev --cloudflared <token>
bun run dev --port 3333 --share
```

`--share` remains incompatible with `--host` and `--remote`.

Or run client and server separately:

```bash
bun run dev:client   # http://localhost:5174
bun run dev:server   # http://localhost:5175
```

### Running the tests

```bash
bun test
```

Tests that need git create throwaway repositories. A global git config with `commit.gpgsign`, `merge.ff`, or URL rewrites will leak into them and cause unrelated failures, so point git at a clean config:

```bash
touch /tmp/gitconfig-clean
GIT_CONFIG_GLOBAL=/tmp/gitconfig-clean bun test
```

## Scripts

| Command                 | Description                             |
| ----------------------- | --------------------------------------- |
| `bun run build`         | Build for production                    |
| `bun run check`         | Typecheck + anti-feature policy + build  |
| `bun run check:policy`  | Anti-feature policy check only           |
| `bun run dev`           | Run client + server together            |
| `bun run dev:client`    | Vite dev server only                    |
| `bun run dev:server`    | Bun backend only                        |
| `bun run start`         | Start production server                 |
| `bun test`              | Unit/integration tests                  |

## Project Structure

```
src/
├── client/          React UI layer
│   ├── app/         App router, pages, socket client, useKannaState + feature hooks
│   │                (useChatCommands, useSendMessage, useAppSettingsSync,
│   │                useUpdateRestart, useShareExport, snapshotEquality)
│   ├── components/  Messages, chat chrome (incl. chat-ui/git/ panel modules),
│   │                dialogs, buttons, inputs
│   ├── hooks/       Theme, standalone mode detection
│   ├── stores/      Zustand stores (chat input, preferences, project order)
│   └── lib/         Formatters, path utils, transcript parsing, storage keys
├── server/          Bun backend
│   ├── cli.ts       CLI entry point & browser launcher
│   ├── server.ts    HTTP/WS server setup & static serving
│   ├── agent.ts     AgentCoordinator (multi-provider turn management)
│   ├── codex-app-server.ts  Codex App Server JSON-RPC client
│   ├── cursor-cli.ts / pi-agent.ts  Cursor and Pi provider adapters
│   ├── provider-catalog.ts  Provider/model/effort normalization
│   ├── quick-response.ts    Structured queries with provider fallback
│   ├── ws-router.ts WebSocket command routing & snapshot subscriptions
│   ├── skills.ts    Skill search/install/uninstall
│   ├── event-store.ts  JSONL persistence, replay & compaction
│   ├── discovery.ts Auto-discover projects from Claude and Codex local state
│   ├── read-models.ts  Derive view models from event state
│   └── events.ts    Event type definitions
└── shared/          Shared between client & server
    ├── types.ts     Core data types, provider catalog, transcript entries
    ├── tools.ts     Tool call normalization and hydration
    ├── protocol.ts  WebSocket message protocol
    ├── ports.ts     Port configuration
    └── branding.ts  App name, data directory paths

scripts/
└── check-libre-policy.ts   Mechanical anti-feature policy enforcement
```

## Data Storage

All state is stored locally at `~/.kanna/data/`:

| File             | Purpose                                   |
| ---------------- | ----------------------------------------- |
| `projects.jsonl` | Project open/remove events                |
| `chats.jsonl`    | Chat create/rename/delete events          |
| `messages.jsonl` | Transcript message entries                |
| `turns.jsonl`    | Agent turn start/finish/cancel events     |
| `snapshot.json`  | Compacted state snapshot for fast startup |

Event logs are append-only JSONL. On startup, the log tail after the last snapshot is replayed, then compacted if the logs exceed 2 MB.

Nothing here is transmitted anywhere.

## Tracking upstream

This fork is maintained as a patch stack on top of upstream, not a merge:

```bash
git remote add upstream https://github.com/jakemor/kanna.git
git config rerere.enabled true
git fetch upstream
git rebase upstream/main
```

`rerere` matters because the same deletions conflict in the same places on every sync. After rebasing, run `bun run check:policy` before anything else: it fails on a verbatim reintroduction. It cannot catch an anti-feature that upstream renames or restructures, so also review the upstream delta by hand. See [docs/libre-policy.md](docs/libre-policy.md) for what to look for.

## Contributing

Contributions are welcome. Changes must not reintroduce anything listed in [docs/libre-policy.md](docs/libre-policy.md); CI enforces the mechanical subset.

## License

[MIT](LICENSE). Upstream Kanna is by [jakemor](https://github.com/jakemor); this fork keeps the same license.
