import SwiftUI

/// The one gesture between the line at a control and everything the operation printed (§5).
///
/// It stands on EVERY failure that printed anything, not only the ones whose line looks cut:
/// whether the line beside it was truncated is a question of the width it was given, which nothing
/// here can answer — and a reader who cannot tell whether there is more has not been offered it.
///
/// A popover rather than a panel that grows in place: this rides a control in the window's toolbar
/// row, which has no height to give, and §4's "no layout shift" holds for the failure too.
struct RawOutputDisclosure: View {
    @Environment(\.argo) private var argo

    let output: RawOutput

    @State private var isOpen = false

    /// The spec's own words for the gesture, spoken and drawn from one string.
    static let name = "see output"

    var body: some View {
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
