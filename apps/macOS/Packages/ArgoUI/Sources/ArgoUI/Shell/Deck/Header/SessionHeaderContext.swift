import SwiftUI

/// The one instrument on the tab line: how full the Session's context is, on the trailing edge.
///
/// It draws a reading it was handed and judges nothing — which line the Session is past, and
/// whether it can be said at all, are `SessionHeaderProjection`'s.
///
/// Its label and reading sit a rung below the roles the 56pt band set them at (#693): a 40pt line
/// carrying two stacked rows has no room for the band's sizes.
struct SessionHeaderContext: View {
    @Environment(\.argo) private var argo

    let context: SessionHeaderProjection.Context
    /// What the ⓘ panel reports, forwarded untouched — the instrument draws none of it (#694).
    let facts: [SessionHeaderProjection.Fact]

    /// The panel opens on HOVER, and a click still opens it too, so the keyboard keeps a way in.
    /// Escape and clicking away are `.popover`'s own.
    @State private var isGuideOpen = false
    /// Whether the pointer is on the mark or in the panel it opened. One flag for both: the panel
    /// is a window of its own, so read of the mark alone the guide would close the moment the
    /// pointer travelled into it.
    @State private var isPointerOn = false

    /// How long the pointer rests on the mark before the panel opens. Not a motion token: nothing
    /// about this is on screen.
    private static let dwell = Duration.milliseconds(280)
    /// And how long it survives the pointer leaving, so the trip from the mark into the panel does
    /// not close it. Must stay longer than the dwell.
    private static let grace = Duration.milliseconds(420)

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
            HStack(spacing: ArgoSpacing.tight) {
                Text(context.label)
                    .argoText(ArgoTypography.badge)
                    .textCase(.uppercase)
                    .foregroundStyle(argo.color.text.tertiary)
                about
                Spacer(minLength: ArgoSpacing.snug)
                Text(context.reading)
                    .argoText(ArgoTypography.machineCaption)
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
        // Opens, never toggles: a click lands on a mark the pointer is already resting on, so a
        // toggle would close the panel hover has just opened.
        Button { isGuideOpen = true } label: {
            ArgoGlyph(ArgoSymbol.about, .inline)
        }
        .buttonStyle(.plain)
        .foregroundStyle(argo.color.text.tertiary)
        // ⌘I is what macOS spells "tell me about this", and it is the one route in that does not
        // wait on Full Keyboard Access (#718). On the control rather than in a menu because the
        // panel it opens is anchored HERE, so `.help` is where the reader finds the key.
        .keyboardShortcut("i", modifiers: .command)
        .help("About the context reading — Command I")
        .accessibilityLabel("About the context reading")
        .onHover { isInside in pointer(isInside) }
        .popover(isPresented: $isGuideOpen, arrowEdge: .bottom) {
            // The panel counts as the mark for the purpose of staying open: a reader inside it is
            // reading, and the pointer being off the ⓘ is exactly what that looks like.
            SessionContextGuide(facts: facts)
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
        ForEach(SessionHeaderFixture.contexts, id: \.name) { tier in
            SessionHeaderContext(context: tier.header.context, facts: tier.header.facts)
        }
    }
    .padding(ArgoSpacing.region)
    .argoDeckSurface()
    .argoAppearance()
}
