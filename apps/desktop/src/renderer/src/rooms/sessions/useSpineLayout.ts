import { useState } from 'react'

/** The three resizable edges of the spine — one custom property each. Declared beside the hook
 * that moves them rather than in a model file: they ARE the layout's vocabulary. */
export type SpineEdge = 'roster' | 'activity' | 'dock'

/** The three resizable panel sizes, in px — the screen holds them and hands them to its
 * splitters and to the custom properties the panels size off. */
export interface SpineLayout {
  roster: number
  activity: number
  dock: number
}

/** The initial size and the clamp bounds for each edge, plus the Dock's tall preset. The
 * roster opens at 300; the old `w-60` (240) lives on only in the roster component stories'
 * decorators, which pin `--c-rail` there so those VRT baselines stay pixel-identical. */
export const SPINE = {
  roster: { initial: 300, min: 200, max: 420 },
  activity: { initial: 420, min: 300, max: 720 },
  dock: { initial: 170, min: 120, max: 480, expanded: 320 },
} as const

/** Store a splitter's clamped px on its edge, leaving the other two. */
export function applyResize(layout: SpineLayout, edge: SpineEdge, px: number): SpineLayout {
  return { ...layout, [edge]: px }
}

/** Whether the Dock reads as expanded — derived from its height (the single source of truth),
 * so a manual drag past the preset counts and the caret/aria never disagree with the pixels. */
export const isDockExpanded = (px: number): boolean => px >= SPINE.dock.expanded

/** Snap the Dock on expand/collapse. Expand grows to at least the tall preset but never
 * shrinks a Dock the user already dragged larger; collapse returns to the short initial. */
export function applySnap(layout: SpineLayout, expanded: boolean): SpineLayout {
  const dock = expanded ? Math.max(layout.dock, SPINE.dock.expanded) : SPINE.dock.initial
  return { ...layout, dock }
}

/** The spine's layout state: the three px sizes plus the two ways they change — a splitter
 * drag/arrow (`resize`) and the Dock's expand snap (`snapDock`). The px are screen-local
 * layout state, never tokens; the View writes them onto `--c-rail`/`--c-act`/`--r-dock`. */
export function useSpineLayout(): {
  layout: SpineLayout
  resize: (edge: SpineEdge, px: number) => void
  snapDock: (expanded: boolean) => void
} {
  const [layout, setLayout] = useState<SpineLayout>({
    roster: SPINE.roster.initial,
    activity: SPINE.activity.initial,
    dock: SPINE.dock.initial,
  })
  const resize = (edge: SpineEdge, px: number): void => setLayout((l) => applyResize(l, edge, px))
  const snapDock = (expanded: boolean): void => setLayout((l) => applySnap(l, expanded))
  return { layout, resize, snapDock }
}
