---
name: release
description: Publish a versioned kanna-duh GitHub Release with structured notes and a prebuilt install tarball. Use when preparing or publishing a stable release, not for ordinary builds.
---

# /release - Publish a GitHub release tarball

## Description
Bump the package version, push the version commit, and dispatch the workflow that creates a GitHub Release with a prebuilt install tarball.

## Instructions

### Step 1: Analyze changes and recommend a version bump

Before prompting the user, do the following:

1. Read the current version from `package.json`.
2. Run `git log $(git describe --tags --abbrev=0)..HEAD --oneline` to see what's changed since the last release.
3. Based on the changes, decide your recommended version bump:
   - **patch** — bug fixes, typos, small tweaks
   - **minor** — new features, non-breaking enhancements
   - **major** — breaking changes, API changes, large rewrites
4. Calculate what the new version number would be for each option (patch, minor, major).

If the user passed an explicit version as an argument (e.g. `/release 0.27.0`), use that version directly — skip the recommendation logic and confirmation.

Otherwise, for **patch** and **minor** bumps, proceed automatically with your best recommendation — do NOT ask for confirmation. Just tell the user what you chose and why in a brief message before bumping.

For **major** bumps only, use the `AskUserQuestion` tool to confirm with the user before proceeding, since major versions indicate breaking changes.

### Step 2: Create and push the version commit

1. Confirm the checkout is on `main` and has no unrelated changes.
2. Edit only the `version` field in `package.json`. Do not create a tag locally.
3. Run `bun install --frozen-lockfile` and `bun run check`.
4. Commit the version change with `chore: bump version to vX.Y.Z`.
5. Push `main` to `origin`.

The release workflow creates the version tag. A local tag would conflict with that workflow.

### Step 3: Build the changelog

Before creating the GitHub release, generate a structured changelog:

1. Read the last 2–3 releases with `gh release view <tag>` to understand existing style.
2. Get the commits in this release: `git log <previous-tag>..HEAD --oneline`.
3. For each commit, check if it's associated with a merged PR:
   - Use `gh pr list --search "<sha>" --state merged --json number,title,author` or the GitHub API.
   - If a PR exists, use its number, title, and author. Prefer linking to the PR.
   - If no PR exists, link to the commit and use the commit author.
4. If multiple commits belong to the same PR, group them into a single entry.
5. Categorize each change into one of the sections below.
6. Write each entry from the **user's perspective** — what changed, not how it was built.

### Changelog detail level

**Keep it short: every entry — feature, improvement, or under the hood — is at most 15 words** (title excluded). One clause, no code examples, no multi-paragraph write-ups, no composition essays.

### Changelog format

Use these sections **in order**, omitting any that have no entries:

1. `## New Features` — New user-facing functionality
2. `## Improvements` — Enhancements, bug fixes, and polish to existing features
3. `## Under the Hood` — Non-user-facing changes (infra, refactors, performance, internal tooling)

Each entry is a bold title, a ≤15-word description, and an author link:

```
**Bold Title** — Description in fifteen words or fewer. [author](PR-or-commit-url)
```

Example:

```markdown
## New Features
**Password Protection (`--password`)** — Lock your instance behind a password with secure, memory-only sessions. [jake](https://github.com/jakemor/kanna/commit/6e83973)

## Improvements
**Sidebar Toggle Fix** — Sidebar visibility no longer glitches when toggling. [jake](https://github.com/jakemor/kanna/commit/187fba5)

## Under the Hood
**Modular ChatPage** — Split ChatPage into smaller components. [jake](https://github.com/jakemor/kanna/commit/def456)
```

If there are no changes at all, use: `No changes this release.`

### Step 4: Dispatch and verify the release

```bash
gh workflow run release.yml \
  --ref main \
  --field tag="v<new-version>" \
  --field notes="<changelog content>"
```

The workflow creates or updates the tag and GitHub Release, then calls `publish.yml`. That workflow builds the client, packs `kanna-duh.tgz`, and uploads the install tarball and export-viewer assets to the release. Nothing is published to npm.

Monitor the release workflow and verify the release contains `kanna-duh.tgz` before reporting success. Tell the user the new version number, release URL, and install command:

```bash
bun install --global https://github.com/brege/kanna-duh/releases/latest/download/kanna-duh.tgz
```
