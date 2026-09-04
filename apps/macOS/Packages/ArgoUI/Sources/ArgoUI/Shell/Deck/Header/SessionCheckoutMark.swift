import ArgoDesign
import SwiftUI

/// The branch this Session is on, beside the Ticket it is on (#1232).
///
/// Until #1232 the branch was on screen only as the toolbar's global checkout — the SHARED
/// checkout, which is not this Session's branch and was never the same fact. With that control
/// gone the branch reached the reader on hover and in the ⓘ panel alone, and a Session's branch is
/// the join key its Delivery hangs off (`CONTEXT.md` L3 · Workspace): it earns the line.
///
/// A reading, not a route, so it takes the line's quiet ink rather than the accent every pressable
/// thing here wears. Argo checks nothing out from the cockpit, so there is nothing to press.
///
/// The mark says which KIND of checkout it is by BEING the kind's own mark, and draws none when
/// Argo has not read the kind — the plain branch mark would then claim "not a worktree"
/// (`SessionHeaderProjection.checkout(for:)` holds that rule; this only spends it).
struct SessionCheckoutMark: View {
    @Environment(\.argo) private var argo

    let checkout: SessionHeaderProjection.Header.Checkout?

    var body: some View {
        if let checkout {
            GlyphMarkLine(
                symbol: checkout.symbol,
                text: checkout.branch,
                ink: argo.color.text.tertiary,
                truncation: .middle,
            )
            .help(checkout.detail)
            .accessibilityLabel(checkout.detail)
            // A branch name is unbounded and the tabs beside it are not: without this the line
            // hands its whole leading edge to one long slug and pushes the tabs into the
            // instruments.
            .frame(maxWidth: Self.maximumWidth, alignment: .leading)
        }
    }

    /// Wide enough for `argo/#1232-remove-branch-control`, the shape this repo's own branches
    /// take, and no wider — measured off the tab line, not stepped off `ArgoSpacing`.
    static let maximumWidth: CGFloat = 220
}

#Preview("Session checkout mark — worktree, main, kind unread") {
    VStack(alignment: .leading, spacing: ArgoSpacing.loose) {
        SessionCheckoutMark(checkout: .init(
            branch: "argo/#1232-remove-branch-control",
            symbol: ArgoSymbol.worktree,
            detail: "On argo/#1232-remove-branch-control, in a worktree of its own",
        ))
        SessionCheckoutMark(checkout: .init(
            branch: "main",
            symbol: ArgoSymbol.branch,
            detail: "On main, in the Project's own checkout",
        ))
        SessionCheckoutMark(checkout: .init(branch: "main", symbol: nil, detail: "On main"))
        SessionCheckoutMark(checkout: nil)
    }
    .padding(ArgoSpacing.loose)
    .argoDeckSurface()
    .argoAppearance()
}
