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

    /// How many samples a pixel is resolved from. Every edge in this picture is a box's own
    /// silhouette against whatever stands behind it — there is no texture and no wireframe to hide
    /// a staircase in — so at one sample a roof's diagonal far edge is drawn as a run of whole
    /// pixels, and a city of a few thousand of them reads as ragged rather than as flat quads
    /// (#1400). Four is the count every Metal device on this platform supports; `sampleCount(on:)`
    /// asks the device rather than assuming, for the reason every other failure here is a `nil`.
    nonisolated static let preferredSampleCount = 4

    /// What this device will actually resolve a pixel from. `AtlasSamplingTests` is what holds it
    /// to `preferredSampleCount`.
    nonisolated static func sampleCount(on device: MTLDevice) -> Int {
        device.supportsTextureSampleCount(preferredSampleCount) ? preferredSampleCount : 1
    }

    let device: MTLDevice
    /// What this device actually gave, which is what the view and the pipeline both have to be
    /// built at: a pass whose attachments and pipeline disagree on the count does not draw.
    let sampleCount: Int
    private let queue: MTLCommandQueue
    private let pipeline: MTLRenderPipelineState
    private let depth: MTLDepthStencilState

    /// The camera and the boxes, pushed by `AtlasSurface` on every update rather than fixed at
    /// construction; the reason is stated there.
    private var eye: AtlasEye?
    private var volumes: MTLBuffer?
    private var volumeCount = 0
    /// Where the city is in its climb out of the plates (#1421). Pushed with the camera and the
    /// map, because it changes on the same clock they do — and `settled` until one is, so a
    /// renderer nobody has told about a rise draws the measured heights rather than nothing.
    private var rise = AtlasRise.settled
    /// Which file each drawn id names. Held here, beside the buffer it was drawn from, so a pick
    /// can never be resolved against a map the picture is not of (#1153).
    private var city = AtlasCity.empty

    /// The second attachment of every draw: the id per pixel, and what a pick reads (#1153).
    private let ids: AtlasIdTarget

    /// Whether this machine can draw the map at all: a Metal device, and this package's shader
    /// compiled into its own bundle. The same two `init` fails on, asked without building a
    /// pipeline — and `nonisolated`, because the one caller is a suite trait, evaluated before
    /// there is a main actor to ask on (`AtlasPickHarness`).
    nonisolated static var isSupported: Bool {
        guard let device = MTLCreateSystemDefaultDevice(), let library = library(on: device)
        else { return false }
        return library.makeFunction(name: "atlas_volume_vertex") != nil
    }

    /// `AtlasVolume.metal`, however this build has it.
    ///
    /// Xcode compiles it into the target's `default.metallib`, which is what the shipped app loads.
    /// SwiftPM does not compile Metal at all — the manifest says so — and carries the SOURCE in the
    /// bundle instead, so a `swift test` binary and a Mac with no Metal Toolchain compile it here,
    /// at runtime, out of the same file. That is what lets `AtlasPickingTests` render the map the
    /// app renders rather than a second drawing of it written in Swift; without it the one claim
    /// #1153 makes could only be asserted by a suite that skipped itself.
    nonisolated private static func library(on device: MTLDevice) -> MTLLibrary? {
        if let compiled = try? device.makeDefaultLibrary(bundle: Bundle.module) {
            return compiled
        }
        guard let url = Bundle.module.url(forResource: "AtlasVolume", withExtension: "metal"),
              let source = try? String(contentsOf: url, encoding: .utf8)
        else { return nil }
        return try? device.makeLibrary(source: source, options: nil)
    }

    /// Three quads a box — the roof and the two walls that face the reader — as a triangle list.
    static let verticesPerVolume = 18

    /// `pixelFormat` is taken rather than read off a view: a pipeline is compiled against one
    /// format, and building it before the view exists is what keeps the failure here.
    convenience init?(pixelFormat: MTLPixelFormat) {
        guard let device = MTLCreateSystemDefaultDevice() else { return nil }
        self.init(pixelFormat: pixelFormat, samples: Self.sampleCount(on: device))
    }

    /// The same renderer at a stated sample count.
    ///
    /// The seam exists for one test and says so: at one sample a pixel is covered by exactly one
    /// box, which is the only footing on which "the file resolved at a point is the file DRAWN at
    /// that point" can be checked pixel for pixel. Multisampled, an edge pixel is a blend of two
    /// boxes and the picture has no single file at it to compare an id against — the id still names
    /// a box that is really there (`atlas_id_resolve`), but the claim stops being an equality.
    /// `AtlasPickingTests` runs the sweep here; `AtlasSamplingTests` is what holds the app to the
    /// device's own count.
    init?(pixelFormat: MTLPixelFormat, samples: Int) {
        guard let device = MTLCreateSystemDefaultDevice(),
              let queue = device.makeCommandQueue(),
              let library = Self.library(on: device),
              let vertex = library.makeFunction(name: "atlas_volume_vertex"),
              let fragment = library.makeFunction(name: "atlas_volume_fragment"),
              let ids = AtlasIdTarget(device: device, library: library, samples: samples)
        else { return nil }

        let descriptor = MTLRenderPipelineDescriptor()
        descriptor.vertexFunction = vertex
        descriptor.fragmentFunction = fragment
        descriptor.colorAttachments[0].pixelFormat = pixelFormat
        // The id, written by the same fragment stage as the colour. One pass and two attachments,
        // never two passes: a second pass would rasterise the city a second time, and a second
        // coverage rule is what a pick drifts against (#1153).
        descriptor.colorAttachments[1].pixelFormat = AtlasIdTarget.format
        descriptor.depthAttachmentPixelFormat = Self.depthFormat
        descriptor.rasterSampleCount = samples

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
        self.sampleCount = samples
        self.ids = ids
        super.init()
    }

    /// The map to draw next. The buffer is rebuilt here rather than per frame: the view is paused
    /// and draws on demand, so a frame is a redraw of a map that did not change and copying the
    /// whole city into a fresh allocation to redraw it would be work with no picture to show.
    func show(_ city: AtlasCity, through eye: AtlasEye, rising rise: AtlasRise = .settled) {
        self.eye = eye
        self.city = city
        self.rise = rise
        volumeCount = city.volumes.count
        volumes = city.volumes.isEmpty ? nil : device.makeBuffer(
            bytes: city.volumes,
            length: MemoryLayout<AtlasVolume>.stride * city.volumes.count,
        )
    }

    /// The file drawn at one pixel of the drawable, or NO file, or no answer yet (#1153).
    ///
    /// No file is an answer, not a failure: the desktop, a plate, a folder's rim and a cast shadow
    /// all read as no file, because none of them IS one. Nothing here searches for a near miss —
    /// "rather than to the nearest" is the acceptance criterion, and the only way to keep it is to
    /// read the one pixel that was asked about.
    ///
    /// The id and the roster it is read against are BOTH held here, so a pick can never be resolved
    /// against a map the picture is not of.
    func pick(atPixel pixel: AtlasPixel) -> AtlasPick? {
        guard let id = ids.id(at: pixel) else { return nil }
        return AtlasPick(file: city.file(at: id))
    }

    /// What to call once a frame's ids can be read. One caller, `AtlasPointer`, and it is the only
    /// thing that ever re-reads them — which is what leaves no path that can ask a target the GPU
    /// has not finished writing.
    func whenIdsSettle(_ settled: @escaping () -> Void) {
        ids.settled = settled
    }

    func mtkView(_: MTKView, drawableSizeWillChange _: CGSize) {}

    func draw(in view: MTKView) {
        guard let descriptor = view.currentRenderPassDescriptor,
              let drawable = view.currentDrawable,
              let buffer = queue.makeCommandBuffer()
        else { return }

        // The id attachment is the drawable's OWN size, so a pixel of the picture and a pixel of
        // the ids are one pixel with no scaling between them to get wrong. Cleared to 0, which is
        // what leaves a point on no box resolving to nothing rather than to the nearest.
        let size = MTLSize(
            width: drawable.texture.width,
            height: drawable.texture.height,
            depth: 1,
        )
        guard encode(into: descriptor, ids: idAttachment(sized: size), on: buffer) else { return }
        resolveIds(in: buffer)
        buffer.present(drawable)
        buffer.commit()
    }

    /// The id attachment for a drawable of this size, at THIS renderer's own sample count — which
    /// is the count the pass is built at, and a pass whose attachments disagree with it does not
    /// draw at all (#1400).
    ///
    /// Named rather than left inside `draw`, because `AtlasPickHarness` renders offscreen through
    /// the same one: nothing anywhere sizes an id target but this, so no test can be checking its
    /// own arithmetic instead of the app's.
    func idAttachment(sized size: MTLSize) -> MTLTexture? {
        ids.attachment(sized: size)
    }

    /// Pick one sample of this frame's ids and bring them back where a pick can read them.
    func resolveIds(in buffer: MTLCommandBuffer) {
        ids.drawn(in: buffer)
    }

    /// The whole map, encoded into one pass of two attachments: the picture, and which file each
    /// of its pixels is (#1153).
    ///
    /// One encode, shared by the view and by the tests that render the same city offscreen and
    /// compare the two attachments pixel for pixel. That sharing is the claim — a test rendering
    /// through a second encoder of its own would be checking a picture the app never draws.
    ///
    /// `false` where there is nothing to draw: a map with no boxes, a camera never pushed, or a
    /// drawable too small to have an id target. Nothing encoded, and the caller presents no frame.
    @discardableResult
    func encode(
        into descriptor: MTLRenderPassDescriptor,
        ids target: MTLTexture?,
        on buffer: MTLCommandBuffer,
    )
        -> Bool {
        guard let volumes, var eye, volumeCount > 0, let target else { return false }

        descriptor.colorAttachments[1].texture = target
        descriptor.colorAttachments[1].loadAction = .clear
        descriptor.colorAttachments[1].storeAction = .store
        descriptor.colorAttachments[1].clearColor = MTLClearColor(
            red: 0, green: 0, blue: 0, alpha: 0,
        )

        guard let encoder = buffer.makeRenderCommandEncoder(descriptor: descriptor) else {
            return false
        }
        encoder.setRenderPipelineState(pipeline)
        encoder.setDepthStencilState(depth)
        encoder.setVertexBuffer(volumes, offset: 0, index: 0)
        // `setVertexBytes` for the camera and the light: a dozen floats each are far under the
        // 4 KB the method takes, and a buffer nothing outlives the encoder is a lifetime to get
        // wrong. The light never depends on the camera, so it is solved once and shared here
        // rather than rebuilt per draw.
        encoder.setVertexBytes(&eye, length: MemoryLayout<AtlasEye>.stride, index: 1)
        var lighting = AtlasLighting.city
        encoder.setVertexBytes(&lighting, length: MemoryLayout<AtlasLighting>.stride, index: 2)
        // The clock the city is standing up on, on the same terms (#1421): three floats, and one
        // value for the whole draw — every box works its own phase out of it against where it
        // stands, so a staggered rise costs the instance buffer nothing either.
        var rise = rise
        encoder.setVertexBytes(&rise, length: MemoryLayout<AtlasRise>.stride, index: 3)
        // One instanced draw for the whole map, in the order `AtlasVolumes` painted them: a nested
        // plate over the one it stands on, and the files over the plate they stand on. What the
        // order cannot settle — a near tower over a far plate — the depth buffer does. The id
        // attachment costs this draw nothing extra: it is a second write of a fragment stage that
        // already ran, so picking follows the WINDOW rather than the file count.
        encoder.drawPrimitives(
            type: .triangle,
            vertexStart: 0,
            vertexCount: Self.verticesPerVolume,
            instanceCount: volumeCount,
        )
        encoder.endEncoding()
        return true
    }
}
