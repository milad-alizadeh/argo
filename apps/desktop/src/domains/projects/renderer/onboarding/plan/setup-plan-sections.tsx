import { Icon, type IconName } from '@/platform/renderer/components/icon/icon'
import type { SetupDocument } from '../model/setup-document'
import './project-setup-plan-review-parts.css'

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
    <div className="onboarding-media-tile size-9">
      <Icon name={iconName} className="size-4" />
    </div>
  )
}

export function fieldsForSection(document: SetupDocument, section: SetupSectionModel) {
  const ids = new Set(section.fieldIds)
  return document.fields.filter(({ id }) => ids.has(id))
}
