import ArgoDesign
import AtlasLayout
import SwiftUI

/// The measured Map, drawn straight down: every folder a plate, every file a tile on it, banded by
/// the traffic light.
///
/// The treemap rather than the city, because the city is the camera's (#1150, #1152) and this is
/// the same tiling seen from above — one `AtlasPlan`, which is the seam the whole Atlas is built
/// on. `AtlasView`'s Metal surface draws one lit plate today and cannot yet take a plan's tiles.
///
/// Shapes in a `Canvas` and labels as real `Text`, which is `MermaidView`'s arrangement and for its
/// reason: a canvas cannot set a string by a contract role, and only a folder's name is drawn — a
/// label per file would be thousands of them at sizes nobody could read.
struct AtlasMapCanvas: View {
    @Environment(\.argo) private var argo

    let map: AtlasMap
    let channels: AtlasChannels

    var body: some View {
        GeometryReader { proxy in
            // Tiled HERE rather than inside the canvas closure: that closure runs per frame, and
            // ADR-0028 rule 3 forbids a per-frame path whose cost scales with the document. A body
            // runs when the size moves.
            let plan = AtlasPlan(tiling: map, by: channels, into: proxy.size)
            Canvas { context, _ in
                for plate in plan.plates {
                    context.fill(Path(plate.rect), with: .color(tone(at: plate.depth).color))
                }
                for tile in plan.tiles {
                    context.fill(Path(tile.rect), with: .color(pigment(of: tile.band).color))
                }
            }
            .overlay { names(of: plan) }
        }
        .background(argo.color.atlas.materials.desktop)
    }

    /// A folder's name, on the folders that can carry one.
    ///
    /// The two OUTERMOST depths only, and only where the plate is big enough for a line of text.
    /// A name per plate stacks every level of one chain into the same few pixels — the tiler gives
    /// a plate an 8-point header whatever its depth — and a column of overlapping words is less
    /// readable than no words. The cuts are measures beside the one surface that reads them rather
    /// than tokens (`rules/swift.md`): they are what a name needs, not rhythm steps.
    private func names(of plan: AtlasPlan) -> some View {
        let named = plan.plates.filter {
            $0.depth <= 1 && $0.rect.width > 120 && $0.rect.height > 48
        }
        return ForEach(named, id: \.path) { plate in
            Text(plate.name)
                .argoText(ArgoTypography.caption)
                .foregroundStyle(argo.color.text.secondary)
                .lineLimit(1)
                .frame(width: plate.rect.width - ArgoSpacing.base, alignment: .leading)
                .position(x: plate.rect.midX, y: plate.rect.minY + ArgoSpacing.snug)
        }
    }

    /// The three plate tones in depth order, the deepest repeated past three — which is the rule
    /// the materials family states rather than an arithmetic of this view's.
    private func tone(at depth: Int) -> ArgoColor {
        let tones = argo.color.atlas.materials.plates
        return tones[min(depth, tones.count - 1)].color
    }

    /// Absent is not zero: a file carrying no value for the banded Measure is drawn in the grey
    /// that belongs to nothing, never in the quiet band, which would make it the calmest thing on
    /// the map rather than the unmeasured one.
    private func pigment(of band: AtlasBand?) -> ArgoColor {
        switch band {
        case .quiet: argo.color.atlas.measure.quiet
        case .middling: argo.color.atlas.measure.middling
        case .hot: argo.color.atlas.measure.hot
        case nil: argo.color.atlas.materials.unassigned
        }
    }
}
