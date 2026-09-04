import MetalKit

/// Draws `AtlasVolume.metal`'s boxes into an `MTKView` (#1147, stood up at #1150).
///
/// Every way this can fail is a `nil` from `init`, not a crash and not a `try!`: a machine with no
/// Metal device, a build whose shader never compiled, a library missing the functions. `AtlasView`
/// answers all four the same way — it shows the ground and nothing standing on it — because the
/// map's floor is a real state the app already renders, and a renderer that trapped would take the
/// whole cockpit down over a surface nobody had opened.
@MainActor
final class AtlasVolumeRenderer: NSObject, MTKViewDelegate {
    /// What orders the city front to back. A depth buffer rather than a sort, because the order a
    /// painter would need is a walk of the tree with its siblings sorted by the camera, and the
    /// plan is two flat lists that deliberately remember no tree. Every face is opaque here, which
    /// is the whole reason the buffer is enough: the design's own painter's order is also its
    /// BLEND order, and a translucent volume would need it back (#1151 onward).
    static let depthFormat = MTLPixelFormat.depth32Float

    let device: MTLDevice
    private let queue: MTLCommandQueue
    private let pipeline: MTLRenderPipelineState
    private let depth: MTLDepthStencilState

    /// The camera and the boxes, pushed by `AtlasSurface` on every update rather than fixed at
    /// construction; the reason is stated there.
    private var eye: AtlasEye?
    private var volumes: MTLBuffer?
    private var volumeCount = 0

    /// Three quads a box — the roof and the two walls that face the reader — as a triangle list.
    static let verticesPerVolume = 18

    /// `pixelFormat` is taken rather than read off a view: a pipeline is compiled against one
    /// format, and building it before the view exists is what keeps the failure here.
    init?(pixelFormat: MTLPixelFormat) {
        guard let device = MTLCreateSystemDefaultDevice(),
              let queue = device.makeCommandQueue(),
              let library = try? device.makeDefaultLibrary(bundle: Bundle.module),
              let vertex = library.makeFunction(name: "atlas_volume_vertex"),
              let fragment = library.makeFunction(name: "atlas_volume_fragment")
        else { return nil }

        let descriptor = MTLRenderPipelineDescriptor()
        descriptor.vertexFunction = vertex
        descriptor.fragmentFunction = fragment
        descriptor.colorAttachments[0].pixelFormat = pixelFormat
        descriptor.depthAttachmentPixelFormat = Self.depthFormat

        // LESS OR EQUAL, not less. Every plate and every roof at no height is one plane at one
        // depth, and the flat camera puts the WHOLE map there; equal depths have to resolve to the
        // later draw, which is the painter's order the plan is already in.
        let depthDescriptor = MTLDepthStencilDescriptor()
        depthDescriptor.depthCompareFunction = .lessEqual
        depthDescriptor.isDepthWriteEnabled = true

        guard let pipeline = try? device.makeRenderPipelineState(descriptor: descriptor),
              let depth = device.makeDepthStencilState(descriptor: depthDescriptor)
        else { return nil }

        self.device = device
        self.queue = queue
        self.pipeline = pipeline
        self.depth = depth
        super.init()
    }

    /// The map to draw next. The buffer is rebuilt here rather than per frame: the view is paused
    /// and draws on demand, so a frame is a redraw of a map that did not change and copying the
    /// whole city into a fresh allocation to redraw it would be work with no picture to show.
    func show(_ volumes: [AtlasVolume], through eye: AtlasEye) {
        self.eye = eye
        volumeCount = volumes.count
        self.volumes = volumes.isEmpty ? nil : device.makeBuffer(
            bytes: volumes,
            length: MemoryLayout<AtlasVolume>.stride * volumes.count,
        )
    }

    func mtkView(_: MTKView, drawableSizeWillChange _: CGSize) {}

    func draw(in view: MTKView) {
        guard let volumes, var eye, volumeCount > 0,
              let descriptor = view.currentRenderPassDescriptor,
              let drawable = view.currentDrawable,
              let buffer = queue.makeCommandBuffer(),
              let encoder = buffer.makeRenderCommandEncoder(descriptor: descriptor)
        else { return }

        encoder.setRenderPipelineState(pipeline)
        encoder.setDepthStencilState(depth)
        encoder.setVertexBuffer(volumes, offset: 0, index: 0)
        // `setVertexBytes` for the camera: a dozen floats are far under the 4 KB the method takes,
        // and a buffer nothing outlives the encoder is a lifetime to get wrong.
        encoder.setVertexBytes(&eye, length: MemoryLayout<AtlasEye>.stride, index: 1)
        // One instanced draw for the whole map, in the order `AtlasVolumes` painted them: a nested
        // plate over the one it stands on, and the files over the plate they stand on. What the
        // order cannot settle — a near tower over a far plate — the depth buffer does.
        encoder.drawPrimitives(
            type: .triangle,
            vertexStart: 0,
            vertexCount: Self.verticesPerVolume,
            instanceCount: volumeCount,
        )
        encoder.endEncoding()
        buffer.present(drawable)
        buffer.commit()
    }
}
