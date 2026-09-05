import ArgoDesign
@testable import AtlasLayout
@testable import AtlasView
import CoreGraphics
import Metal

/// One frame of the map, rendered offscreen: the picture, and the file id at every pixel of it
/// (#1153).
///
/// It renders through `AtlasVolumeRenderer.encode` — the SAME encode the cockpit's own surface
/// draws with — because a harness that built an encoder of its own would be checking a picture the
/// app never draws, and the claim under test is about the picture the app draws.
///
/// `nil` from `frame(of:through:)` where the machine has no Metal device or the shader never
/// compiled. That is a skip, not a failure: the suite runs on Linux CI too, where neither exists.
@MainActor
struct AtlasPickHarness {
    let renderer: AtlasVolumeRenderer
    private let queue: MTLCommandQueue
    private let colour: MTLTexture
    private let ids: MTLTexture
    private let depth: MTLTexture

    /// Whether this machine can render at all: a Metal device, and a shader that compiled into the
    /// bundle. Both are absent on the Linux runner and either can be absent on a Mac without the
    /// Metal Toolchain, and a suite that FAILED there would be reporting a machine as a defect.
    /// Read once, because it builds a pipeline to find out.
    nonisolated static let isAvailable = AtlasVolumeRenderer.isSupported

    /// How big a frame is rendered. Small on purpose: the claim is per pixel and holds at any
    /// size, and a suite that rendered a window's worth would spend its time in the blit back.
    static let size = (width: 200, height: 150)

    /// ONE sample, where the app draws at four (#1400).
    ///
    /// It is the only footing the claim has. Multisampled, an edge pixel is a blend of two boxes
    /// and the picture has no single file at it — the id still names a box that is really there,
    /// but "the file resolved at a point IS the file drawn at that point" stops being an equality
    /// and becomes a judgement about which of two. At one sample it is an equality again, and an
    /// equality is what a sweep of twenty-five cameras can hold without a tolerance.
    ///
    /// What this cannot see is the count itself, so `AtlasIdSamplingTests` asserts separately that
    /// the id attachment follows the renderer's — the one thing that silently stops the pass from
    /// drawing at all.
    static let samples = 1

    /// What the pass draws into when it is multisampled, and nothing at one sample. The picture is
    /// resolved out of it by the hardware, which a COLOUR may be and an id may not — that asymmetry
    /// is the whole reason `atlas_id_resolve` exists.
    private let multisampled: (colour: MTLTexture, depth: MTLTexture)?

    init?(samples: Int = AtlasPickHarness.samples) {
        guard let renderer = AtlasVolumeRenderer(pixelFormat: .bgra8Unorm, samples: samples),
              let queue = renderer.device.makeCommandQueue(),
              let colour = Self.texture(.bgra8Unorm, on: renderer.device, storage: .managed),
              let depth = Self.texture(
                  AtlasVolumeRenderer.depthFormat,
                  on: renderer.device,
                  storage: .private,
                  samples: samples,
              )
        else { return nil }
        if samples > 1 {
            guard let target = Self.texture(
                .bgra8Unorm, on: renderer.device, storage: .private, samples: samples,
            ) else { return nil }
            self.multisampled = (colour: target, depth: depth)
        } else {
            self.multisampled = nil
        }
        // The id attachment is the renderer's own, built at the renderer's own sample count: the
        // harness never makes one, because a harness that sized it itself would be testing its own
        // arithmetic rather than the app's.
        guard let ids = renderer.idAttachment(
            sized: MTLSize(width: Self.size.width, height: Self.size.height, depth: 1),
        ) else { return nil }
        self.renderer = renderer
        self.queue = queue
        self.colour = colour
        self.ids = ids
        self.depth = depth
    }

