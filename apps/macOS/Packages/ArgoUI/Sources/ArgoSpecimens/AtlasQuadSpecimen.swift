import ArgoDesign
import AtlasLayout
import AtlasView
import SwiftUI

/// The first thing Metal has ever drawn in this tree: one plate, lit by `ArgoLight`'s three lamps,
/// standing on the map's own ground (#1144).
///
/// It is a specimen rather than a preview because the question it answers cannot be answered in
/// Xcode. A `#Preview` renders on the machine that has the Metal Toolchain installed; the claim
/// worth holding is that the SHIPPED binary draws, and only a screenshot of the running app says
/// that. The plate is inset on purpose — the ground around it is the fallback the same view shows
/// when there is no device, no compiled shader or no library, so the two states are told apart by
/// whether anything is standing on the floor at all.
struct AtlasQuadSpecimen: View {
    var body: some View {
        AtlasView(plan: AtlasPlan(extent: CGSize(width: 520, height: 360)))
            .padding(ArgoSpacing.section)
            .argoDeckSurface()
    }
}

#Preview("Atlas — one lit plate") {
    AtlasQuadSpecimen()
        .frame(width: 640, height: 460)
        .argoAppearance()
}
