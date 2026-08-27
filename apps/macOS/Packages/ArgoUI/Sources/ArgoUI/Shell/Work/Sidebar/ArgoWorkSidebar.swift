import SwiftUI

/// What the Work room's sidebar is measured at (`docs/designs/cockpit-work-room.md` — the sidebar,
/// views not tickets). Beside the surface rather than in the contract: a measure read by one
/// surface is not a token (`rules/design-system.md`).
enum ArgoWorkSidebar {
    /// A FLOOR, not a frame: macOS scales sidebar row height with the reader's own setting, and a
    /// frame would refuse it — the same reason `ArgoRosterFoot.minimumHeight` is one.
    static let viewRowHeight: CGFloat = 26
    /// The column a view's mark is drawn in, so every view name starts on one vertical.
    static let glyphWidth: CGFloat = 14
    /// The row's leading inset, before the mark.
    static let gutter: CGFloat = ArgoSpacing.comfortable
    /// Above and below the provider chip at the foot, and at its two ends.
    static let footPaddingY: CGFloat = ArgoSpacing.base
    static let footPaddingX: CGFloat = ArgoSpacing.comfortable
}
