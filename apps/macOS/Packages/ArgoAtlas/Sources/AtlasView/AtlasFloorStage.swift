import Metal

/// The three passes that make the city a lit diorama on a graded table rather than boxes on a
/// plain ground (#1600): the ground with its vignette, the light laid on the floor, and the grain
/// over the finished picture.
///
/// All three go into the SAME render pass the boxes do, in that order. A second pass would resolve
/// the multisampled picture twice, and would put the grain over a resolve rather than over the
/// samples it is meant to dither.
///
/// Every way this can fail is a `nil` from `init`, as it is for the renderer that owns it: a
/// library missing one of these functions leaves the map drawing its boxes with no table under
/// them, which is exactly the picture #1600 found shipped.
///
/// NOTHING HERE COSTS ANYTHING AT REST, because at rest nothing is drawn: the view is paused and
/// redraws on demand (`AtlasSurface`), so the ground and the grain cost a still frame what the
/// boxes cost it, which is nothing.
@MainActor
final class AtlasFloorStage {
    /// The graded ground and its vignette, in one screen-space fill.
    private static let ground = AtlasFloorPass(
        vertex: "atlas_ground_vertex", fragment: "atlas_ground_fragment", blend: .opaque,
    )

    /// Every patch of light on the floor: each plate's own, and the contour grid over them.
    private static let light = AtlasFloorPass(
        vertex: "atlas_floor_vertex", fragment: "atlas_floor_fragment", blend: .over,
    )

    /// The grain, over everything.
    private static let grain = AtlasFloorPass(
        vertex: "atlas_grain_vertex", fragment: "atlas_grain_fragment", blend: .multiply,
    )

    private let device: MTLDevice
    private let grounding: MTLRenderPipelineState
    private let lighting: MTLRenderPipelineState
    private let graining: MTLRenderPipelineState
    /// Neither depth-tested nor depth-writing: the floor is under everything and the grain is over
    /// everything, so both are placed by the ORDER they are encoded in. A floor that wrote depth
    /// would be a plane the boxes standing on it have to argue with.
    private let ignoringDepth: MTLDepthStencilState
    private let noise: MTLTexture

    /// The patches the floor is lit by. Written on the CITY's clock rather than the frame's —
    /// `AtlasCityCache` decides when — so the allocation is paid when the map moves and never per
    /// drag frame, which is the cost #1598 took off the boxes.
    private var patches: MTLBuffer?
    private var count = 0

    init?(device: MTLDevice, library: MTLLibrary, target: AtlasFloorTarget) {
        let descriptor = MTLDepthStencilDescriptor()
        descriptor.depthCompareFunction = .always
        descriptor.isDepthWriteEnabled = false
        guard let grounding = Self.state(Self.ground, on: device, from: library, into: target),
              let lighting = Self.state(Self.light, on: device, from: library, into: target),
              let graining = Self.state(Self.grain, on: device, from: library, into: target),
              let ignoringDepth = device.makeDepthStencilState(descriptor: descriptor),
              let noise = AtlasGrain.texture(on: device)
        else { return nil }
        self.device = device
        self.grounding = grounding
        self.lighting = lighting
        self.graining = graining
        self.ignoringDepth = ignoringDepth
        self.noise = noise
    }

    /// The light this floor is lit by next. Empty leaves the ground and the grain drawn and the
    /// grid and the plates' light not — a real state, for a map that has no plates.
    func show(_ patches: [AtlasFloorPatch]) {
        guard !patches.isEmpty else {
            self.patches = nil
            count = 0
            return
        }
        let written = patches.withUnsafeBytes { raw in
            raw.baseAddress.flatMap {
                device.makeBuffer(bytes: $0, length: raw.count, options: .storageModeShared)
            }
        }
        self.patches = written
        count = written == nil ? 0 : patches.count
    }

    /// The table, under the boxes: the graded ground, then every patch of light on it.
    ///
    /// The camera and the floor are pushed here and read again by the boxes' own draw, which is
    /// encoded after this into the same encoder — one binding of each per frame.
    func table(
        in encoder: MTLRenderCommandEncoder,
        eye: inout AtlasEye,
        ground: inout AtlasGround,
    ) {
        encoder.setDepthStencilState(ignoringDepth)
        encoder.setRenderPipelineState(grounding)
        encoder.setVertexBytes(&eye, length: MemoryLayout<AtlasEye>.stride, index: 1)
        // Index 4: the volume stage's own lighting sits at 2 and its rise at 3, and both are
        // bound into this same encoder a draw later. One slot each is what keeps the two from
        // depending on the order they happen to be pushed in.
        encoder.setVertexBytes(&ground, length: MemoryLayout<AtlasGround>.stride, index: 4)
        encoder.setFragmentBytes(&ground, length: MemoryLayout<AtlasGround>.stride, index: 0)
        encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: Self.quad)
        guard let patches, count > 0 else { return }
        encoder.setRenderPipelineState(lighting)
        encoder.setVertexBuffer(patches, offset: 0, index: 0)
        encoder.drawPrimitives(
            type: .triangle, vertexStart: 0, vertexCount: Self.quad, instanceCount: count,
        )
    }

    /// The grain, over the finished picture. Last thing in the pass, for the reason it is the last
    /// thing the design draws: it dithers what is already there.
    func grain(in encoder: MTLRenderCommandEncoder, ground: inout AtlasGround) {
        encoder.setDepthStencilState(ignoringDepth)
        encoder.setRenderPipelineState(graining)
        encoder.setFragmentBytes(&ground, length: MemoryLayout<AtlasGround>.stride, index: 0)
        encoder.setFragmentTexture(noise, index: 0)
        encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: Self.quad)
    }

    /// One quad as two triangles, which is every pass here: the drawable, or one patch of floor.
    private static let quad = 6

    private static func state(
        _ pass: AtlasFloorPass,
        on device: MTLDevice,
        from library: MTLLibrary,
        into target: AtlasFloorTarget,
    )
        -> MTLRenderPipelineState? {
        guard let vertex = library.makeFunction(name: pass.vertex),
              let fragment = library.makeFunction(name: pass.fragment)
        else { return nil }
        let descriptor = MTLRenderPipelineDescriptor()
        descriptor.vertexFunction = vertex
        descriptor.fragmentFunction = fragment
        descriptor.colorAttachments[0].pixelFormat = target.pixelFormat
        // The ids belong to the BOXES and to nothing else: neither the floor nor the grain is a
        // place on the map, so a pixel of either keeps whatever id the boxes left — which under
        // the floor is the 0 the pass cleared it to, the desktop's own answer (#1153).
        descriptor.colorAttachments[1].pixelFormat = AtlasIdTarget.format
        descriptor.colorAttachments[1].writeMask = []
        descriptor.depthAttachmentPixelFormat = AtlasVolumeRenderer.depthFormat
        descriptor.rasterSampleCount = target.samples
        pass.blend.apply(to: descriptor.colorAttachments[0])
        return try? device.makeRenderPipelineState(descriptor: descriptor)
    }
}
