# Downstream anti-feature policy

This fork removes upstream Kanna's anti-features and keeps them out. The rules below are what the fork guarantees; `scripts/check-libre-policy.ts` enforces the mechanically checkable ones, and `bun run check:policy` runs it.

## Rules

1. No unsolicited analytics or telemetry.
2. No persistent analytics installation or user identifiers.
3. No requests to Kanna-operated services.
4. No Kanna Cloud signup, pairing, heartbeat, or tunnel functionality.
5. No advertising or product links, including inside exported artifacts.
6. No commit or pull-request attribution.
7. No `Kanna-Agent` metadata.
8. No branding injected into agent, system, or developer prompts.
9. No new remote network destination without an explicit allowlist change.
10. No self-update that installs remote code without the user asking for it.

Rule 5 covers shipped artifacts, not just the running UI: a transcript export is handed to third parties, so promotional content there reaches people who never installed anything.

Rule 9 is the one that does the most work on an upstream merge. The allowlist lives in `scripts/check-libre-policy.ts`; adding a host is a deliberate edit that shows up in review rather than a silent new destination.

## What was removed

| Anti-feature | Removed |
| --- | --- |
| Analytics reporting to `kanna.sh/api/t` | `src/shared/analytics.ts`, `src/server/analytics.ts`, every emit site |
| Persistent `anon_<uuid>` analytics id | `analyticsUserId` in `app-settings.ts` and the settings file |
| Commit footer, `Co-Authored-By`, `Kanna-Agent` trailer, PR advertisement | `src/server/attribution.ts` and every provider injection point |
| Kanna Cloud (pairing, heartbeat, tunnel, control plane, dev-box UI) | `src/server/cloud/`, `src/shared/cloud-api.ts`, `src/client/components/cloud/`, related client files |
| Marketing banner in exported transcripts | `src/export-viewer/main.tsx` |
| Transcript upload to `kanna.sh/api/share` | `src/server/standalone-export.ts`; export is local-only |
| Silent self-update on startup | `maybeSelfUpdate` in `src/server/cli-runtime.ts` |
| Nightly channel building from the upstream repo | `src/server/nightly.ts` |

Attribution had no opt-out and analytics defaulted to on, so removal is the only way to reach the stated guarantee.

## Fork identity

The release URL, archive name, and package metadata use the identifiers below. Each identifier must name this fork:

| Identifier | Location | Value |
| --- | --- | --- |
| `PACKAGE_NAME` | `src/shared/branding.ts` | `kanna-duh` |
| `GITHUB_REPOSITORY` | `src/shared/branding.ts` | `brege/kanna-duh` |
| `RELEASE_ASSET_NAME` | `src/shared/branding.ts` | `kanna-duh.tgz` |
| `repository.url` | `package.json` | `github.com/brege/kanna-duh` |

The Settings update action reads `GITHUB_REPOSITORY` and installs `RELEASE_ASSET_NAME` from that repository's exact version tag. Repointing either identifier can replace this fork with another distribution and restore removed anti-features. Treat both as policy-sensitive lines.

Release checks use the public GitHub API and carry no installation or user identifier. Installation happens only after the user selects Update.

The global command is still `kanna`, which collides with an installed upstream `kanna-code`. Remove that package before installing this one.

## Maintaining the fork

Track upstream as a patch stack rather than a merge:

```bash
git remote add upstream https://github.com/jakemor/kanna.git
git config rerere.enabled true
git fetch upstream
git rebase upstream/main
```

`rerere` matters because the same deletions conflict in the same places on every sync.

The mechanical check is the first of two layers. It catches verbatim reintroduction. It cannot catch an anti-feature that upstream renames, restructures, or moves, so review the upstream delta semantically as well:

```bash
git diff <last-accepted-upstream>..<new-upstream>
```

Look for a new outbound destination, a persistent identifier, telemetry or crash reporting, product promotion, cloud or pairing behavior, commit or PR mutation, prompt injection, and any new dependency that could implement one of those. Compare `package.json` and `bun.lock` on every sync.
