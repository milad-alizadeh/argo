import ArgoDesign
import ArgoUI
import SwiftUI

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
