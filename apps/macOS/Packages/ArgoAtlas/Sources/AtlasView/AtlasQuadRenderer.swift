import MetalKit

/// Draws `AtlasQuad.metal`'s one plate into an `MTKView` (#1144).
///
/// Every way this can fail is a `nil` from `init`, not a crash and not a `try!`: a machine with no
/// Metal device, a build whose shader never compiled, a library missing the functions. `AtlasView`
/// answers all three the same way — it shows the ground and nothing on it — because the map's
/// floor is a real state the app already renders, and a renderer that traps would take the whole
/// cockpit down over a surface nobody had opened.
@MainActor
final class AtlasQuadRenderer: NSObject, MTKViewDelegate {
    let device: MTLDevice
    private let queue: MTLCommandQueue
    private let pipeline: MTLRenderPipelineState
    /// Set by `AtlasSurface` on every update rather than fixed at construction, so a change of
    /// appearance or of pigment reaches the GPU.
    var uniforms = AtlasUniforms(pigment: .transparent, halfExtent: 0)

    /// `pixelFormat` is taken rather than read off a view: a pipeline is compiled against one
    /// format, and building it before the view exists is what keeps the failure here.
    init?(pixelFormat: MTLPixelFormat) {
        guard let device = MTLCreateSystemDefaultDevice(),
              let queue = device.makeCommandQueue(),
              let library = try? device.makeDefaultLibrary(bundle: Bundle.module),
              let vertex = library.makeFunction(name: "atlas_quad_vertex"),
              let fragment = library.makeFunction(name: "atlas_quad_fragment")
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

    func mtkView(_: MTKView, drawableSizeWillChange _: CGSize) {}

    func draw(in view: MTKView) {
        guard let descriptor = view.currentRenderPassDescriptor,
              let drawable = view.currentDrawable,
              let buffer = queue.makeCommandBuffer(),
              let encoder = buffer.makeRenderCommandEncoder(descriptor: descriptor)
        else { return }

        encoder.setRenderPipelineState(pipeline)
        // `setVertexBytes` rather than an `MTLBuffer`: the uniforms are well under the 4 KB the
        // method takes, and a buffer nothing outlives the encoder is a lifetime to get wrong.
        encoder.setVertexBytes(&uniforms, length: MemoryLayout<AtlasUniforms>.stride, index: 0)
        encoder.setFragmentBytes(&uniforms, length: MemoryLayout<AtlasUniforms>.stride, index: 0)
        encoder.drawPrimitives(type: .triangleStrip, vertexStart: 0, vertexCount: 4)
        encoder.endEncoding()
        buffer.present(drawable)
        buffer.commit()
    }
}
