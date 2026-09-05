import ArgoDesign
import AtlasLayout
import SwiftUI

/// The co-change ties, drawn on the map (#1160).
///
/// The map shows how big and how bad; the cords show what moves with what — the coupling no import
/// declares. Two readings out of one counting: the strongest across the whole picture while the
/// switch is on, and the pinned file's own whatever it is set to.
///
/// Over the Metal surface rather than in the shader, for `AtlasOpenTrace`'s reason: the GPU draws
/// faces, and a curve across a projected picture is the one thing a triangle rasteriser has no
/// cheap answer for. The geometry is `AtlasCords`, which reads the same camera and the same fit
/// the surface hands the GPU, so a cord cannot land where its two files are not.
///
/// Over the model rather than into it, too: a cord that disappeared behind a tower would be a tie
/// the reader is told about from some angles and not from others.
struct AtlasTieCords: View {
    @Environment(\.argo) private var argo

    /// The same projection the surface underneath was drawn with, which is the whole of why the
    /// cords cannot land where the volumes are not.
    let projection: AtlasProjection
    /// Every tie the drawn Map carries, and whether the whole-map reading was asked for.
    let ties: AtlasTies
    /// The file the reader has pinned, whose own ties are drawn however the switch is set.
    let pinned: String?

    var body: some View {
        Canvas { context, _ in
            for drawn in AtlasCords(of: ties, pinned: pinned, through: projection).cords {
                context.stroke(
                    Self.path(of: drawn.cord),
                    with: .color(argo.color.atlas.marks.cord.color.opacity(drawn.alpha)),
                    style: StrokeStyle(lineWidth: drawn.width, lineCap: .round),
                )
            }
        }
        // The map is under it, and a click on a cord is a click on the map: taking the mouse here
        // would put a hole in the city along every tie the reader asked to see.
        .allowsHitTesting(false)
        .frame(width: projection.viewport.width, height: projection.viewport.height)
    }

    private static func path(of cord: AtlasCord) -> Path {
        Path { path in
            path.move(to: cord.start)
            path.addQuadCurve(to: cord.end, control: cord.control)
        }
    }
}
