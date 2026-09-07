import ArgoAtoms
import ArgoDesign
import SwiftUI

/// One glyph and one line of text, both in the ink the caller names — the shape a claimant line
/// and an issue link both draw, whether the line is a route or a reading. Shared rather than
/// pasted twice: `TicketClaimantLine`, `SessionIssueLink` and `SessionCheckoutMark` are the
/// callers (#1092, #1232).
struct GlyphMarkLine: View {
    /// `nil` draws the text alone. A caller whose mark says which KIND of thing this is has no
    /// honest glyph for a kind it has not read, and `CONTEXT.md`'s degrade-down rule renders an
    /// unestablished fact as absent rather than as the likelier guess (`SessionCheckoutMark`).
    private var mark: Mark?
    let text: String
    let ink: ArgoColor
    /// Where a line too long for its slot loses its middle instead of its tail. A branch name
    /// carries `argo/#<N>` at the head and the slug at the tail, and tail truncation drops the
    /// half that says WHICH ticket.
    var truncation: Text.TruncationMode = .tail

    /// An SF Symbol, or a caller's own drawn shape — the pull request mark is neither an SF
    /// Symbol nor absent, and no rung of `ArgoSymbol` names its fork (`DeliveryPullRequestMark`).
    private enum Mark {
        case symbol(String)
        case custom(AnyView)
    }

    var body: some View {
        HStack(spacing: ArgoSpacing.tight) {
            markView
            Text(text)
                .argoText(ArgoTypography.rowMeta)
                .foregroundStyle(ink)
                .lineLimit(1)
                .truncationMode(truncation)
        }
    }

    @ViewBuilder private var markView: some View {
        switch mark {
        case let .symbol(symbol):
            ArgoGlyph(symbol, .inline)
                .foregroundStyle(ink)
                .accessibilityHidden(true)
        case let .custom(view):
            view
                .foregroundStyle(ink)
                .accessibilityHidden(true)
        case nil:
            EmptyView()
        }
    }

    init(symbol: String?, text: String, ink: ArgoColor, truncation: Text.TruncationMode = .tail) {
        self.mark = symbol.map(Mark.symbol)
        self.text = text
        self.ink = ink
        self.truncation = truncation
    }

    init(
        text: String,
        ink: ArgoColor,
        truncation: Text.TruncationMode = .tail,
        @ViewBuilder mark: () -> some View,
    ) {
        self.mark = .custom(AnyView(mark()))
        self.text = text
        self.ink = ink
        self.truncation = truncation
    }
}
