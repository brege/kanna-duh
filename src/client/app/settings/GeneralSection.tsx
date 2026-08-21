import { useEffect, useState } from "react"
import { Monitor, Moon, Sun } from "lucide-react"
import type { EditorPreset } from "../../../shared/protocol"
import { DEFAULT_NEW_PROJECTS_DIRECTORY } from "../../../shared/types"
import { EDITOR_OPTIONS, EditorIcon } from "../../components/editor-icons"
import { Input } from "../../components/ui/input"
import { SegmentedControl } from "../../components/ui/segmented-control"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select"
import { useTheme, type ThemePreference } from "../../hooks/useTheme"
import { playChatNotificationSound } from "../../lib/chatSounds"
import {
  DEFAULT_TERMINAL_MIN_COLUMN_WIDTH,
  DEFAULT_TERMINAL_SCROLLBACK,
  MAX_TERMINAL_MIN_COLUMN_WIDTH,
  MAX_TERMINAL_SCROLLBACK,
  MIN_TERMINAL_MIN_COLUMN_WIDTH,
  MIN_TERMINAL_SCROLLBACK,
  getDefaultEditorCommandTemplate,
  useTerminalPreferencesStore,
} from "../../stores/terminalPreferencesStore"
import { CHAT_SOUND_OPTIONS, useChatSoundPreferencesStore, type ChatSoundId, type ChatSoundPreference } from "../../stores/chatSoundPreferencesStore"
import type { KannaState } from "../useKannaState"
import {
  handleSettingsInputKeyDown,
  SettingsErrorBanner,
  SettingsRow,
  shouldPreviewChatSoundChange,
} from "./shared"
import { SETTINGS_ROWS } from "./registry"

const themeOptions = [
  { value: "light" as ThemePreference, label: "Light", icon: Sun },
  { value: "dark" as ThemePreference, label: "Dark", icon: Moon },
  { value: "system" as ThemePreference, label: "System", icon: Monitor },
]

const chatSoundPreferenceOptions: { value: ChatSoundPreference; label: string }[] = [
  { value: "never", label: "Never" },
  { value: "unfocused", label: "When Unfocused" },
  { value: "always", label: "Always" },
]

