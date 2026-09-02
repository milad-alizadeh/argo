import ArgoAtoms
import ArgoDesign
import SwiftUI

/// The global primary checkout, kept separate from the selected Session's branch fact.
///
/// It applies no glass of its own: the toolbar supplies Liquid Glass, and a hand-rolled capsule
/// here would defeat the group that merges this half with the Project into one vessel.
///
/// **A plain pull-down (#875).** The chevron was drawn beside the menu because a `Menu`
/// re-synthesises its label from icon and title alone, so one placed inside never drew — which is
/// a reason to let the system draw its own indicator, not a reason to draw a second mark. It has
/// one now, and the selected-segment wash under it is gone with `ToolbarSegment`.
struct GitVessel: View {
    @Environment(\.argo) private var argo

    package let reading: CheckoutReading
    let refresh: () -> Void

    var body: some View {
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
        // As on `ProjectVessel`: a `Menu` reads the tint, never a `foregroundStyle` around it. A
        // rung below the Project half, which is the name this checkout qualifies.
        .tint(argo.color.text.secondary)
        .fixedSize()
        .help(reading.help)
        .accessibilityLabel(reading.announcement)
    }
}

#Preview("Git vessel") {
    GitVessel(reading: CheckoutReading(checkout: .branch("main")), refresh: {})
        .padding(ArgoSpacing.region)
        .argoAppearance()
}
