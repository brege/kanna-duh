# Claude Model Refresh Policy

## Source precedence

Use each source only for the fact it establishes.

1. `supportedModels()` establishes the current account's advertised rows, resolved ids, effort metadata, and feature flags.
2. The installed Agent SDK type declarations establish the metadata contract Kanna can consume.
3. Current Claude Code model configuration and changelog documentation establish global model capabilities and release changes.
4. Explicit CLI acceptance establishes that a full model id remains callable even when the picker omits it.
5. Kanna's static catalog preserves verified compatibility entries needed before discovery and for explicit older selections.

The npm registry establishes the latest package version. It does not establish model availability or account entitlement.

## Absence and removal

Do not remove a static model solely because `supportedModels()` omits it. Discovery is account-specific and may reflect plan, organization, provider, region, rollout, or restriction differences.

Remove a compatibility entry only when current Claude Code rejects the exact id or authoritative documentation identifies it as retired. Record that evidence in the handoff.

## Model identity

- Store exact ids such as `claude-opus-4-8` as canonical model values.
- Keep aliases such as `opus` and `sonnet` as migration and input aliases.
- Remove a trailing `[1m]` marker before storing the base model id.
- Represent selectable context as model options and append `[1m]` only at request resolution.
- Keep native fixed windows, such as Fable 5 and Sonnet 5 on the Anthropic API, as fixed token metadata with no redundant selector.
- Preserve unknown `claude-*` ids for Claude Code to validate at the provider boundary.

## Effort metadata

Prefer a live row's `supportedEffortLevels` when present. Use current documentation for compatibility entries absent from discovery.

The ordering is:

```text
low, medium, high, xhigh, max
```

When a saved effort is unsupported by the selected model, clamp downward to the nearest supported level. Use the documented default when no lower level applies. Hide the reasoning control when a model supports no effort levels.

Treat `ultracode` separately from model effort. It combines `xhigh` with workflow orchestration and requires distinct session state and SDK flag handling.

## Context metadata

Distinguish these states:

- fixed native context window with no selector
- selectable 200K and 1M variants
- standard context with no extended option
- account-specific availability not established by static documentation

Do not infer entitlement from model capability. A model can support 1M while the current account cannot select it.

## Fast mode

Use the current SDK row when it reports `supportsFastMode`. For compatibility entries missing from live discovery, verify support in current Claude Code documentation or changelog before enabling the toggle.

## Dependency updates

- Compare the standalone CLI, embedded `claudeCodeVersion`, and current SDK release.
- Change only the Claude Agent SDK requirement unless another dependency is required by its declared contract.
- Regenerate `bun.lock` with Bun.
- Inspect the lockfile to confirm that only the SDK and platform packages changed.

## Required verification

Cover these invariants:

- exact model labels include generation numbers
- aliases normalize to exact current ids
- version-specific ids survive normalization
- Fable and current Opus releases expose `xhigh` and `max`
- Opus 4.6 exposes `max` without `xhigh`
- unsupported efforts are omitted rather than disabled globally
- fixed and selectable context windows render differently
- startup discovery reaches new chats and Settings
- repeated SDK metadata application is idempotent
- account discovery does not delete static compatibility entries

Run `bun run check` after the narrow suites. Run the repository-wide tests with an isolated Git config and report unrelated environment failures separately.

## Authoritative references

- Claude Code model configuration: <https://code.claude.com/docs/en/model-config>
- Claude Code changelog: <https://code.claude.com/docs/en/changelog>
- Claude Agent SDK TypeScript reference: <https://code.claude.com/docs/en/agent-sdk/typescript>