export function GeneralSection({
  state,
  appVersion,
}: {
  state: Pick<KannaState, "updateSnapshot" | "appSettings" | "handleWriteAppSettings">
  appVersion: string
}) {
  const { theme, setTheme } = useTheme()
  const appSettings = state.appSettings
  const updateSnapshot = state.updateSnapshot
  const handleWriteAppSettings = state.handleWriteAppSettings

  const scrollbackLines = useTerminalPreferencesStore((store) => store.scrollbackLines)
  const minColumnWidth = useTerminalPreferencesStore((store) => store.minColumnWidth)
  const editorPreset = useTerminalPreferencesStore((store) => store.editorPreset)
  const editorCommandTemplate = useTerminalPreferencesStore((store) => store.editorCommandTemplate)
  const setScrollbackLines = useTerminalPreferencesStore((store) => store.setScrollbackLines)
  const setMinColumnWidth = useTerminalPreferencesStore((store) => store.setMinColumnWidth)
  const setEditorPreset = useTerminalPreferencesStore((store) => store.setEditorPreset)
  const setEditorCommandTemplate = useTerminalPreferencesStore((store) => store.setEditorCommandTemplate)
  const chatSoundPreference = useChatSoundPreferencesStore((store) => store.chatSoundPreference)
  const chatSoundId = useChatSoundPreferencesStore((store) => store.chatSoundId)
  const setChatSoundPreference = useChatSoundPreferencesStore((store) => store.setChatSoundPreference)
  const setChatSoundId = useChatSoundPreferencesStore((store) => store.setChatSoundId)

  const [scrollbackDraft, setScrollbackDraft] = useState(String(scrollbackLines))
  const [minColumnWidthDraft, setMinColumnWidthDraft] = useState(String(minColumnWidth))
  const [editorCommandDraft, setEditorCommandDraft] = useState(editorCommandTemplate)
  const newProjectsDirectory = appSettings?.newProjectsDirectory ?? DEFAULT_NEW_PROJECTS_DIRECTORY
  const [newProjectsDirectoryDraft, setNewProjectsDirectoryDraft] = useState(newProjectsDirectory)
  const [appSettingsError, setAppSettingsError] = useState<string | null>(null)

  const updateStatusLabel = updateSnapshot?.status === "checking"
    ? "Checking for updates…"
    : updateSnapshot?.status === "updating"
      ? "Installing update…"
      : updateSnapshot?.status === "restart_pending"
        ? "Restarting kanna-duh…"
        : updateSnapshot?.status === "available"
          ? `Update available${updateSnapshot.latestVersion ? `: ${updateSnapshot.latestVersion}` : ""}`
          : updateSnapshot?.status === "up_to_date"
            ? "Up to date"
            : updateSnapshot?.status === "error"
              ? "Update check failed"
              : "Not checked yet"

  useEffect(() => {
    setScrollbackDraft(String(scrollbackLines))
  }, [scrollbackLines])

  useEffect(() => {
    setMinColumnWidthDraft(String(minColumnWidth))
  }, [minColumnWidth])

  useEffect(() => {
    setEditorCommandDraft(editorCommandTemplate)
  }, [editorCommandTemplate])

  useEffect(() => {
    setNewProjectsDirectoryDraft(newProjectsDirectory)
  }, [newProjectsDirectory])

  function commitScrollback() {
    const nextValue = Number(scrollbackDraft)
    if (!Number.isFinite(nextValue)) {
      setScrollbackDraft(String(scrollbackLines))
      return
    }
    setScrollbackLines(nextValue)
    void handleWriteAppSettings({ terminal: { scrollbackLines: nextValue } }).catch((error) => {
      setAppSettingsError(error instanceof Error ? error.message : "Unable to save terminal settings.")
    })
  }

  function commitMinColumnWidth() {
    const nextValue = Number(minColumnWidthDraft)
    if (!Number.isFinite(nextValue)) {
      setMinColumnWidthDraft(String(minColumnWidth))
      return
    }
    setMinColumnWidth(nextValue)
    void handleWriteAppSettings({ terminal: { minColumnWidth: nextValue } }).catch((error) => {
      setAppSettingsError(error instanceof Error ? error.message : "Unable to save terminal settings.")
    })
  }

  function commitEditorCommand() {
    setEditorCommandTemplate(editorCommandDraft)
    void handleWriteAppSettings({ editor: { commandTemplate: editorCommandDraft } }).catch((error) => {
      setAppSettingsError(error instanceof Error ? error.message : "Unable to save editor settings.")
    })
  }

  function commitNewProjectsDirectory() {
    const trimmed = newProjectsDirectoryDraft.trim()
    if (trimmed === newProjectsDirectory) {
      setNewProjectsDirectoryDraft(newProjectsDirectory)
      return
    }
    // The server normalizes an empty value back to the default; the snapshot
    // round-trips into the draft via the effect above.
    void handleWriteAppSettings({ newProjectsDirectory: trimmed || DEFAULT_NEW_PROJECTS_DIRECTORY }).catch((error) => {
      setAppSettingsError(error instanceof Error ? error.message : "Unable to save the new projects directory.")
    })
  }

  function handleThemeChange(nextTheme: typeof theme) {
    setTheme(nextTheme)
    void handleWriteAppSettings({ theme: nextTheme }).catch((error) => {
      setAppSettingsError(error instanceof Error ? error.message : "Unable to save theme settings.")
    })
  }

  function handleEditorPresetChange(nextPreset: EditorPreset) {
    setEditorPreset(nextPreset)
    const commandTemplate = nextPreset === "custom" ? editorCommandTemplate : getDefaultEditorCommandTemplate(nextPreset)
    void handleWriteAppSettings({
      editor: {
        preset: nextPreset,
        commandTemplate,
      },
    }).catch((error) => {
      setAppSettingsError(error instanceof Error ? error.message : "Unable to save editor settings.")
    })
  }

  function handleChatSoundPreferenceChange(nextValue: ChatSoundPreference) {
    if (!shouldPreviewChatSoundChange(chatSoundPreference, nextValue)) {
      return
    }

    setChatSoundPreference(nextValue)
    void handleWriteAppSettings({ chatSoundPreference: nextValue }).catch((error) => {
      setAppSettingsError(error instanceof Error ? error.message : "Unable to save chat sound settings.")
    })
    void playChatNotificationSound(chatSoundId, 1).catch(() => undefined)
  }

  function handleChatSoundIdChange(nextValue: ChatSoundId) {
    if (!shouldPreviewChatSoundChange(chatSoundId, nextValue)) {
      return
    }

    setChatSoundId(nextValue)
    void handleWriteAppSettings({ chatSoundId: nextValue }).catch((error) => {
      setAppSettingsError(error instanceof Error ? error.message : "Unable to save chat sound settings.")
    })
    void playChatNotificationSound(nextValue, 1).catch(() => undefined)
  }

  const customEditorPreview = editorCommandDraft
    .replaceAll("{path}", "/Users/jake/Projects/kanna/src/client/app/App.tsx")
    .replaceAll("{line}", "12")
    .replaceAll("{column}", "1")

  return (
    <>
      {appSettingsError ? <SettingsErrorBanner message={appSettingsError} /> : null}
      <div className="border-b border-border">
        <SettingsRow
          def={SETTINGS_ROWS.applicationUpdate}
          description={(
            <>
              <span>{updateStatusLabel}.</span>
              {updateSnapshot?.lastCheckedAt ? (
                <span> Last checked {new Intl.DateTimeFormat(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                }).format(updateSnapshot.lastCheckedAt)}.</span>
              ) : null}
              {updateSnapshot?.error ? (
                <span> {updateSnapshot.error}</span>
              ) : null}
            </>
          )}
          bordered={false}
        >
          <div className="text-right text-sm text-foreground">
            <div>Current: {updateSnapshot?.currentVersion ?? appVersion}</div>
            <div className="text-xs text-muted-foreground">
              Latest: {updateSnapshot?.latestVersion ?? "Unknown"}
            </div>
          </div>
        </SettingsRow>

        <SettingsRow def={SETTINGS_ROWS.theme}>
          <SegmentedControl
            value={theme}
            onValueChange={handleThemeChange}
            options={themeOptions}
            size="sm"
          />
        </SettingsRow>

        <SettingsRow def={SETTINGS_ROWS.chatSounds}>
          <Select
            value={chatSoundPreference}
            onValueChange={(value) => handleChatSoundPreferenceChange(value as ChatSoundPreference)}
          >
            <SelectTrigger className="min-w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {chatSoundPreferenceOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </SettingsRow>

        <SettingsRow def={SETTINGS_ROWS.chatSound}>
          <Select
            value={chatSoundId}
            onValueChange={(value) => handleChatSoundIdChange(value as ChatSoundId)}
          >
            <SelectTrigger className="min-w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {CHAT_SOUND_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </SettingsRow>

        <SettingsRow def={SETTINGS_ROWS.defaultEditor} alignStart>
          <Select
            value={editorPreset}
            onValueChange={(value) => handleEditorPresetChange(value as EditorPreset)}
          >
            <SelectTrigger className="min-w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {EDITOR_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <span className="flex items-center gap-2">
                      <EditorIcon preset={option.value} className="h-4 w-4 shrink-0" />
                      <span>{option.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </SettingsRow>

        {editorPreset === "custom" ? (
          <div className="border-t border-border">
            <div className="flex justify-between gap-8 py-5 pl-6">
              <div className="min-w-0 max-w-xl">
                <div className="text-sm font-medium text-foreground">Command Template</div>
                <div className="mt-1 text-[13px] text-muted-foreground">
                  Include {"{path}"} and optionally {"{line}"} and {"{column}"} in your command.
                </div>
              </div>
              <div className="flex min-w-0 max-w-[420px] flex-1 flex-col items-stretch gap-2">
                <Input
                  type="text"
                  value={editorCommandDraft}
                  onChange={(event) => setEditorCommandDraft(event.target.value)}
                  onBlur={commitEditorCommand}
                  onKeyDown={(event) => handleSettingsInputKeyDown(event, commitEditorCommand)}
                  className="font-mono"
                />
                <div className="text-xs text-muted-foreground">
                  Preview: <span className="font-mono">{customEditorPreview}</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <SettingsRow def={SETTINGS_ROWS.newProjectsDirectory}>
          <div className="flex w-full min-w-0 flex-col items-stretch gap-2 md:w-auto md:items-end">
            <Input
              type="text"
              value={newProjectsDirectoryDraft}
              onChange={(event) => setNewProjectsDirectoryDraft(event.target.value)}
              onBlur={commitNewProjectsDirectory}
              onKeyDown={(event) => handleSettingsInputKeyDown(event, commitNewProjectsDirectory)}
              spellCheck={false}
              autoComplete="off"
              className="w-full font-mono md:w-64"
            />
            <div className="text-left text-xs text-muted-foreground md:text-right">
              Created on first use{newProjectsDirectory === DEFAULT_NEW_PROJECTS_DIRECTORY ? " (default)" : ""}
            </div>
          </div>
        </SettingsRow>

        <SettingsRow def={SETTINGS_ROWS.terminalScrollback}>
          <div className="flex w-full min-w-0 flex-col items-stretch gap-2 md:w-auto md:items-end">
            <Input
              type="number"
              min={MIN_TERMINAL_SCROLLBACK}
              max={MAX_TERMINAL_SCROLLBACK}
              step={100}
              value={scrollbackDraft}
              onChange={(event) => setScrollbackDraft(event.target.value)}
              onBlur={commitScrollback}
              onKeyDown={(event) => handleSettingsInputKeyDown(event, commitScrollback)}
              className="hide-number-steppers w-full text-left font-mono md:w-28 md:text-right"
            />
            <div className="text-left text-xs text-muted-foreground md:text-right">
              {MIN_TERMINAL_SCROLLBACK}-{MAX_TERMINAL_SCROLLBACK} lines
              {scrollbackLines === DEFAULT_TERMINAL_SCROLLBACK ? " (default)" : ""}
            </div>
          </div>
        </SettingsRow>

        <SettingsRow def={SETTINGS_ROWS.terminalMinColumnWidth}>
          <div className="flex w-full min-w-0 flex-col items-stretch gap-2 md:w-auto md:items-end">
            <Input
              type="number"
              min={MIN_TERMINAL_MIN_COLUMN_WIDTH}
              max={MAX_TERMINAL_MIN_COLUMN_WIDTH}
              step={10}
              value={minColumnWidthDraft}
              onChange={(event) => setMinColumnWidthDraft(event.target.value)}
              onBlur={commitMinColumnWidth}
              onKeyDown={(event) => handleSettingsInputKeyDown(event, commitMinColumnWidth)}
              className="hide-number-steppers w-full text-left font-mono md:w-28 md:text-right"
            />
            <div className="text-left text-xs text-muted-foreground md:text-right">
              {MIN_TERMINAL_MIN_COLUMN_WIDTH}-{MAX_TERMINAL_MIN_COLUMN_WIDTH} px
              {minColumnWidth === DEFAULT_TERMINAL_MIN_COLUMN_WIDTH ? " (default)" : ""}
            </div>
          </div>
        </SettingsRow>

      </div>
    </>
  )
}
