import ArgoDesign
import ArgoUI
import SwiftUI

#Preview("Hand off — amber, red, and out of reach") {
    VStack(alignment: .leading, spacing: ArgoSpacing.section) {
        ForEach(Array(SessionHeaderFixture.handoffOffers.enumerated()), id: \.offset) { offer in
            SessionHandoffButton(handoff: offer.element, run: {})
        }
    }
    .padding(ArgoSpacing.region)
    .argoDeckSurface()
    .argoAppearance()
}
