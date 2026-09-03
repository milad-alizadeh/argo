import ArgoDesign
import ProseText
import SwiftUI

/// A message's markdown, drawn with the shape the agent gave it.
///
/// The blocks are found by `MarkdownBlock`, placed by `FeedProseFrame` and inked by `ProseSurface`
/// — nothing is reworded on any side of those lines. Since ADR-0030 Rule 2 the row is DRAWN by the
/// Core Text frame that measured it, so its height cannot drift from what it draws.
///
/// A representable and not a stack of `Text`: the stack asked SwiftUI to lay every block out again
/// on every scrolled frame, and its height was a second answer to a question `FeedRowMeasure` had
/// already answered.
package struct FeedMarkdown: View {
    @Environment(\.argo) private var argo
    @Environment(\.proseVoice) private var voice
    @Environment(\.openURL) private var open

    let text: String

    package var body: some View {
        ProseSurfaceView(showing: showing, theme: argo, open: { open($0) })
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// What the surface is asked to show. The measure is the surface's own — a representable is
    /// handed a proposal, and the words wrap across whatever it is given.
    private var showing: (CGFloat) -> ProseShowing {
        { measure in
            ProseShowing(text: text, measure: measure, ink: ink)
        }
    }

    /// The ink the row is set in. `proseVoice` is the block's own claim; the rest is the
    /// contract's.
    private var ink: ProseInk {
        let body = voice ?? argo.color.text.primary
        return ProseInk(
            body: body,
            link: argo.color.interaction.accent,
            span: span(under: body),
            marked: ProseMarkedInk(
                ground: argo.color.surface.marked,
                inset: CGSize(
                    width: ArgoFeedRow.markedSpanInsetX,
                    height: ArgoFeedRow.markedSpanInsetY,
                ),
                radius: ArgoRadius.marker,
            ),
        )
    }

    /// What a `code` span is inked in: nothing at all, unless the voice around it would fall under
    /// the contrast floor once the span's ground lifts the backdrop out from under it. The choice
    /// itself is the palette's — see `TextRoles.marked(on:)`.
    private func span(under voice: ArgoColor) -> ArgoColor? {
        let floored = argo.color.text.marked(on: voice)
        return floored == voice ? nil : floored
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(text: String) {
        self.text = text
    }
}

/// The surface, sized by the frame it is about to draw. Nothing here lays anything out: the height
/// is `FeedProseFrame`'s answer at the width the proposal offered.
private struct ProseSurfaceView: NSViewRepresentable {
    let showing: (CGFloat) -> ProseShowing
    let theme: ArgoTheme
    let open: (URL) -> Void

    func makeNSView(context _: Context) -> ProseSurface {
        ProseSurface()
    }

    func updateNSView(_ surface: ProseSurface, context _: Context) {
        surface.open = open
        surface.show(showing(surface.bounds.width), theme: theme)
    }

    func sizeThatFits(
        _ proposal: ProposedViewSize,
        nsView surface: ProseSurface,
        context _: Context,
    )
        -> CGSize? {
        // A proposal with no width of its own is SwiftUI asking what this would LIKE to be, which
        // a scroll view does before it knows its own content size. The feed's column is the answer
        // — every container that draws prose caps at it — and a measure of nothing would place the
        // row at no height at all and never be asked again.
        let offered = proposal.width ?? ArgoFeedRow.column
        let measure = offered > 0 ? offered : ArgoFeedRow.column
        surface.show(showing(measure), theme: theme)
        return CGSize(width: measure, height: surface.placed.height)
    }
}

#Preview("Feed markdown — the shape a turn's answer arrives in") {
    FeedMarkdown(text: """
    ## What I found

    The ramp had drifted navy. Two things caused it:

    1. `surface.base` was sampled from the old study.
    2. The selected wash carried the brand hue.

    ```swift
    public static let inset: CGFloat = ArgoSpacing.section
    ```

    - The contract suite is green again.
    - No view changed.
    """)
    .padding(ArgoFeedRow.inset)
    .frame(width: 620)
    .argoDeckSurface()
    .argoAppearance()
}
