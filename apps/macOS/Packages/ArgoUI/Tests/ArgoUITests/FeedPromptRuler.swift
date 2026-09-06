import ArgoDesign
@testable import ArgoUI
import ProseText
import SwiftUI

/// What a prompt's bubble stands at, asked the ONE way the feed ever asks: a single
/// `sizeThatFits` against a detached hosting controller, which is the mechanism of
/// `FeedTableCoordinator.measuredHeight`.
///
/// That single pass is the whole point. A bubble whose size needs a second one is a bubble the
/// table caches at a height nobody ever drew — a squashed bubble, and a control clipped out of the
/// row (#946). So every claim built on this is checked against the first answer and never a
/// settled one.
@MainActor
enum FeedPromptRuler {
    /// The row's own content width at the feed's widest column — what `FeedTableModel.content`
    /// leaves a row once the gutters are off it.
    static let measure = ArgoFeedRow.column - ArgoFeedRow.inset * 2
    /// The words inside the bubble, which is the ceiling less its own insets.
    static let inside = ArgoFeedRow.bubbleInside(of: measure)

    /// How far a drawn height may sit from the arithmetic and still be the same layout. SwiftUI
    /// does not lay text out to the same sub-point on every machine — `MinimapBlockHeightTests`
    /// meets two engines, one keeping the font's fractional metrics and one paying `ceil` per run —
    /// and a row height is rounded up again before the table uses it. Far under what any claim
    /// turns on: the smallest of them, the control's own row, is above 20 points.
    static let slack: CGFloat = 3

    /// The bubble's height, asked for the way the table asks for a row's.
    static func height(of text: String, expanded: Bool, shots: [FeedShot] = []) -> CGFloat {
        sized(across: measure) {
            FeedPrompt(
                prompt: FeedPromptReading(text: text, shots: shots),
                open: { _ in }, isExpanded: .constant(expanded),
            )
            .frame(width: measure)
        }
    }

    /// The control's own row, measured the same way — its words at the rung it is set on, plus the
    /// step above it.
    static var control: CGFloat {
        ArgoSpacing.snug
            + sized(across: inside) { Text("Show more").argoText(ArgoTypography.caption) }
    }

    /// The gallery's own height inside the bubble, measured rather than assumed — a picture case
    /// asserted against a bound loose enough to hold a control row would pass with one drawn.
    static func gallery(of shots: [FeedShot]) -> CGFloat {
        sized(across: inside) {
            FeedGalleryRow(gallery: FeedGallery(shots: shots), open: { _ in })
        }
    }

    /// How tall `count` lines of the feed's body stand — the arithmetic the overview lane maps a
    /// prompt with, so the bubble and its miniature cannot disagree.
    static func prose(lines count: Int) -> CGFloat {
        ProseFace.body.height(ofLines: count)
    }

    /// How many lines a prompt wraps into inside the bubble.
    static func lines(of text: String) -> Int {
        ProseMetrics.lay(out: text, across: inside).lines
    }

    private static func sized(
        across width: CGFloat,
        @ViewBuilder _ content: () -> some View,
    )
        -> CGFloat {
        let ruler = NSHostingController(rootView: AnyView(EmptyView()))
        ruler.sizingOptions = []
        ruler.rootView = AnyView(content().argoAppearance())
        return ruler.sizeThatFits(
            in: NSSize(width: width, height: CGFloat.greatestFiniteMagnitude),
        ).height
    }
}
