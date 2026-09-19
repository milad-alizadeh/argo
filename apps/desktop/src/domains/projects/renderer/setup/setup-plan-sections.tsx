import { Folder, SquareTerminal, Wrench } from 'lucide-react'
import type { SetupDocument } from '../../contract/setup-document'

export type SetupSectionModel = SetupDocument['plan'][number] & { fieldIds: readonly string[] }

export function setupSections(document: SetupDocument): readonly SetupSectionModel[] {
  if (document.plan.some(({ fieldIds }) => fieldIds.length > 0)) return document.plan
  const [first, ...rest] = document.plan
  if (!first) return []
  return [
    { ...first, fieldIds: document.fields.map(({ id }) => id) },
    ...rest.map((section) => ({ ...section, fieldIds: [] })),
  ]
}

const sectionIcons = { folder: Folder, wrench: Wrench, terminal: SquareTerminal } as const

export function SectionIcon({ icon }: { icon: SetupSectionModel['icon'] }) {
  const Icon = icon ? sectionIcons[icon] : Folder
  return (
    <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
      <Icon aria-hidden="true" className="size-4" />
    </div>
  )
}

export function fieldsForSection(document: SetupDocument, section: SetupSectionModel) {
  const ids = new Set(section.fieldIds)
  return document.fields.filter(({ id }) => ids.has(id))
}
