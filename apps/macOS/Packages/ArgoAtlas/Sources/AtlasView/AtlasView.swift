import ArgoDesign
import AtlasLayout
import SwiftUI

/// The Atlas, drawn.
///
/// One lit plate on the map's own ground, and nothing else (#1144). That is the whole of the
/// renderer today, on purpose: the Atlas is specified to draw with Metal, this tree had never
/// compiled a shader, and the cost of learning that at the first drawing ticket is one quad
/// against a rewrite of everything drawn by the tenth.
///
/// The ground is a `Rectangle` behind the `MTKView` rather than only the view's clear colour,
/// because every way Metal can be absent — no device, no compiled shader, no library — resolves to
/// a surface that draws nothing. Degrade-down: the map's floor with no city on it is a state the
/// app can honestly show, and a blank hole is not.
public struct AtlasView: View {
    @Environment(\.argo) private var argo

    private let plan: AtlasPlan

    public init(plan: AtlasPlan) {
        self.plan = plan
    }

    public var body: some View {
        Rectangle()
            .fill(argo.color.atlas.materials.desktop)
            .overlay {
                AtlasSurface(
                    pigment: argo.color.atlas.materials.plate1,
                    ground: argo.color.atlas.materials.desktop,
                )
            }
            .frame(width: plan.extent.width, height: plan.extent.height)
    }
}

/// The two states the map has: one with ground to stand a plate on, and one with none.
///
/// The empty case is the one worth a render rather than an assertion — a 0×0 rectangle draws
/// nothing, and nothing is indistinguishable from a view that failed to paint until you have
/// looked at the sized one beside it.
private struct AtlasPreview: View {
    let plan: AtlasPlan

    var body: some View {
        AtlasView(plan: plan)
            .padding(ArgoSpacing.section)
            .argoDeckSurface()
            .argoAppearance()
    }
}

#Preview("Atlas — one lit plate") {
    AtlasPreview(plan: AtlasPlan(extent: CGSize(width: 420, height: 260)))
}

#Preview("Atlas — the empty map") {
    AtlasPreview(plan: .empty)
}
