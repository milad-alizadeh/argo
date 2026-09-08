import Metal

/// The one tile of noise the grain is spent from (#1600).
///
/// Large smooth gradients on a near-black ground band in 8-bit, and the grain is what keeps them
/// smooth. It is a tile read one texel a pixel rather than per-box work, and it is built ONCE — the
/// design's own lives in its static layer for the same reason, so a still frame is still still.
///
/// The values come off a FIXED seed. A tile that differed between two runs would be a picture that
/// differed between two runs, and "nothing moves at rest" would stop being a claim anybody could
/// measure.
enum AtlasGrain {
    /// How wide the tile is, in pixels of the drawable: the design's own 96.
    ///
    /// Device pixels rather than points, which is a step finer than where the design's canvas tile
    /// lands after its own scale. Banding is a per-device-pixel fact, so that is the grid a dither
    /// belongs on.
    static let width = 96

    /// The range one texel is drawn from, of 255: the design's `118 + random() * 74`. Centred a
    /// little above half, which is the ~1% lift the overlay puts on the whole picture.
    static let range: ClosedRange<UInt8> = 118 ... 191

    /// The tile's bytes, from the fixed seed. A plain linear congruential generator read off its
    /// high bits: nothing here needs a good random number, it needs the SAME numbers every run.
    static func noise() -> [UInt8] {
        var state: UInt64 = 0x9E37_79B9_7F4A_7C15
        let span = UInt64(range.upperBound - range.lowerBound) + 1
        return (0 ..< width * width).map { _ in
            state = state &* 6_364_136_223_846_793_005 &+ 1_442_695_040_888_963_407
            return UInt8(UInt64(range.lowerBound) + (state >> 33) % span)
        }
    }

    /// The tile on the GPU, or nothing where the device refuses it — which the floor answers the
    /// way every other absence here is answered: the grain is not drawn, and the picture is the
    /// picture without it.
    static func texture(on device: MTLDevice) -> MTLTexture? {
        let descriptor = MTLTextureDescriptor.texture2DDescriptor(
            pixelFormat: .r8Unorm, width: width, height: width, mipmapped: false,
        )
        descriptor.usage = [.shaderRead]
        // The one storage mode every Mac this app runs on can both write and hand to the GPU, the
        // same reading `AtlasIdTarget` makes of it.
        descriptor.storageMode = .managed
        guard let texture = device.makeTexture(descriptor: descriptor) else { return nil }
        texture.replace(
            region: MTLRegionMake2D(0, 0, width, width),
            mipmapLevel: 0,
            withBytes: noise(),
            bytesPerRow: width,
        )
        return texture
    }
}
