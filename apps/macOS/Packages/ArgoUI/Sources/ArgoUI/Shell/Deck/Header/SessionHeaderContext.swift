import SwiftUI

/// The one instrument on the header: how full the Session's context is, on the trailing edge.
///
/// It draws a reading it was handed and judges nothing — which line the Session is past, and
/// whether it can be said at all, are `SessionHeaderProjection`'s. What lives here is the ink each
/// answer wears and the bar that puts the reading in reach of a glance.
struct SessionHeaderContext: View {
    @Environment(\.argo) private var argo

    let context: SessionHeaderProjection.Context

    /// The panel opens on HOVER, and a click still opens it too — the pointer is how it is
    /// reached, and the keyboard has to keep a way in. Escape and clicking away are `.popover`'s
    /// own, which is most of why the surface is one.
    @State private var isGuideOpen = false
    /// Whether the pointer is on the mark or in the panel it opened. One flag for both, because
    /// the panel is a window of its own: read of the mark alone, the guide would close the moment
    /// the pointer travelled into the thing it went there to read.
    @State private var isPointerOn = false

    /// How long the pointer rests on the mark before the panel opens.
    ///
    /// Not a motion token: nothing about this is on screen. It is the difference between a legend
    /// somebody asked for and one that flies open because the pointer crossed the header on its way
    /// somewhere else — the reason this surface was a click for two tickets.
    private static let dwell = Duration.milliseconds(280)
    /// And how long it survives the pointer leaving, so the trip from the mark into the panel does
    /// not close the panel. Longer than the dwell: leaving by accident costs a reader the paragraph
    /// they were reading, and arriving by accident costs them nothing but a glance.
    private static let grace = Duration.milliseconds(420)

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
            HStack(spacing: ArgoSpacing.tight) {
                Text(context.label)
                    .argoText(ArgoTypography.caption)
                    .textCase(.uppercase)
                    .foregroundStyle(argo.color.text.tertiary)
                about
                Spacer(minLength: ArgoSpacing.snug)
                Text(context.reading)
                    .argoText(ArgoTypography.machine)
                    .foregroundStyle(readingInk)
                    .lineLimit(1)
            }
            ContextBar(context: context)
        }
        .frame(width: ArgoLayout.contextInstrumentWidth)
        // `contain`, not `combine`: the ⓘ is a control inside this zone, and a combined element
        // swallows it — which is how a popover that renders correctly becomes one nothing can open.
        .accessibilityElement(children: .contain)
        .accessibilityLabel(context.detail)
    }

    private var about: some View {
        // Opens, never toggles. A click lands on a mark the pointer is already resting on, so a
        // toggle would read as "clicking the ⓘ closes the panel" — and it is what would break a
        // keyboard or a test that clicks the mark to open the thing hover has just opened.
        Button { isGuideOpen = true } label: {
            ArgoGlyph(ArgoSymbol.about, .inline)
        }
        .buttonStyle(.plain)
        .foregroundStyle(argo.color.text.tertiary)
        .accessibilityLabel("About the context reading")
        .onHover { isInside in pointer(isInside) }
        .popover(isPresented: $isGuideOpen, arrowEdge: .bottom) {
            // The panel counts as the mark for the purpose of staying open: a reader inside it is
            // reading, and the pointer being off the ⓘ is exactly what that looks like.
            SessionContextGuide()
                .onHover { isInside in pointer(isInside) }
        }
    }

    /// Open after the pointer has RESTED, close after it has been gone a moment, and let the state
    /// at the end of each wait decide — a pointer that came back in the meantime finds the panel
    /// open, and one that only passed through never opened it.
    private func pointer(_ isInside: Bool) {
        isPointerOn = isInside
        Task {
            try? await Task.sleep(for: isInside ? Self.dwell : Self.grace)
            guard isPointerOn == isInside else { return }
            isGuideOpen = isInside
        }
    }

    /// An unreadable context drops to the quietest rung on the header, because absence is the one
    /// thing here that is not a claim about the Session.
    private var readingInk: ArgoColor {
        context.tier?.readingInk(in: argo.color) ?? argo.color.text.tertiary
    }
}

#Preview("Context instrument — every tier, and the one that cannot be read") {
    VStack(alignment: .leading, spacing: ArgoSpacing.section) {
        ForEach(SessionHeaderFixture.contextReadings, id: \.reading) { context in
            SessionHeaderContext(context: context)
        }
    }
    .padding(ArgoSpacing.region)
    .argoDeckSurface()
    .argoAppearance()
}
