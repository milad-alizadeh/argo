import { type RefObject, useEffect, useRef, useState } from 'react'

// The feed's virtualisation, at SECTION grain: a section near the viewport renders its rows, and one
// far from it stands as a spacer of the height it last measured. Reading back thirty minutes of work
// must not stall the window (issue 319) — and thirty turns of prose, diffs and screenshots all mounted
// is exactly that stall.
//
// Section grain rather than row grain because the section is what the scroll-spy anchors and what the
// navigation list jumps to: a virtualiser that moves rows into absolute positions would take both of
// those away, and the anchor a jump lands on has to be in the document to be landed on.

/** How much of a viewport beyond the visible area is mounted, either side. Generous on purpose: a
 * section that mounts only once it is visible is a section you scroll into as a blank, and the point of
 * the window is that fast scrolling never outruns it. */
const MOUNT_MARGIN = '150%'

/** The height a never-yet-measured section stands at, in px. It is a GUESS and it is allowed to be
 * wrong — the section corrects it the first time it mounts. Roughly one turn of prose with a diff. */
const ESTIMATED_HEIGHT = 360

/** What a section renders as: its rows, or a spacer holding the space they took. */
export interface SectionWindow {
  mounted: boolean
  /** The spacer's height, absent while the rows are mounted and holding their own. */
  height: number | undefined
}

/**
 * Whether one section is close enough to the viewport to be worth mounting, and what to stand in its
 * place while it is not.
 *
 * The measurement is taken WHILE MOUNTED and kept in a ref, so the spacer that replaces the rows is the
 * height those rows actually had. A spacer sized by an estimate under content already measured is what
 * makes a virtualised list jump under the reader as they scroll back through it.
 */
export function useNearViewport(
  section: RefObject<HTMLElement | null>,
  root: RefObject<HTMLElement | null>,
  /** Whether to mount before the observer has said anything. TRUE for the handful of sections the feed
   * opens on — an observer reports one frame late, and a section that waited for it would open blank.
   * FALSE for the rest, which is what keeps a forty-turn feed from mounting all forty on first paint
   * only to occlude thirty-five of them a frame later. */
  eager = true,
): SectionWindow {
  const [mounted, setMounted] = useState(eager)
  const measured = useRef<number | null>(null)

  useEffect(() => {
    const element = section.current
    if (!element) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry === undefined) return
        // Measured on the way OUT, which is the last moment the real height is knowable — the rows are
        // still mounted at the instant the observer fires. Re-measured every time rather than once: a
        // live turn grows while you are reading it, and a spacer sized before it grew is a scroll that
        // jumps when you come back to it.
        if (!entry.isIntersecting) measured.current = element.getBoundingClientRect().height
        setMounted(entry.isIntersecting)
      },
      { root: root.current, rootMargin: MOUNT_MARGIN },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [root, section])

  return { mounted, height: mounted ? undefined : (measured.current ?? ESTIMATED_HEIGHT) }
}
