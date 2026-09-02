import ArgoDesign
import ArgoUI
import SwiftUI

#Preview("Context guide — the policy, then what this Session reads") {
    SessionContextGuide(facts: SessionHeaderFixture.guided.facts)
        .argoFloatingGlass(in: .rect(cornerRadius: ArgoRadius.popover))
        .padding(ArgoSpacing.region)
        .argoAppearance()
}

#Preview("Context guide — a Session on a branch that names no ticket") {
    SessionContextGuide(facts: SessionHeaderFixture.unlinked.facts)
        .argoFloatingGlass(in: .rect(cornerRadius: ArgoRadius.popover))
        .padding(ArgoSpacing.region)
        .argoAppearance()
}

#Preview("Context guide — a Session almost nothing could be read off") {
    SessionContextGuide(facts: SessionHeaderFixture.unguided.facts)
        .argoFloatingGlass(in: .rect(cornerRadius: ArgoRadius.popover))
        .padding(ArgoSpacing.region)
        .argoAppearance()
}
