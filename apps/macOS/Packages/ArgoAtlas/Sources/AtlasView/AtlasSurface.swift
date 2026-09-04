import ArgoDesign
import MetalKit
import SwiftUI

/// The SwiftUI seam the Metal renderer is hosted in (#1144).
///
/// It takes resolved colours rather than reading the environment, so the one thing that decides
/// what the GPU is handed is this view's parameters — the same rule every other view here follows,
/// and the only way the uniforms can be built once and asserted on.
struct AtlasSurface: NSViewRepresentable {
    let pigment: ArgoColor
    let ground: ArgoColor

    /// How much of the view the plate covers, in normalised device coordinates — 1 would fill it
    /// edge to edge and show none of the ground it stands on. A measure with no home yet: it
    /// belongs to the camera, and the camera is not this ticket.
    private static let halfExtent: Float = 0.72

    func makeCoordinator() -> AtlasQuadRenderer? {
        AtlasQuadRenderer(
            uniforms: AtlasUniforms(pigment: pigment, halfExtent: Self.halfExtent),
            pixelFormat: .bgra8Unorm,
        )
    }

    func makeNSView(context: Context) -> MTKView {
        let view = MTKView(frame: .zero, device: context.coordinator?.device)
        view.colorPixelFormat = .bgra8Unorm
        // A still frame, drawn on demand. The Atlas has nothing animating yet, and a display link
        // spinning at 120 Hz over a static plate is a battery cost with no picture to show for it.
        view.isPaused = true
        view.enableSetNeedsDisplay = true
        view.delegate = context.coordinator
        view.clearColor = ground.clearColor
        return view
    }

    func updateNSView(_ view: MTKView, context _: Context) {
        view.setNeedsDisplay(view.bounds)
    }
}
