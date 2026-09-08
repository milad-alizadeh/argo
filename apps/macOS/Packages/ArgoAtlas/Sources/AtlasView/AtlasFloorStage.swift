import Metal

/// The table the city stands on (#1600): the graded ground with its vignette, and the light laid
/// on the floor — each plate's own, and the contour grid over them.
///
/// Both go into the SAME render pass the boxes do, before them. A second pass would resolve the
/// multisampled picture twice. The grain is not here at all: it is spent on each surface's own
/// finished pixel, and `atlas_grain` in `AtlasVolume.metal` says why.
///
/// Every way this can fail is a `nil` from `init`, as it is for the renderer that owns it: a
/// library missing one of these functions leaves the map drawing its boxes with no table under
/// them, which is the picture #1600 found shipped.
///
/// AT REST IT COSTS NOTHING, because at rest nothing is drawn: the view is paused and redraws on
/// demand (`AtlasSurface`). `AtlasTableTests` measures that the way the prototype did — pixels
/// changed at rest.
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

    /// One quad as two triangles, which is both passes here: the drawable, or one patch of floor.
    private static let quad = 6

    private let device: MTLDevice
    private let grounding: MTLRenderPipelineState
    private let lighting: MTLRenderPipelineState
    /// Neither depth-tested nor depth-writing: the floor is under everything, so it is placed by
    /// the ORDER it is encoded in. A floor that wrote depth would be a plane the boxes standing on
    /// it have to argue with.
    private let ignoringDepth: MTLDepthStencilState

    /// The patches the floor is lit by. Written on the CITY's clock rather than the frame's —
    /// `AtlasCityCache` decides when — so the allocation is paid when the map moves and never per
    /// drag frame, which is the cost #1598 took off the boxes.
    ///
    /// Not private: `AtlasTableTests` reads what the floor is holding across a drag, which is the
    /// only way to say from outside that a drag rewrites no floor.
    private(set) var laid: MTLBuffer?
    private(set) var patches = 0

    init?(device: MTLDevice, library: MTLLibrary, pixelFormat: MTLPixelFormat, samples: Int) {
        let depth = MTLDepthStencilDescriptor()
        depth.depthCompareFunction = .always
        depth.isDepthWriteEnabled = false

        // One descriptor, both pipelines: everything but the two functions and the blend is the
        // pass's own, and a pipeline that disagreed with the pass would not draw at all (#1400).
        let descriptor = MTLRenderPipelineDescriptor()
        descriptor.colorAttachments[0].pixelFormat = pixelFormat
        // The ids belong to the BOXES and to nothing else: the floor is not a place on the map, so
        // a pixel of it keeps the 0 the pass cleared the target to — the desktop's own answer
        // (#1153).
        descriptor.colorAttachments[1].pixelFormat = AtlasIdTarget.format
        descriptor.colorAttachments[1].writeMask = []
        descriptor.depthAttachmentPixelFormat = AtlasVolumeRenderer.depthFormat
        descriptor.rasterSampleCount = samples

        guard let grounding = Self.state(Self.ground, from: library, on: device, into: descriptor),
              let lighting = Self.state(Self.light, from: library, on: device, into: descriptor),
              let ignoringDepth = device.makeDepthStencilState(descriptor: depth)
        else { return nil }
        self.device = device
        self.grounding = grounding
        self.lighting = lighting
        self.ignoringDepth = ignoringDepth
    }

    /// The light this floor is lit by next. Empty leaves the ground drawn and the grid and the
    /// plates' light not — a real state, for a map that has no plates.
    func show(_ patches: [AtlasFloorPatch]) {
        guard !patches.isEmpty else {
            laid = nil
            self.patches = 0
            return
        }
        let written = patches.withUnsafeBytes { raw in
            raw.baseAddress.flatMap {
                device.makeBuffer(bytes: $0, length: raw.count, options: .storageModeShared)
            }
        }
        laid = written
        self.patches = written == nil ? 0 : patches.count
    }

    /// The table, under the boxes. The camera and the floor are pushed here and read again by the
    /// boxes' own draw, encoded after this into the same encoder — one binding of each per frame.
    func table(
        in encoder: MTLRenderCommandEncoder,
        eye: inout AtlasEye,
        ground: inout AtlasGround,
    ) {
        encoder.setDepthStencilState(ignoringDepth)
        encoder.setRenderPipelineState(grounding)
        encoder.setVertexBytes(&eye, length: MemoryLayout<AtlasEye>.stride, index: 1)
        // Index 4: the volume stage's own lighting sits at 2 and its rise at 3, and both are bound
        // into this same encoder a draw later. One slot each is what keeps the two from depending
        // on the order they happen to be pushed in.
        encoder.setVertexBytes(&ground, length: MemoryLayout<AtlasGround>.stride, index: 4)
        encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: Self.quad)
        guard let laid, patches > 0 else { return }
        encoder.setRenderPipelineState(lighting)
        encoder.setVertexBuffer(laid, offset: 0, index: 0)
        encoder.drawPrimitives(
            type: .triangle, vertexStart: 0, vertexCount: Self.quad, instanceCount: patches,
        )
    }

    private static func state(
        _ pass: AtlasFloorPass,
        from library: MTLLibrary,
        on device: MTLDevice,
        into descriptor: MTLRenderPipelineDescriptor,
    )
        -> MTLRenderPipelineState? {
        guard let vertex = library.makeFunction(name: pass.vertex),
              let fragment = library.makeFunction(name: pass.fragment)
        else { return nil }
        descriptor.vertexFunction = vertex
        descriptor.fragmentFunction = fragment
        pass.blend.apply(to: descriptor.colorAttachments[0])
        return try? device.makeRenderPipelineState(descriptor: descriptor)
    }
}