    private static func texture(
        _ format: MTLPixelFormat,
        on device: MTLDevice,
        storage: MTLStorageMode,
        samples: Int = 1,
    )
        -> MTLTexture? {
        let descriptor = MTLTextureDescriptor.texture2DDescriptor(
            pixelFormat: format, width: size.width, height: size.height, mipmapped: false,
        )
        if samples > 1 {
            descriptor.textureType = .type2DMultisample
            descriptor.sampleCount = samples
        }
        descriptor.usage = [.renderTarget]
        descriptor.storageMode = storage
        return device.makeTexture(descriptor: descriptor)
    }

    /// One map through one camera, drawn and read back. The plan is framed into the harness's own
    /// size, which is what `AtlasSurface` does with the room's.
    func frame(
        of city: AtlasCity,
        plan: AtlasPlan,
        through camera: AtlasCamera,
    )
        async -> AtlasFrame? {
        let fit = AtlasFit(framing: plan, through: camera, into: plan.extent)
        renderer.show(city, through: AtlasEye(camera, fit: fit))

        let descriptor = MTLRenderPassDescriptor()
        descriptor.colorAttachments[0].texture = multisampled?.colour ?? colour
        descriptor.colorAttachments[0].loadAction = .clear
        // The picture IS resolved by the hardware, because averaging colours is what a resolve is
        // for. Its ids are not, and cannot be.
        descriptor.colorAttachments[0].resolveTexture = multisampled == nil ? nil : colour
        descriptor.colorAttachments[0].storeAction = multisampled == nil
            ? .store
            : .multisampleResolve
        // The desktop, which is what the view clears to as well: a pixel on no box has to read as
        // the ground rather than as an accident of whatever the texture held.
        descriptor.colorAttachments[0].clearColor = ArgoPalette.graphite.atlas.materials.desktop
            .clearColor
        descriptor.depthAttachment.texture = depth
        descriptor.depthAttachment.loadAction = .clear
        descriptor.depthAttachment.storeAction = .dontCare
        descriptor.depthAttachment.clearDepth = 1

        guard let buffer = queue.makeCommandBuffer(),
              renderer.encode(into: descriptor, ids: ids, on: buffer)
        else { return nil }
        // The app's own resolve, not a second one written here: it is what picks a sample of the
        // ids and brings them back, and a harness that did its own would be checking itself.
        renderer.resolveIds(in: buffer)
        guard let blit = buffer.makeBlitCommandEncoder() else { return nil }
        blit.synchronize(resource: colour)
        blit.endEncoding()
        buffer.commit()
        Self.wait(on: buffer)
        // The id target learns the frame has landed from a completion handler that hops to the main
        // actor. Metal has already called that handler by the time the wait above returns, but the
        // hop is a `Task`, and a test that never suspends never lets one run — so this is where it
        // runs, and why this method is `async` at all.
        await Task.yield()

        return AtlasFrame(colour: Self.read(colour, bytesPerPixel: 4))
    }

    /// The file the APP would answer with at this pixel — `AtlasVolumeRenderer.pick`, the same call
    /// a hover makes, reading the same resolved ids. Nothing in the test reads the id texture.
    ///
    /// Nil where no frame has landed, which is a harness failure rather than an answer.
    func pick(at pixel: AtlasPixel) -> AtlasPick? {
        renderer.pick(atPixel: pixel)
    }

    /// The block, out of line. `waitUntilCompleted` is unavailable directly from an async context —
    /// rightly, since it parks a thread — and a harness rendering one small frame at a time is the
    /// case the rule is not about.
    nonisolated private static func wait(on buffer: MTLCommandBuffer) {
        buffer.waitUntilCompleted()
    }

    private static func read(_ texture: MTLTexture, bytesPerPixel: Int) -> [UInt8] {
        var bytes = [UInt8](repeating: 0, count: size.width * size.height * bytesPerPixel)
        bytes.withUnsafeMutableBytes { raw in
            guard let base = raw.baseAddress else { return }
            texture.getBytes(
                base,
                bytesPerRow: size.width * bytesPerPixel,
                from: MTLRegionMake2D(0, 0, size.width, size.height),
                mipmapLevel: 0,
            )
        }
        return bytes
    }
}
