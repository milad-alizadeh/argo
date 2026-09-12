import { FileCode2 } from 'lucide-react'
import { Badge } from '@/renderer/components/ui/badge'

export type ComposerChipDefinition = {
  kind: 'filepath' | 'plugin' | 'skill'
  label: string
  text: string
}

type ComposerChipProps = {
  chip: ComposerChipDefinition
}

export function ComposerChip({ chip }: ComposerChipProps) {
  return (
    <Badge
      variant="outline"
      className="mx-0.5 align-text-bottom text-foreground type-label"
      data-composer-text={chip.text}
    >
      {chip.kind === 'filepath' ? <FileCode2 className="!size-(--size-icon-inline)" /> : null}
      {chip.label}
    </Badge>
  )
}
