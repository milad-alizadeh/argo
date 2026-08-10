import SwiftUI

/// The one instrument on the header: how full the Session's context is, on the trailing edge.
///
/// It draws a reading it was handed and judges nothing — which line the Session is past, and
/// whether it can be said at all, are `SessionHeaderProjection`'s. What lives here is the ink each
/// answer wears and the bar that puts the reading in reach of a glance.
struct SessionHeaderContext: View {
    @Environment(\.argo) private var argo

    let context: SessionHeaderProjection.Context

    /// The panel is opened by CLICK and never by hover: it is meant to be read, and a legend that
    /// appears while the pointer crosses the header is a legend nobody finishes. Escape and
    /// clicking away are `.popover`'s own, which is most of why the surface is one.
    @State private var isGuideOpen = false

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
        Button { isGuideOpen.toggle() } label: {
            ArgoGlyph(ArgoSymbol.about, .inline)
        }
        .buttonStyle(.plain)
        .foregroundStyle(argo.color.text.tertiary)
        .accessibilityLabel("About the context reading")
        .popover(isPresented: $isGuideOpen, arrowEdge: .bottom) {
            SessionContextGuide()
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
