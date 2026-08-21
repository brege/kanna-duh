---
name: refresh-claude-models
description: Refresh Kanna's Claude Agent SDK and model catalog when Claude Code releases change model ids, effort levels, context windows, fast mode, or supportedModels metadata. Use for periodic picker-freshness audits and Claude CLI parity, not ordinary model selection.
---

# Refresh Claude Models

Keep Kanna's embedded Claude runtime, static compatibility catalog, live account metadata, and picker controls aligned with current Claude Code behavior.

Read [references/model-policy.md](references/model-policy.md) before changing model entries or capability metadata.

## Inspect

1. Inspect the worktree without changing Git state. Preserve concurrent and unrelated changes.
2. Record the standalone CLI version with `claude --version`.
3. Read `package.json`, `bun.lock`, and the installed `@anthropic-ai/claude-agent-sdk/package.json`. Record both the SDK version and `claudeCodeVersion`.
4. Query the current registry release with `npm view @anthropic-ai/claude-agent-sdk version claudeCodeVersion --json`.
5. Locate the coding-agent reference root with `agent-db --reference-root`. Read the Claude index, `model-config.md`, and relevant current changelog entries. Refresh the reference database or fetch the upstream page when the snapshot is stale.
6. Run `bun .agents/skills/refresh-claude-models/scripts/probe-models.ts` from the repository root. The probe initializes the embedded SDK without sending a model prompt.

## Compare

Compare four distinct facts instead of treating them as one list:

- models advertised to the current account by `supportedModels()`
- exact model ids that current Claude Code accepts explicitly
- capabilities reported per live SDK row
- compatibility entries retained for older selectable releases

Inspect `src/shared/types.ts`, `src/server/provider-catalog.ts`, `src/server/agent.ts`, `src/shared/provider-preferences.ts`, and `src/client/lib/composer.ts`. Identify stale dependency versions, lost SDK fields, family collapsing, missing global propagation, and incorrect preference migration.

## Update

1. Update only `@anthropic-ai/claude-agent-sdk` and its lockfile entries when the embedded release is behind.
2. Preserve exact model ids. Keep family names as aliases rather than canonical stored ids.
3. Derive effort controls per model from `supportedEffortLevels` and verified documentation.
4. Represent fixed native context windows separately from selectable context variants.
5. Expose fast mode only for models supported by current Claude Code.
6. Merge live discovery into the static compatibility catalog without deleting a model merely because the current account omits it.
7. Propagate refreshed provider metadata to active chats, new chats, and Settings.
8. Normalize legacy aliases and context markers without collapsing valid version-specific selections.
9. Add or update catalog, preference migration, composer, rendering, and global snapshot tests.

Do not add telemetry, attribution, hosted-service dependencies, or updater behavior. Do not stage, commit, push, or otherwise mutate Git state.

## Verify

Run the narrow suites first:

```bash
bun test src/shared/types.test.ts src/server/provider-catalog.test.ts src/server/read-models.test.ts src/server/app-settings.test.ts src/client/lib/composer.test.ts src/client/stores/chatPreferencesStore.test.ts src/client/components/chat-ui/ChatPreferenceControls.test.tsx
```

Then run:

```bash
bun run check
GIT_CONFIG_GLOBAL=/tmp/gitconfig-clean bun test
```

Distinguish regressions from reproducible environment failures. Report the before and after versions, live probe results, retained compatibility models, capability changes, verification results, and unresolved uncertainty.
