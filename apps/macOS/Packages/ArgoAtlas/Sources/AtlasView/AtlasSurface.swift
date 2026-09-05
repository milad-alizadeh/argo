import ArgoDesign
import AtlasLayout
import MetalKit
import SwiftUI

/// The SwiftUI seam the Metal renderer is hosted in (#1147).
///
/// It takes a plan, a camera and resolved pigments rather than reading the environment, so the one
/// thing that decides what the GPU is handed is this view's parameters — the same rule every other
/// view here follows, and the only way the volumes can be built once and asserted on.
struct AtlasSurface: NSViewRepresentable {
    let plan: AtlasPlan
    let camera: AtlasCamera
    let pigments: AtlasPigments

    func makeCoordinator() -> AtlasVolumeRenderer? {
        AtlasVolumeRenderer(pixelFormat: .bgra8Unorm)
    }

    func makeNSView(context: Context) -> MTKView {
        let view = MTKView(frame: .zero, device: context.coordinator?.device)
        view.colorPixelFormat = .bgra8Unorm
        // The city is ordered by a depth buffer rather than by a sort, so the view has to carry
        // one: without the attachment the pass has nothing to test against and every tower draws
        // over whatever it was handed after.
        view.depthStencilPixelFormat = AtlasVolumeRenderer.depthFormat
        view.clearDepth = 1
        // Taken from the renderer rather than named again here: the pipeline was compiled at the
        // count the DEVICE agreed to, and a view that set a different one would hand that pipeline
        // a pass it cannot draw into. Setting it makes `MTKView` allocate the multisample colour
        // and depth textures and resolve them into the drawable itself, which is the whole of the
        // work — nothing in the pass or the shader knows the difference.
        view.sampleCount = context.coordinator?.sampleCount ?? 1
        // The drawable is colour-matched to sRGB, which is the space `ArgoColor`'s components are
        // in. Left nil it would be UNMANAGED, and the window server would read the shader's numbers
        // in the display's own space — on a P3 Mac, which is every current one, a green file would
        // render more saturated than the same band drawn in the legend beside it. That would break
        // the one promise the map makes about its colour: a file is the colour of its legend.
        view.colorspace = CGColorSpace(name: CGColorSpace.sRGB)
        // A still frame, drawn on demand. Nothing on this map moves at rest, and a display link
        // spinning at 120 Hz over a city nobody is touching is a battery cost with no picture
        // to show for it.
        view.isPaused = true
        view.enableSetNeedsDisplay = true
        view.delegate = context.coordinator
        apply(to: view, renderer: context.coordinator)
        return view
    }

    /// The map is pushed on every update, not captured at construction. SwiftUI does not rebuild a
    /// coordinator when a representable's stored properties change, so a surface that baked its
    /// plan in would keep drawing the old one through an appearance change — and through the very
    /// next caller that passes a second map.
    func updateNSView(_ view: MTKView, context: Context) {
        apply(to: view, renderer: context.coordinator)
    }

    private func apply(to view: MTKView, renderer: AtlasVolumeRenderer?) {
        // Framed into the plan's own extent rather than the drawable's size, because that is what
        // `AtlasView` frames the surface at — and it is the shape the flat camera has to be given
        // for its picture to be the treemap exactly.
        let fit = AtlasFit(framing: plan, through: camera, into: plan.extent)
        renderer?.show(
            AtlasVolumes.volumes(of: plan, in: pigments),
            through: AtlasEye(camera, fit: fit),
        )
        view.clearColor = pigments.desktop.clearColor
        // `needsDisplay`, not `setNeedsDisplay(_:)`: the first update lands before layout, when the
        // view's bounds are still zero, and invalidating an empty rect marks nothing dirty.
        view.needsDisplay = true
    }
}
