import { ChevronDownIcon, FolderIcon, PanelLeftIcon } from 'lucide-react'

export function RosterBar({
  projectName,
  onCollapse,
}: {
  projectName: string
  onCollapse: () => void
}) {
  return (
    <div className="session-page__roster-bar" data-component="RosterBar">
      <button
        aria-label="Hide Sessions"
        className="session-page__icon-button"
        onClick={onCollapse}
        type="button"
      >
        <PanelLeftIcon aria-hidden="true" />
      </button>
      <span className="flex-1" />
      <span className="session-page__project-name font-medium" data-component="ProjectPicker">
        <FolderIcon aria-hidden="true" />
        <span className="truncate">{projectName}</span>
        <ChevronDownIcon aria-hidden="true" className="session-page__meta-icon" />
      </span>
    </div>
  )
}
