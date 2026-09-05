import ArgoDesign
import AtlasLayout
import MetalKit
import SwiftUI

/// The SwiftUI seam the Metal renderer is hosted in (#1147).
///
/// It takes a projection and resolved pigments rather than reading the environment, so the one
/// thing that decides what the GPU is handed is this view's parameters — the same rule every other
/// view here follows, and the only way the volumes can be built once and asserted on.
struct AtlasSurface: NSViewRepresentable {
    /// The plan, the camera over it, and the fit between them — one value, so the fit the shader
    /// draws with is the fit everything drawn OVER it reads (`AtlasProjection`).
    let projection: AtlasProjection
    let pigments: AtlasPigments
    /// The file under the pointer, said as the pointer moves and said as `nil` the moment it is
    /// over none (#1153). A closure rather than a binding, because the answer is read off a frame
    /// the GPU has already drawn: it arrives on a mouse event, not on a view update.
    var resolve: (String?) -> Void = { _ in }
    /// The file the reader CLICKED, or none where they clicked the ground (#1154). Read off the
    /// same id target and answered against the same frame as the hover, so the file that opens is
    /// the one drawn under the cursor rather than the one nearest it.
    var pick: (String?) -> Void = { _ in }

    func makeCoordinator() -> AtlasPointer {
        AtlasPointer(renderer: AtlasVolumeRenderer(pixelFormat: .bgra8Unorm))
    }

    func makeNSView(context: Context) -> MTKView {
        let view = AtlasMapView(frame: .zero, device: context.coordinator.renderer?.device)
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
        view.sampleCount = context.coordinator.renderer?.sampleCount ?? 1
        // The drawable is colour-matched to sRGB, which is the space `ArgoColor`'s components are
        // in. Left nil it would be UNMANAGED, and the window server would read the shader's numbers
        // in the display's own space — on a P3 Mac, which is every current one, a green file would
        // render more saturated than the same band drawn in the legend beside it. That would break
        // the one promise the map makes about its colour: a file is the colour of its legend.
        view.colorspace = CGColorSpace(name: CGColorSpace.sRGB)
        // A still frame, drawn on demand. Nothing on this map moves at rest, and a display link
        // spinning at 120 Hz over a city nobody is touching is a battery cost with no picture
        // to show for it.
        //
        // It stays paused through the rise (#1421) and through the flip: both are animated by
        // `AtlasView`'s `animatableData`, so SwiftUI re-runs the body once per frame and
        // `apply(to:coordinator:)` below marks the view dirty each time. The frames come from the
        // animation rather than from a clock this view owns, which is what leaves "nothing on
        // this map moves at rest" true with nothing to switch back off when the rise ends.
        view.isPaused = true
        view.enableSetNeedsDisplay = true
        view.delegate = context.coordinator
        context.coordinator.attach(view)
        view.moved = { [coordinator = context.coordinator] point in coordinator.moved(to: point) }
        view.clicked = { [coordinator = context.coordinator] point in
            coordinator.clicked(at: point)
        }
        apply(to: view, coordinator: context.coordinator)
        return view
    }

    /// The map is pushed on every update, not captured at construction. SwiftUI does not rebuild a
    /// coordinator when a representable's stored properties change, so a surface that baked its
    /// plan in would keep drawing the old one through an appearance change — and through the very
    /// next caller that passes a second map.
    func updateNSView(_ view: MTKView, context: Context) {
        apply(to: view, coordinator: context.coordinator)
    }

    private func apply(to view: MTKView, coordinator: AtlasPointer) {
        // The answer's owner is pushed alongside the map, for the reason the map is: a closure
        // captured once would go on writing the state of a body two renders old.
        coordinator.resolve = resolve
        coordinator.picked = pick
        // The projection is framed into the plan's own extent rather than the drawable's size,
        // because that is what `AtlasView` frames the surface at — and it is the shape the flat
        // camera has to be given for its picture to be the treemap exactly.
        coordinator.renderer?.show(
            AtlasVolumes.city(of: projection.plan, in: pigments),
            through: AtlasEye(projection.camera, fit: projection.fit),
            rising: AtlasRise(projection),
        )
        view.clearColor = pigments.desktop.clearColor
        // `needsDisplay`, not `setNeedsDisplay(_:)`: the first update lands before layout, when the
        // view's bounds are still zero, and invalidating an empty rect marks nothing dirty.
        // The answer under the pointer changed with the map, but it cannot be re-read HERE: the
        // line above only marks the view dirty, and the id target still holds the frame before.
        // `AtlasPointer` re-reads once the redraw has actually happened.
        view.needsDisplay = true
    }
}
