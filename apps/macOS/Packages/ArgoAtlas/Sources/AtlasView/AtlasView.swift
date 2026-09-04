import ArgoDesign
import AtlasLayout
import SwiftUI

/// The Atlas, drawn flat: a rectangle per file in its band's colour, the folder plates under them
/// carrying their names, and the key that says what the colour is worth (#1147).
///
/// Nothing here is lit: nothing may be lit at the cost of its band, which `AtlasFace.metal` states
/// in full. The volumes stand up at #1150 and the light model arrives at #1151.
///
/// The rectangles are Metal and the words are SwiftUI, which is the split every part of this view
/// follows: the GPU draws the city, and the one thing a GPU has no cheap answer for — a name that
/// has to be elided when it does not fit — is drawn over it by the layer that measures text.
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
        VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
            map
            if let legend = plan.legend {
                AtlasLegendKey(legend: legend, measure: argo.color.atlas.measure)
            }
        }
    }

    private var map: some View {
        Rectangle()
            .fill(argo.color.atlas.materials.desktop)
            .overlay {
                AtlasSurface(
                    plan: plan,
                    pigments: AtlasPigments(argo.color.atlas, rim: argo.color.edge.hairline),
                )
            }
            .overlay {
                AtlasPlateNames(plates: plan.plates)
            }
            .frame(width: plan.extent.width, height: plan.extent.height)
    }
}

/// The two states the map has: one with ground to stand a city on, and one with none.
///
/// The empty case is the one worth a render rather than an assertion — a 0×0 rectangle draws
/// nothing, and nothing is indistinguishable from a view that failed to paint until you have
/// looked at the tiled one beside it.
private struct AtlasPreview: View {
    let plan: AtlasPlan

    var body: some View {
        AtlasView(plan: plan)
            .padding(ArgoSpacing.section)
            .argoDeckSurface()
            .argoAppearance()
    }
}

#Preview("Atlas — the map tiled flat") {
    AtlasPreview(plan: AtlasPlan(
        extent: CGSize(width: 620, height: 400),
        plates: [
            .init(path: "argo", rect: CGRect(x: 0, y: 0, width: 620, height: 400), depth: 0),
            .init(path: "argo/rules", rect: CGRect(x: 2, y: 8, width: 300, height: 390), depth: 1),
        ],
        tiles: [
            .init(
                path: "argo/rules/house.md",
                rect: CGRect(x: 4, y: 16, width: 296, height: 200),
                band: .hot,
            ),
            .init(
                path: "argo/rules/swift.md",
                rect: CGRect(x: 4, y: 216, width: 296, height: 180),
                band: .quiet,
            ),
            .init(
                path: "argo/README.md",
                rect: CGRect(x: 302, y: 8, width: 316, height: 390),
                band: .middling,
            ),
        ],
        legend: AtlasLegend(measure: "lines", greatestQuiet: 61, leastHot: 480),
    ))
}

#Preview("Atlas — the empty map") {
    AtlasPreview(plan: .empty)
}
