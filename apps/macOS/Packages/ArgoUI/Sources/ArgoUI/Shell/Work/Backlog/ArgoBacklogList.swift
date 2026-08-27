import SwiftUI

/// What the deck's leading pane is measured at (`docs/designs/cockpit-work-room.md` — the backlog
/// list). Beside the surface, per `rules/design-system.md`: a measure is not a token.
enum ArgoBacklogList {
    /// The smallest width at which all twelve of the repo's real titles read whole at depth three.
    /// At 480 three of them clip, which is the arithmetic that moved the backlog out of the rail.
    static let width: CGFloat = 520
    /// A FLOOR, not a frame — the same reason `ArgoWorkSidebar.viewRowHeight` is one. It grew from
    /// 28 when the title snapped up to `body` 13.
    static let rowHeight: CGFloat = 30
    /// The row's leading inset.
    static let gutter: CGFloat = ArgoSpacing.comfortable
    /// Between the dot, the id, the title and the trailing fact.
    static let gap: CGFloat = ArgoSpacing.base
}
