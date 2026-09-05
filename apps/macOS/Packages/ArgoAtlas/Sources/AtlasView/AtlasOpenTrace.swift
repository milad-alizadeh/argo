import ArgoDesign
import AtlasLayout
import SwiftUI

/// The open file, marked on the map (#1154).
///
/// **Focus never repaints the thing it marks.** The colour on this map IS the measure, so marking
/// a file by recolouring it would destroy the fact the reader opened it to inspect. The whole mark
/// is its own edges: the volume traced, and held for as long as it is open.
///
/// SwiftUI over the Metal surface rather than in the shader, for `AtlasPlateNames`' reason turned
/// round — the GPU draws faces, and a hairline along a projected silhouette is the one thing a
/// triangle rasteriser has no cheap answer for. The geometry is `AtlasTrace`, which reads the same
/// camera and the same fit the surface hands the GPU, so the mark cannot land where the volume is
/// not.
struct AtlasOpenTrace: View {
    @Environment(\.argo) private var argo

    /// The same projection the surface underneath was drawn with, which is the whole of why the
    /// mark cannot land where the volume is not.
    let projection: AtlasProjection
    /// The file the reader has open, or nothing — in which case nothing is drawn, which is what
    /// makes closing the reading unmark the map.
    let open: String?

    var body: some View {
        Canvas { context, _ in
            guard let trace else { return }
            for stroke in trace.strokes {
                context.stroke(
                    Self.path(of: stroke),
                    with: .color(argo.color.text.primary.color),
                    style: StrokeStyle(lineWidth: ArgoStroke.indicator, lineJoin: .round),
                )
            }
        }
        // The map is under it, and a click on the trace is a click on the file it traces: taking
        // the mouse here would put a hole in the city exactly where the reader is looking.
        .allowsHitTesting(false)
        .frame(width: projection.viewport.width, height: projection.viewport.height)
    }

    /// The traced tile, seen through the camera the map is drawn with — or nothing where no file
    /// is open, or where the open file is not on the map the reader is looking at. The second is
    /// the case a filter makes: hiding test files takes tiles off the plan, and a mark for one of
    /// them would stand over whatever moved into its place.
    private var trace: AtlasTrace? {
        guard let open, let tile = projection.plan.tiles.first(where: { $0.path == open }) else {
            return nil
        }
        return AtlasTrace(of: risen(tile), through: projection)
    }

    /// The tile at the height it is STANDING at this frame, which is its measured height once the
    /// rise has settled and a share of it while the city is still coming up. The same curve the
    /// shader climbs the box on, read at the same place — the box's own middle, in plan points —
    /// and off the same projection, which is why the mark cannot be drawn at a height the box is
    /// not standing at.
    private func risen(_ tile: AtlasTile) -> AtlasTile {
        let rise = AtlasRise(clock: projection.rise, over: projection.plan.extent)
        let middle = SIMD2<Float>(Float(tile.rect.midX), Float(tile.rect.midY))
        let centre = SIMD2<Float>(
            Float(projection.camera.centre.x),
            Float(projection.camera.centre.y),
        )
        let growth = rise.growth(at: rise.distance(of: middle, from: centre))
        return AtlasTile(
            path: tile.path,
            rect: tile.rect,
            band: tile.band,
            height: tile.height * CGFloat(growth),
        )
    }

    private static func path(of stroke: [CGPoint]) -> Path {
        Path { path in
            guard let first = stroke.first else { return }
            path.move(to: first)
            for point in stroke.dropFirst() {
                path.addLine(to: point)
            }
        }
    }
}
