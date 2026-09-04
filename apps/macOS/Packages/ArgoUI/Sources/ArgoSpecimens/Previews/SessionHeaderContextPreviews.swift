import ArgoDesign
import ArgoUI
import SwiftUI

#Preview("Context instrument — every tier, and the one that cannot be read") {
    VStack(alignment: .leading, spacing: ArgoSpacing.section) {
        ForEach(SessionHeaderFixture.contexts, id: \.name) { tier in
            // The unread one draws no instrument at all, so its row is a gap (#1249).
            if let context = tier.header.context {
                SessionHeaderContext(context: context, facts: tier.header.facts)
            }
        }
    }
    .padding(ArgoSpacing.region)
    .argoDeckSurface()
    .argoAppearance()
}
