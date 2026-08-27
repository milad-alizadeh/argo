import SwiftUI

/// What the deck's trailing pane is measured at (`docs/designs/cockpit-work-room.md` — the ticket
/// detail). The reading measure is NOT here: the body takes `ArgoFeedRow.column` through
/// `argoFeedMeasure()`, reused rather than redeclared — the feed already settled what a line of
/// Argo's prose runs to.
enum ArgoTicketDetail {
    /// The column off the deck's edges.
    static let inset: CGFloat = ArgoSpacing.section
    /// The rule between the provider's status word and Argo's bucket. Short deliberately: it
    /// separates two facts on one line rather than dividing the line from anything.
    static let statusDividerHeight: CGFloat = 10
    /// Between the id, the title and the status pair.
    static let headStep: CGFloat = ArgoSpacing.base
    /// Between the head and the body under it.
    static let bodyStep: CGFloat = ArgoSpacing.section

    /// What the pane is left at the ideal window — the deck, less the backlog beside it. Derived
    /// rather than written down: it is the design's tightest number and the first to move if the
    /// three-pane room ever proves cramped.
    static var idealWidth: CGFloat {
        ArgoLayout.windowIdealWidth - ArgoLayout.sidebarMinimumWidth - ArgoBacklogList.width
    }
}
