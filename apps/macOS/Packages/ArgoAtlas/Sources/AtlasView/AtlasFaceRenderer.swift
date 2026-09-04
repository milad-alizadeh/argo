import MetalKit

/// Draws `AtlasFace.metal`'s rectangles into an `MTKView` (#1147).
///
/// Every way this can fail is a `nil` from `init`, not a crash and not a `try!`: a machine with no
/// Metal device, a build whose shader never compiled, a library missing the functions. `AtlasView`
/// answers all three the same way — it shows the ground and nothing standing on it — because the
/// map's floor is a real state the app already renders, and a renderer that trapped would take the
/// whole cockpit down over a surface nobody had opened.
@MainActor
final class AtlasFaceRenderer: NSObject, MTKViewDelegate {
    let device: MTLDevice
    private let queue: MTLCommandQueue
    private let pipeline: MTLRenderPipelineState

    /// The ground the faces are placed on, and the faces themselves. Pushed by `AtlasSurface` on
    /// every update rather than fixed at construction; the reason is stated there.
    private var ground = AtlasGround(.zero)
    private var faces: MTLBuffer?
    private var faceCount = 0

    /// `pixelFormat` is taken rather than read off a view: a pipeline is compiled against one
    /// format, and building it before the view exists is what keeps the failure here.
    init?(pixelFormat: MTLPixelFormat) {
        guard let device = MTLCreateSystemDefaultDevice(),
              let queue = device.makeCommandQueue(),
              let library = try? device.makeDefaultLibrary(bundle: Bundle.module),
              let vertex = library.makeFunction(name: "atlas_face_vertex"),
              let fragment = library.makeFunction(name: "atlas_face_fragment")
        else { return nil }

        let descriptor = MTLRenderPipelineDescriptor()
        descriptor.vertexFunction = vertex
        descriptor.fragmentFunction = fragment
        descriptor.colorAttachments[0].pixelFormat = pixelFormat
        guard let pipeline = try? device.makeRenderPipelineState(descriptor: descriptor) else {
            return nil
        }

        self.device = device
        self.queue = queue
        self.pipeline = pipeline
        super.init()
    }

    /// The map to draw next. The buffer is rebuilt here rather than per frame: the view is paused
    /// and draws on demand, so a frame is a redraw of a map that did not change and copying the
    /// whole city into a fresh allocation to redraw it would be work with no picture to show.
    func show(_ faces: [AtlasFace], on ground: AtlasGround) {
        self.ground = ground
        faceCount = faces.count
        self.faces = faces.isEmpty ? nil : device.makeBuffer(
            bytes: faces,
            length: MemoryLayout<AtlasFace>.stride * faces.count,
        )
    }

    func mtkView(_: MTKView, drawableSizeWillChange _: CGSize) {}

    func draw(in view: MTKView) {
        guard let faces, faceCount > 0,
              let descriptor = view.currentRenderPassDescriptor,
              let drawable = view.currentDrawable,
              let buffer = queue.makeCommandBuffer(),
              let encoder = buffer.makeRenderCommandEncoder(descriptor: descriptor)
        else { return }

        encoder.setRenderPipelineState(pipeline)
        encoder.setVertexBuffer(faces, offset: 0, index: 0)
        // `setVertexBytes` for the ground: two floats are far under the 4 KB the method takes, and
        // a buffer nothing outlives the encoder is a lifetime to get wrong.
        encoder.setVertexBytes(&ground, length: MemoryLayout<AtlasGround>.stride, index: 1)
        // One instanced draw for the whole map, in the order `AtlasFaces` painted them: a nested
        // plate over the one it stands on, and the files over the plate they stand on.
        encoder.drawPrimitives(
            type: .triangleStrip,
            vertexStart: 0,
            vertexCount: 4,
            instanceCount: faceCount,
        )
        encoder.endEncoding()
        buffer.present(drawable)
        buffer.commit()
    }
}
