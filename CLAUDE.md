# kanna-duh — development notes

kanna-duh is a local web UI for coding agents (Claude Code, Codex, Cursor, Pi).
Bun server + React 19 client, talking over one WebSocket. It is the libre fork
of Kanna: analytics, attribution, cloud, promotion, and silent self-update are
removed, and `docs/libre-policy.md` is binding on every change here.

## Commands

- `bun run dev` — client (Vite) + server together (`--port N` sets the client
  port; the backend runs on N+1)
- `bun test` — unit/integration suite (Bun test)
- `bun run check` — typecheck + anti-feature policy + both production builds
- `bun run check:policy` — anti-feature policy check on its own
- `bun run build` — client + export-viewer bundles

## How it fits together

```
React client (src/client)
  socket.ts ── one WebSocket ──► WSRouter (src/server/ws-router.ts)
                                   ├─ commands: switch on ClientCommand (shared/protocol.ts)
                                   ├─ snapshots: per-topic push with dedupe signatures
                                   ├─ AgentCoordinator (agent.ts) ── provider adapters:
                                   │    Claude Agent SDK (in agent.ts) · codex-app-server.ts
                                   │    cursor-cli.ts · pi-agent.ts
                                   └─ EventStore (event-store.ts): JSONL logs + snapshot
                                      compaction + per-chat transcripts (~/.kanna/data)
```

- **Everything the client renders comes from server snapshots** pushed per
  subscription topic (`sidebar`, `chat`, `project-git`, `local-projects`,
  `update`, `keybindings`, `app-settings`, `terminal`). The client sends
  commands; it never mutates server state locally except optimistic user
  prompts (reconciled by content signature).
- Snapshot pushes dedupe by signature: sidebar/chat use the serialized
  snapshot itself (built once per broadcast and shared across sockets),
  project-git uses a version counter. Keep that property when adding topics.
- Provider adapters normalize three different wire protocols into
  `HarnessEvent`s (`harness-types.ts`). Claude runs through the Agent SDK in
  `agent.ts` directly; codex/cursor/pi produce `HarnessTurn`s.
- Transcripts are append-only JSONL per chat (`transcripts/<chatId>.jsonl`)
  with a small LRU cache in the EventStore. `debugRaw` (raw provider JSON) is
  stamped only on `system_init` and Claude `tool_result` entries — the only
  places the client reads it.

## Conventions

- `src/shared/` is imported by both sides — no Bun/node imports there.
- New WS commands: add to `shared/protocol.ts`, handle in `ws-router.ts`,
  and prefer targeted `broadcastFilteredSnapshots({...})` over full
  broadcasts (name exactly the topics the command can change).
- Tests live next to their module (`foo.ts` / `foo.test.ts`) and run in Bun.
  The `.e2e.ts` suffix keeps a file out of `bun test`'s default sweep; no file
  currently uses it.
- When tests need git, they create throwaway repos, so a global git config
  with `commit.gpgsign`, `merge.ff`, or URL rewrites will leak in and fail
  them. Point `GIT_CONFIG_GLOBAL` at an empty file when running the suite.

## Anti-feature policy

`docs/libre-policy.md` is the fork's reason to exist, and `bun run check:policy`
enforces the mechanical part. Before adding anything that talks to the network,
persists an identifier, writes to a commit or PR, or appends to a provider
prompt, read it.

- `GITHUB_REPOSITORY` and `RELEASE_ASSET_NAME` in `src/shared/branding.ts`
  define the Settings update source. Repointing either can install another
  distribution over this fork and restore removed anti-features.
- New outbound hosts need an explicit entry in the allowlist inside
  `scripts/check-libre-policy.ts`. That edit is meant to be visible in review.
- On an upstream rebase, run `bun run check:policy` first. It catches verbatim
  reintroduction only; an anti-feature that upstream renames or restructures
  needs a hand review of the delta.
