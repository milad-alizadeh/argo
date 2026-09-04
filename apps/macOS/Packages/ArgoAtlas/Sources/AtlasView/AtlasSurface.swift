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
        AtlasQuadRenderer(pixelFormat: .bgra8Unorm)
    }

    func makeNSView(context: Context) -> MTKView {
        let view = MTKView(frame: .zero, device: context.coordinator?.device)
        view.colorPixelFormat = .bgra8Unorm
        // The drawable is colour-matched to sRGB, which is the space `ArgoColor`'s components are
        // in. Left nil it would be UNMANAGED, and the window server would read the shader's numbers
        // in the display's own space — on a P3 Mac, which is every current one, the plate would
        // render more saturated than the same role drawn by SwiftUI beside it. That would break the
        // one promise `ArgoLight` makes: a lit face is the colour of its legend swatch.
        view.colorspace = CGColorSpace(name: CGColorSpace.sRGB)
        // A still frame, drawn on demand. The Atlas has nothing animating yet, and a display link
        // spinning at 120 Hz over a static plate is a battery cost with no picture to show for it.
        view.isPaused = true
        view.enableSetNeedsDisplay = true
        view.delegate = context.coordinator
        apply(to: view, renderer: context.coordinator)
        return view
    }

    /// The colours are pushed on every update, not captured at construction. SwiftUI does not
    /// rebuild a coordinator when a representable's stored properties change, so a surface that
    /// baked its pigment in would keep drawing the old one through an appearance change — and
    /// through the very next caller that passes a second plate tone.
    func updateNSView(_ view: MTKView, context: Context) {
        apply(to: view, renderer: context.coordinator)
    }

    private func apply(to view: MTKView, renderer: AtlasQuadRenderer?) {
        renderer?.uniforms = AtlasUniforms(pigment: pigment, halfExtent: Self.halfExtent)
        view.clearColor = ground.clearColor
        // `needsDisplay`, not `setNeedsDisplay(_:)`: the first update lands before layout, when the
        // view's bounds are still zero, and invalidating an empty rect marks nothing dirty.
        view.needsDisplay = true
    }
}
