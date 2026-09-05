import ArgoDesign
import AtlasView
import SwiftUI

/// The name bar, on the ground it is really read against (#1153).
///
/// A specimen rather than a preview alone, because the one thing it has to survive is the DESKTOP:
/// it is the only overlay in the app laid over the map's near-black ground rather than over a deck,
/// and a translucent surface judged on the wrong ground is a surface nobody has looked at.
///
/// It cannot be rendered where it really appears. The bar answers a POINTER, and no screenshot
/// drives one — so its two readings are stood up instead: a file deep in the tree, and a file at
/// the root of it, where there is no folder to say and a bare `/` would claim one nobody has.
///
/// There is no third for the elided state, and that is a finding rather than an omission: the bar
/// says two folders and a name, so at the width `AtlasView` frames it at it does not reach its own
/// limit on any path this repository has.
struct AtlasHoverNameSpecimen: View {
    @Environment(\.argo) private var argo

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.section) {
            AtlasHoverName(
                path: "argo/apps/macOS/Packages/ArgoAtlas/Sources/AtlasView/AtlasView.swift",
            )
            AtlasHoverName(path: "README.md")
        }
        .padding(ArgoSpacing.region)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(argo.color.atlas.materials.desktop)
    }
}

#Preview("Atlas hover name") {
    AtlasHoverNameSpecimen()
        .frame(width: 900, height: 300)
        .argoAppearance()
}
