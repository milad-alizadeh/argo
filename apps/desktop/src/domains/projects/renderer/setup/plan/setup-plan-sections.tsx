import type { SetupDocument } from '@/domains/projects/contract/setup/setup-document'
import { Icon, type IconName } from '@/platform/renderer/components/icon/icon'

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

const sectionIcons = {
  folder: 'folder',
  wrench: 'tooling',
  terminal: 'tool-terminal',
} satisfies Record<string, IconName>

export function SectionIcon({ icon }: { icon: SetupSectionModel['icon'] }) {
  const iconName = icon ? sectionIcons[icon] : 'folder'
  return (
    <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
      <Icon name={iconName} className="size-4" />
    </div>
  )
}

export function fieldsForSection(document: SetupDocument, section: SetupSectionModel) {
  const ids = new Set(section.fieldIds)
  return document.fields.filter(({ id }) => ids.has(id))
}
