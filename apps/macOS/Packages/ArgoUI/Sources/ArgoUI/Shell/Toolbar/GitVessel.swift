import SwiftUI

/// The global primary checkout, kept separate from the selected Session's branch fact.
///
/// It applies no glass of its own: the toolbar supplies Liquid Glass, and a hand-rolled capsule
/// here would defeat the group that merges this half with the Project into one vessel.
struct GitVessel: View {
    @Environment(\.argo) private var argo

    let reading: CheckoutReading
    let refresh: () -> Void

    var body: some View {
        HStack(spacing: ArgoSpacing.snug) {
            Menu {
                Button("Refresh checkout", action: refresh)
                    .keyboardShortcut("r", modifiers: [.command, .shift])
            } label: {
                Label {
                    Text(reading.label)
                        .lineLimit(1)
                        .truncationMode(.middle)
                } icon: {
                    // The rooms' role, so the branch mark measures the same as the marks in the
                    // vessel at the other end of the bar. `ArgoGlyph` frames it by HEIGHT, which
                    // is what stops a mark that fills its em box standing over one that does not.
                    ArgoGlyph(ArgoSymbol.branch, .control)
                }
                .labelStyle(.argo(ArgoTypography.machineEmphasis))
            }
            .menuStyle(.borderlessButton)
            .menuIndicator(.hidden)
            .fixedSize()
            // BESIDE the menu, not inside it. A menu re-synthesises its label from the icon and
            // title alone, so a chevron in there never drew at all — and the system's own comes
            // out a different mark from the Project half's, on what is meant to be one vessel.
            ArgoDisclosure(.below)
        }
        .foregroundStyle(argo.color.text.secondary)
        .toolbarSegment()
        .help(reading.help)
        .accessibilityLabel(reading.announcement)
    }
}

#Preview("Git vessel") {
    GitVessel(reading: CheckoutReading(checkout: .branch("main")), refresh: {})
        .padding(ArgoSpacing.region)
        .argoAppearance()
}
