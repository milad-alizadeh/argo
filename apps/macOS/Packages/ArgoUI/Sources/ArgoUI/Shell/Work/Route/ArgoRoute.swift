import SwiftUI

/// What the Route's canvas is measured at (`docs/designs/cockpit-work-room.md` — the Route,
/// re-skinned). Beside the surface, per `rules/design-system.md`: a measure is not a token.
///
/// `route.png` draws a 132pt label block on a 166pt column, which fits the titles the study
/// invented — `This prototype`, `Read path`, `Node tree`. Every title in this repo truncates inside
/// three words at that width, so the block is measured against real ones instead. Re-shooting the
/// render is what would move it.
enum ArgoRoute {
    /// A label block's cap, dot included. It truncates rather than wraps, so the longest titles
    /// still cut — no column width fits a sentence.
    static let labelWidth: CGFloat = 260
    static let columnClearance: CGFloat = ArgoSpacing.section
    /// Derived from the block, so a widened block moves its own column. #337 replaces the chosen
    /// width with the widest block actually in play; this arithmetic does not change.
    static let columnStep: CGFloat = labelWidth + columnClearance
    /// Read off `route.png`.
    static let rowPitch: CGFloat = 62
    /// Rows a closed column holds before the next one starts. Closed work is a list, not a graph
    /// (#334), so it may wrap; a column ahead of the line may not, because its position is its
    /// remaining depth.
    static let behindRowCap = 8

    static let originX: CGFloat = 64
    static let originY: CGFloat = 44
    /// #339's fog and destination mark take their own room beyond this.
    static let trailingPad: CGFloat = ArgoSpacing.region
    static let bottomPad: CGFloat = ArgoSpacing.section

    static let dotSize: CGFloat = ArgoIconSize.statusDot
    static let labelLead: CGFloat = ArgoSpacing.base
    static let labelStep: CGFloat = ArgoSpacing.hair
    static let machineLineInset: CGFloat = dotSize + labelLead

    /// Half the clearance, so the line stands in the gutter and cannot cross a label rather than
    /// merely happening not to.
    static let nowLineLead: CGFloat = columnClearance / 2
    /// The line's reach above the first row, where #339 writes its caption.
    static let nowLineLift: CGFloat = 28

    static let headPadding: CGFloat = ArgoSpacing.comfortable
}
