import ArgoDesign
import SwiftUI

/// A Delivery's whole signal, on one 6pt mark — the same size the roster spends on a Session
/// (`cockpit-work-room.md`, the delivery signal on the dot alone). No chip beside it: #272's rule
/// is that the row stays lean, and five states fit a mark.
package struct DeliveryDot: View {
    @Environment(\.argo) private var argo

    package let reading: DeliveryReading

    package var body: some View {
        Group {
            if let fill {
                Circle().fill(fill.color)
            } else {
                // The hollow ring, for the one state that is an ABSENCE — nothing was read, which
                // is not the quiet end of the vocabulary.
                Circle().strokeBorder(
                    argo.color.text.disabled.color,
                    lineWidth: ArgoStroke.hairline,
                )
            }
        }
        .frame(width: ArgoIconSize.statusDot, height: ArgoIconSize.statusDot)
        .accessibilityHidden(true)
    }

    private var fill: ArgoColor? {
        switch reading {
        case .absent: nil
        case .draft: argo.color.state.idle
        case .open: argo.color.interaction.accent
        case .failing: argo.color.state.failure
        case .merged: argo.color.state.running
        }
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(reading: DeliveryReading) {
        self.reading = reading
    }
}

#Preview("Delivery dot — all five states") {
    HStack(spacing: ArgoSpacing.comfortable) {
        ForEach(DeliveryReading.allCases, id: \.self) { DeliveryDot(reading: $0) }
    }
    .padding(ArgoSpacing.loose)
    .argoDeckSurface()
    .argoAppearance()
}
