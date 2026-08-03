import { IconButton, PlusIcon, TooltipProvider } from '@/shared/components/ui'
import type { ProjectTabView } from '../../shellModel'
import { ProjectTab } from './ProjectTab'

type ProjectStripProps = {
  /** One tab per connected project, in the order the registry holds them. Empty is a real
   * state: nothing is connected yet and the strip is just `+`. */
  tabs: ProjectTabView[]
  /** How long ago the active project last synced, for its tooltip. `null` when unavailable. */
  lastSynced: string | null
  /** Make a project the active one. */
  onSelectProject: (projectId: string) => void
  /** Start connecting a new project. */
  onAddProject: () => void
  /** Open a project's context menu, whose one entry is Project Settings (issue 265). */
  onOpenProjectMenu: (projectId: string) => void
}

/**
 * Organism: the far-left column of projects.
 *
 * Borderless and fill-free by design — the tabs float on the lit scene with no panel behind
 * them and no divider beside them, so the strip reads as part of the room rather than as a
 * surface stacked on it. Top-padded clear of the window's traffic lights.
 */
export function ProjectStrip({
  tabs,
  lastSynced,
  onSelectProject,
  onAddProject,
  onOpenProjectMenu,
}: ProjectStripProps): React.JSX.Element {
  return (
    <TooltipProvider>
      <nav
        aria-label="Projects"
        data-component="ProjectStrip"
        className="flex h-full w-project-strip shrink-0 flex-col items-center gap-inset pt-traffic-lights pb-plane"
      >
        {tabs.map((tab) => (
          <ProjectTab
            key={tab.id}
            tab={tab}
            lastSynced={lastSynced}
            onSelect={() => onSelectProject(tab.id)}
            onOpenContextMenu={() => onOpenProjectMenu(tab.id)}
          />
        ))}
        <IconButton label="Add a project" onClick={onAddProject} className="mt-auto">
          <PlusIcon className="size-4" />
        </IconButton>
      </nav>
    </TooltipProvider>
  )
}
