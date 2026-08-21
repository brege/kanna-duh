import { describe, expect, test } from "bun:test"
import {
  PROVIDERS,
  deriveClaudeModelLabel,
  deriveModelLabel,
  getClaudeReasoningOptions,
  getCodexReasoningOptions,
  resolveModelLabel,
  normalizeClaudeModelId,
  normalizeClaudeReasoningEffort,
  normalizeCodexModelId,
  normalizeCursorModelId,
  normalizeCodexReasoningEffort,
  isCodexReasoningEffort,
} from "./types"

describe("shared model normalization", () => {
  test("uses the full Claude Code harness label", () => {
    expect(PROVIDERS.find((provider) => provider.id === "claude")?.label).toBe("Claude Code")
  })

  test("derives fallback Claude model labels from model ids", () => {
    expect(deriveClaudeModelLabel("fable")).toBe("Fable")
    expect(deriveClaudeModelLabel("claude-opus-4-8")).toBe("Opus")
    expect(deriveClaudeModelLabel("claude-haiku-4-5-20251001")).toBe("Haiku")
  })

  test("normalizes Claude aliases via the provider catalog", () => {
    expect(normalizeClaudeModelId("fable")).toBe("claude-fable-5")
    expect(normalizeClaudeModelId("opus")).toBe("claude-opus-5")
    expect(normalizeClaudeModelId("sonnet")).toBe("claude-sonnet-5")
    expect(normalizeClaudeModelId("haiku")).toBe("claude-haiku-4-5-20251001")
  })

  test("preserves exact Claude ids and removes context markers from stored selections", () => {
    expect(normalizeClaudeModelId("claude-opus-4-8")).toBe("claude-opus-4-8")
    expect(normalizeClaudeModelId("claude-opus-4-8[1m]")).toBe("claude-opus-4-8")
    expect(normalizeClaudeModelId("claude-sonnet-4-6")).toBe("claude-sonnet-4-6")
    expect(normalizeClaudeModelId("claude-haiku-4-5-20251001")).toBe("claude-haiku-4-5-20251001")
    expect(normalizeClaudeModelId("claude-fable-5")).toBe("claude-fable-5")
    expect(normalizeClaudeModelId("claude-mystery-9")).toBe("claude-mystery-9")
    expect(normalizeClaudeModelId("")).toBe("claude-opus-5")
    expect(normalizeClaudeModelId(undefined)).toBe("claude-opus-5")
  })

  test("passes Cursor model ids through and folds -fast back into the base id", () => {
    // The real Cursor list is runtime-discovered (cursor-agent --list-models),
    // so unknown ids are preserved rather than clamped to the static catalog.
    expect(normalizeCursorModelId()).toBe("composer-2.5")
    expect(normalizeCursorModelId("  ")).toBe("composer-2.5")
    expect(normalizeCursorModelId("composer-2.5-fast")).toBe("composer-2.5")
    expect(normalizeCursorModelId("gpt-5.3-codex-high")).toBe("gpt-5.3-codex-high")
    expect(normalizeCursorModelId("gpt-5.3-codex-high-fast")).toBe("gpt-5.3-codex-high")
  })

  test("normalizes legacy Codex aliases and defaults to the latest catalog model", () => {
    expect(normalizeCodexModelId()).toBe("gpt-5.6-sol")
    expect(normalizeCodexModelId("gpt-5.6")).toBe("gpt-5.6-sol")
    expect(normalizeCodexModelId("gpt-5.6-terra")).toBe("gpt-5.6-terra")
    expect(normalizeCodexModelId("gpt-5.6-luna")).toBe("gpt-5.6-luna")
    expect(normalizeCodexModelId("gpt-5-codex")).toBe("gpt-5.3-codex")
    expect(normalizeCodexModelId("not-a-real-model")).toBe("gpt-5.6-sol")
  })

  test("exposes model-specific GPT-5.6 reasoning efforts", () => {
    expect(getCodexReasoningOptions("gpt-5.6-sol").map((option) => option.id)).toEqual([
      "low", "medium", "high", "xhigh", "max", "ultra",
    ])
    expect(getCodexReasoningOptions("gpt-5.6-terra").map((option) => option.id)).toEqual([
      "low", "medium", "high", "xhigh", "max", "ultra",
    ])
    expect(getCodexReasoningOptions("gpt-5.6-luna").map((option) => option.id)).toEqual([
      "low", "medium", "high", "xhigh", "max",
    ])
  })

  test("preserves all 17 supported GPT-5.6 model and reasoning combinations", () => {
    const combinations = [
      ["gpt-5.6-sol", ["low", "medium", "high", "xhigh", "max", "ultra"]],
      ["gpt-5.6-terra", ["low", "medium", "high", "xhigh", "max", "ultra"]],
      ["gpt-5.6-luna", ["low", "medium", "high", "xhigh", "max"]],
    ] as const

    expect(combinations.reduce((count, [, efforts]) => count + efforts.length, 0)).toBe(17)
    for (const [model, efforts] of combinations) {
      for (const effort of efforts) {
        expect(normalizeCodexReasoningEffort(model, effort)).toBe(effort)
      }
    }
  })

  test("normalizes unsupported GPT-5.6 reasoning efforts", () => {
    expect(normalizeCodexReasoningEffort("gpt-5.6-sol", "minimal")).toBe("low")
    expect(normalizeCodexReasoningEffort("gpt-5.6-luna", "ultra")).toBe("max")
    expect(normalizeCodexReasoningEffort("gpt-5.6-terra", "ultra")).toBe("ultra")
    expect(normalizeCodexReasoningEffort("gpt-5.6-sol", "unknown")).toBe("medium")
  })

  test("recognizes public and legacy Codex reasoning values", () => {
    expect(isCodexReasoningEffort("max")).toBe(true)
    expect(isCodexReasoningEffort("ultra")).toBe(true)
    expect(isCodexReasoningEffort("minimal")).toBe(true)
    expect(getCodexReasoningOptions("gpt-5.6-sol").find((option) => option.id === "xhigh")?.label).toBe("Extra High")
    expect(getCodexReasoningOptions("gpt-5.6-sol").find((option) => option.id === "ultra")?.description).toBe("Delegates to subagents more")
  })

  test("uses exact Claude effort metadata", () => {
    expect(getClaudeReasoningOptions("fable").map((option) => option.id)).toEqual([
      "low", "medium", "high", "xhigh", "max",
    ])
    expect(getClaudeReasoningOptions("claude-opus-4-8").map((option) => option.id)).toEqual([
      "low", "medium", "high", "xhigh", "max",
    ])
    expect(getClaudeReasoningOptions("claude-opus-4-6").map((option) => option.id)).toEqual([
      "low", "medium", "high", "max",
    ])
    expect(getClaudeReasoningOptions("claude-opus-4-5-20251101")).toEqual([])
    expect(normalizeClaudeReasoningEffort("claude-opus-4-6", "xhigh")).toBe("high")
    expect(normalizeClaudeReasoningEffort("claude-opus-4-6", "max")).toBe("max")
  })

  test("derives display labels from bare model ids", () => {
    expect(deriveModelLabel("lab/kimi-k2.5:nitro")).toBe("Kimi K2.5")
    expect(deriveModelLabel("gpt-5.6-sol")).toBe("GPT 5.6 Sol")
    expect(deriveModelLabel("openai/gpt-5.6")).toBe("GPT 5.6")
    expect(deriveModelLabel("anthropic/claude-sonnet-5")).toBe("Sonnet 5")
    expect(deriveModelLabel("claude-fable-5")).toBe("Fable 5")
    expect(deriveModelLabel("deepseek/deepseek-v4-pro")).toBe("Deepseek V4 Pro")
    expect(deriveModelLabel("z-ai/glm-5.2")).toBe("GLM 5.2")
    // A dashed "4-8" reads as a dotted version, with or without a "[1m]" marker.
    expect(deriveModelLabel("claude-opus-4-8[1m]")).toBe("Opus 4.8")
    expect(deriveModelLabel("claude-opus-4-8")).toBe("Opus 4.8")
    // A trailing build/date stamp is dropped rather than joined into the version.
    expect(deriveModelLabel("claude-haiku-4-5-20251001")).toBe("Haiku 4.5")
  })

  test("resolves model labels via catalog id, alias, or derived fallback", () => {
    const claudeModels = PROVIDERS.find((provider) => provider.id === "claude")?.models
    expect(resolveModelLabel(claudeModels, "opus")).toBe("Opus 5")
    expect(resolveModelLabel(claudeModels, "claude-opus-4-8")).toBe("Opus 4.8")
    expect(resolveModelLabel(claudeModels, "claude-opus-4-8[1m]")).toBe("Opus 4.8")
    expect(resolveModelLabel(claudeModels, "some-new-model")).toBe("Some New Model")
    expect(resolveModelLabel(undefined, "gpt-5.6-sol")).toBe("GPT 5.6 Sol")
  })
})
