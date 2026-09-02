import ArgoDesign
import SwiftUI

/// The bar under the reading: how much of the window is held, with both policy lines standing in
/// it. The ticks say which threshold is coming, so the reading can be judged BEFORE it changes
/// colour.
struct ContextBar: View {
    @Environment(\.argo) private var argo

    let context: SessionHeaderProjection.Context

    var body: some View {
        // The width has to be measured rather than assumed: the fill and both ticks are fractions
        // of the track, and a bar drawn from a guessed width lands its lines somewhere else.
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(argo.color.surface.raised)
                fill(in: proxy.size.width)
                ticks(in: proxy.size.width)
            }
        }
        .frame(height: ArgoContextBar.height)
        // The bar is a second reading of what the text above it already says, so a screen reader
        // hears it once rather than twice.
        .accessibilityHidden(true)
    }

    /// Nothing at all when the context could not be read: a zero-width fill would be a claim about
    /// the Session rather than about Argo's reading.
    @ViewBuilder private func fill(in width: CGFloat) -> some View {
        if let filled = context.fill {
            Capsule()
                .fill(context.tier?.tint(in: argo.color) ?? argo.color.text.disabled)
                .frame(width: width * filled)
        }
    }

    private func ticks(in width: CGFloat) -> some View {
        ForEach(context.marks, id: \.self) { mark in
            Rectangle()
                .fill(argo.color.edge.strong)
                .frame(width: ArgoStroke.border)
                .padding(.vertical, -ArgoContextBar.tickOvershoot)
                .offset(x: width * mark)
        }
    }
}
