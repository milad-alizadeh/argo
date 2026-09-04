import ArgoDesign
import AtlasLayout
import SwiftUI

/// The Atlas, drawn.
///
/// A placeholder: it lays the plan's own ground and nothing on it (#1143). The real surface is
/// Metal — PR #1139 settled that — and this view is the SwiftUI seam the `MTKView` will be hosted
/// in, so the package, the app target and the five gates over them are all real before the shader
/// arrives.
public struct AtlasView: View {
    @Environment(\.argo) private var argo

    private let plan: AtlasPlan

    public init(plan: AtlasPlan) {
        self.plan = plan
    }

    public var body: some View {
        Rectangle()
            .fill(argo.color.surface.sunken)
            .frame(width: plan.extent.width, height: plan.extent.height)
    }
}

/// The two states the placeholder has: a map with ground, and one with none.
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

#Preview("Atlas — a map with ground") {
    AtlasPreview(plan: AtlasPlan(extent: CGSize(width: 420, height: 260)))
}

#Preview("Atlas — the empty map") {
    AtlasPreview(plan: .empty)
}
