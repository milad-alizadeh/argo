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

    // MARK: - The fact strip

    /// Between one fact pair and the next along a line.
    static let factGap: CGFloat = ArgoSpacing.section
    /// Between the facts line and the labels line under it.
    static let factLineGap: CGFloat = ArgoSpacing.base
    /// Inside one pair, between its key and its value.
    static let factPairGap: CGFloat = ArgoSpacing.snug
    /// Under the strip's hairline, before the body starts.
    static let stripStep: CGFloat = ArgoSpacing.comfortable
    /// Between two label chips.
    static let labelGap: CGFloat = ArgoSpacing.tight

    // MARK: - A label chip

    /// Either side of the word.
    static let labelInsetX: CGFloat = ArgoSpacing.snug
    /// Above and below it — the type-setter's line box already stands clear of the glyphs, so this
    /// is the same hair `ArgoBadge` spends for the same reason.
    static let labelInsetY: CGFloat = ArgoSpacing.hair

    // MARK: - A Delivery chip

    static let chipInsetX: CGFloat = ArgoSpacing.comfortable
    static let chipInsetY: CGFloat = ArgoSpacing.snug
    /// Between the facts inside one chip, and between two stacked chips. At this pane's width a
    /// chip sets on one line, so two Deliveries stack rather than wrap into a mess.
    static let chipGap: CGFloat = ArgoSpacing.base

    // MARK: - The body's sections

    /// The extra lift a section heading takes over the step the body already runs at. 16 and not
    /// the 24 the design measures between a block and the heading after it, because it sits ON
    /// `headingStep`: 8 + 16 is that 24, and writing 24 here would spend 32.
    static let sectionLift: CGFloat = ArgoSpacing.loose
    /// Between a heading and the block under it.
    static let headingStep: CGFloat = ArgoSpacing.base
    /// Between two rows of a link list. Tighter than anything else in the body: the rows are one
    /// list, and a gap that reads as a step would break them into six.
    static let linkGap: CGFloat = ArgoSpacing.tight
    /// Between a link row's dot, its id and its title.
    static let linkFieldGap: CGFloat = ArgoSpacing.snug

    /// What the pane is left at the ideal window — the deck, less the backlog beside it. Derived
    /// rather than written down: it is the design's tightest number and the first to move if the
    /// three-pane room ever proves cramped.
    static var idealWidth: CGFloat {
        ArgoLayout.windowIdealWidth - ArgoLayout.sidebarMinimumWidth - ArgoBacklogList.width
    }
}
