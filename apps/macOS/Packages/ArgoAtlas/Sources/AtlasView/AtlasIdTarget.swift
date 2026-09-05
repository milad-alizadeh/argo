import Metal

/// The second attachment of the map's own draw: one file id per pixel, and the one pixel a reader
/// asked about read back out of it (#1153).
///
/// **An id buffer cannot disagree with the screen, because it is the screen.** It is sized to the
/// drawable, cleared to 0 — nothing — and written by the same fragment stage that writes the
/// colour, under the same depth test and at the same sample count. Nothing here re-derives the
/// projection, which is the whole point: every hit-test defect the prototype had was a pick
/// resolving against a camera the frame was not drawn with, and there is no second camera in this
/// file to drift.
///
/// **Two textures once the city is multisampled** (#1400). The attachment has to match the pass's
/// sample count or the pass does not draw at all, and a multisample texture cannot be read by the
/// CPU — nor resolved, because Metal's resolve averages and the average of two file ids is a third
/// file. So `atlas_id_resolve` picks a sample rather than blending them, into the one texture the
/// CPU can read. That is not a second coverage rule: coverage was decided once, by the one draw,
/// and every sample it picks between is a box genuinely covering that pixel.
///
/// The readable copy is `.managed`, the one storage mode every Mac this app runs on can both write
/// and synchronise back. The cost is a resolve and a blit of a texture the size of the map per
/// frame, which is a fixed price — it follows the window, never the file count (#1153's "picking
/// cost does not scale with the file count").
@MainActor
final class AtlasIdTarget {
    /// One id per pixel, unsigned and unfiltered. Not a colour: an id put through an 8-bit
    /// normalised format would run out at 255 files and round on the way back.
    static let format = MTLPixelFormat.r32Uint

    /// Called once the ids of a frame have landed and can be read. The answer under the pointer
    /// changed with the picture, and this is what says the picture is finally there to be asked —
    /// so nothing anywhere blocks the main actor waiting for the GPU.
    var settled: () -> Void = {}

    private let device: MTLDevice
    /// How many samples the pass draws at, which the attachment must match exactly.
    private let samples: Int
    /// Picks one sample of the attachment into `readable`. Nil at one sample, where the attachment
    /// IS the readable texture and there is nothing to pick between.
    private let resolve: MTLComputePipelineState?

    /// What the pass draws ids into. Multisampled and private past one sample.
    private var attachment: MTLTexture?
    /// What the CPU reads. The same texture as `attachment` at one sample.
    private var readable: MTLTexture?

    /// Whether `readable` holds a frame that finished drawing. False from the moment a draw is
    /// committed until it completes, and false again the moment the window resizes new textures
    /// into existence — a fresh texture's contents are undefined, and undefined bytes read back as
    /// an id would name a real file at a point that has never been drawn.
    private var isSettled = false

    /// Nil where the resolve kernel is missing from the library past one sample: the same answer
    /// `AtlasVolumeRenderer.init` gives for every other way Metal can be absent, and it degrades
    /// the same way — the map draws its floor rather than a picture nothing can be picked out of.
    init?(device: MTLDevice, library: MTLLibrary, samples: Int) {
        self.device = device
        self.samples = samples
        guard samples > 1 else {
            self.resolve = nil
            return
        }
        guard let kernel = library.makeFunction(name: "atlas_id_resolve"),
              let pipeline = try? device.makeComputePipelineState(function: kernel)
        else { return nil }
        self.resolve = pipeline
    }

    /// The target to draw this frame's ids into, grown to the drawable if the window moved.
    /// Nothing for a zero-sized drawable, which is what the first update before layout hands over.
    func attachment(sized size: MTLSize) -> MTLTexture? {
        guard size.width > 0, size.height > 0 else { return nil }
        if let attachment, attachment.width == size.width, attachment.height == size.height {
            return attachment
        }
        attachment = texture(size, samples: samples)
        readable = samples > 1 ? texture(size, samples: 1) : attachment
        isSettled = false
        return attachment
    }

    private func texture(_ size: MTLSize, samples: Int) -> MTLTexture? {
        let descriptor = MTLTextureDescriptor.texture2DDescriptor(
            pixelFormat: Self.format,
            width: size.width,
            height: size.height,
            mipmapped: false,
        )
        if samples > 1 {
            descriptor.textureType = .type2DMultisample
            descriptor.sampleCount = samples
            // Never read by the CPU and never resolved by the hardware: the kernel reads it, so it
            // stays where the GPU put it.
            descriptor.usage = [.renderTarget, .shaderRead]
            descriptor.storageMode = .private
        } else {
            descriptor.usage = resolve == nil ? [.renderTarget] : [.shaderWrite]
            descriptor.storageMode = .managed
        }
        return device.makeTexture(descriptor: descriptor)
    }

    /// The frame the ids now belong to: one sample of it picked, and brought back where the CPU can
    /// read it.
    ///
    /// A managed texture is TWO copies, and neither a render pass nor a kernel writes the CPU's;
    /// without the blit `getBytes` returns whatever that side last held, which on a discrete GPU is
    /// the frame before — a pick one camera behind the picture, which is the exact defect this
    /// mechanism exists to remove.
    ///
    /// The wait for it is a HANDLER, never a `waitUntilCompleted`. This is the same command buffer
    /// that presents the drawable, so blocking on it would serialise the main actor against the GPU
    /// on every frame the pointer happens to be over the map — which is every frame of a camera
    /// drag, and exactly the cost #1153 says picking may not have.
    func drawn(in buffer: MTLCommandBuffer) {
        guard let attachment, let readable else { return }
        if let resolve, let compute = buffer.makeComputeCommandEncoder() {
            compute.setComputePipelineState(resolve)
            compute.setTexture(attachment, index: 0)
            compute.setTexture(readable, index: 1)
            compute.dispatchThreads(
                MTLSize(width: readable.width, height: readable.height, depth: 1),
                threadsPerThreadgroup: MTLSize(width: 8, height: 8, depth: 1),
            )
            compute.endEncoding()
        }
        guard let blit = buffer.makeBlitCommandEncoder() else { return }
        blit.synchronize(resource: readable)
        blit.endEncoding()
        isSettled = false
        buffer.addCompletedHandler { [weak self] _ in
            Task { @MainActor in
                self?.isSettled = true
                self?.settled()
            }
        }
    }

    /// The id at one pixel of the drawable — 0 where nothing is drawn — or NOTHING AT ALL where
    /// there is no frame to answer from yet.
    ///
    /// The two are different answers and a caller has to keep them apart: 0 is "no file is there",
    /// which a reader is owed, and `nil` is "ask again when the frame lands", which they are not.
    /// A point outside the drawable is 0 rather than nil: it is a real point of the view, and there
    /// is no file at it.
    ///
    /// One pixel, not the texture: a hover reads four bytes, whatever the map holds.
    func id(at pixel: AtlasPixel) -> UInt32? {
        guard isSettled, let readable else { return nil }
        guard pixel.x >= 0, pixel.y >= 0, pixel.x < readable.width, pixel.y < readable.height
        else { return 0 }
        var id: UInt32 = 0
        withUnsafeMutableBytes(of: &id) { bytes in
            guard let base = bytes.baseAddress else { return }
            readable.getBytes(
                base,
                bytesPerRow: MemoryLayout<UInt32>.size,
                from: MTLRegionMake2D(pixel.x, pixel.y, 1, 1),
                mipmapLevel: 0,
            )
        }
        return id
    }
}
