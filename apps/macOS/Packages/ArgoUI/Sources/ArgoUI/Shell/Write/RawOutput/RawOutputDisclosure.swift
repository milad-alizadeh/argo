import SwiftUI

/// The one gesture between the line at a control and everything the operation printed (§5).
struct RawOutputDisclosure: View {
    @Environment(\.argo) private var argo

    let output: RawOutput

    @State private var isOpen = false

    /// The spec's own words for the gesture, spoken and drawn from one string.
    static let name = "see output"

    var body: some View {
        // Opens rather than toggles, because the popover's own dismissal already closes it — a
        // toggle would re-open on the click that dismissed it.
        Button { isOpen = true } label: {
            HStack(spacing: ArgoSpacing.tight) {
                ArgoGlyph(ArgoSymbol.delegated, .inline)
                Text(Self.name)
                    .argoText(ArgoTypography.control)
            }
            .argoHitTarget()
        }
        .buttonStyle(.plain)
        .foregroundStyle(argo.color.text.secondary)
        .help(Self.name)
        .accessibilityLabel(Self.name)
        .popover(isPresented: $isOpen, arrowEdge: .bottom) {
            RawOutputView(output: output)
        }
    }
}

#Preview("See output — the gesture at rest") {
    if let output = RawOutput(WriteControlSpecimen.validationRefusal) {
        RawOutputDisclosure(output: output)
            .padding(ArgoSpacing.region)
            .argoAppearance()
    }
}
