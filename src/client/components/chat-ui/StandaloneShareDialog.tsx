import { CopyButton } from "../ui/copy-button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPrimaryButton,
  DialogTitle,
} from "../ui/dialog"

interface Props {
  open: boolean
  exportPath: string
  onOpenChange: (open: boolean) => void
  onCopyPath: () => Promise<boolean>
}

export function StandaloneShareDialog({
  open,
  exportPath,
  onOpenChange,
  onCopyPath,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Transcript Exported</DialogTitle>
          <DialogDescription>The transcript was written to this folder. Open index.html to view it. It contains all attachments, tool calls and history, so be mindful of sensitive info before passing it on.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="flex w-full items-center gap-2 rounded-2xl border border-border bg-muted/40 pl-4 px-3 py-2.5">
            <span className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">{exportPath}</span>
            <CopyButton
              plain
              onCopy={onCopyPath}
              title="Copy path"
              copiedTitle="Copied"
              checkClassName="h-4 w-4 text-emerald-400"
              className="flex flex-shrink-0 items-center justify-center rounded-lg text-logo hover:text-logo/60 transition-colors hover:bg-background hover:text-foreground"
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <DialogPrimaryButton type="button" onClick={() => onOpenChange(false)}>
            Done
          </DialogPrimaryButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
