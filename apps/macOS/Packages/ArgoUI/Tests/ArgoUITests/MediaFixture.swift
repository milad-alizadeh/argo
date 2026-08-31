import AppKit
import ArgoEngine
import ImageIO
import Testing
import UniformTypeIdentifiers

/// Real picture bytes at a stated size. Made rather than checked in, so the dimensions an
/// assertion reads are the ones written beside it.
enum MediaFixture {
    /// `drawnAt` is how many pixels the file claims per point, written into its header as a
    /// resolution — 2 is what `screencapture` writes on a Retina Mac.
    static func png(width: Int, height: Int, drawnAt scale: Int = 1) throws -> Data {
        let representation = try plane(width: width, height: height)
        representation.size = NSSize(
            width: CGFloat(width) / CGFloat(scale),
            height: CGFloat(height) / CGFloat(scale),
        )
        return try #require(representation.representation(using: .png, properties: [:]))
    }

    /// A JPEG whose header says which way up it is. 6 is a quarter turn, so AppKit draws it
    /// `height` across — the case every dimension in `MediaDecode` has to agree about.
    static func oriented(width: Int, height: Int, orientation: Int) throws -> Data {
        try encoded(width: width, height: height, [kCGImagePropertyOrientation: orientation])
    }

    /// A TIFF with a different resolution on each axis — a scan, and the case a single DPI reading
    /// gets wrong in one direction only.
    static func resolved(width: Int, height: Int, dpiWide: Double, dpiHigh: Double) throws -> Data {
        try encoded(width: width, height: height, [
            kCGImagePropertyDPIWidth: dpiWide,
            kCGImagePropertyDPIHeight: dpiHigh,
        ], as: .tiff)
    }

    static func media(width: Int, height: Int) throws -> MediaEvidence {
        try MediaEvidence(
            tier: .direct,
            mediaType: "image/png",
            bytes: .held(png(width: width, height: height).base64EncodedString()),
        )
    }

    static func base64(width: Int, height: Int) throws -> String {
        try png(width: width, height: height).base64EncodedString()
    }

    /// One run, HELD rather than addressed: the cache and decode suites are about pixels, and a
    /// fixture has no transcript to be a byte range of.
    static func bytes(width: Int, height: Int) throws -> MediaBytes {
        try .held(base64(width: width, height: height))
    }

    /// A picture that does NOT compress: a cleared plane encodes to a few kilobytes whatever its
    /// dimensions, which would hide the very cost a ratio case is asking about.
    static func noisyBase64(width: Int, height: Int) throws -> String {
        let representation = try plane(width: width, height: height, noisy: true)
        return try #require(representation.representation(using: .png, properties: [:]))
            .base64EncodedString()
    }

    private static func encoded(
        width: Int,
        height: Int,
        _ properties: [CFString: Any],
        as type: UTType = .jpeg,
    )
        throws -> Data {
        let image = try #require(plane(width: width, height: height).cgImage)
        let bytes = NSMutableData()
        let destination = try #require(CGImageDestinationCreateWithData(
            bytes, type.identifier as CFString, 1, nil,
        ))
        CGImageDestinationAddImage(destination, image, properties as CFDictionary)
        #expect(CGImageDestinationFinalize(destination))
        return bytes as Data
    }

    private static func plane(
        width: Int,
        height: Int,
        noisy: Bool = false,
    )
        throws -> NSBitmapImageRep {
        let representation = try #require(NSBitmapImageRep(
            bitmapDataPlanes: nil,
            pixelsWide: width,
            pixelsHigh: height,
            bitsPerSample: 8,
            samplesPerPixel: 4,
            hasAlpha: true,
            isPlanar: false,
            colorSpaceName: .deviceRGB,
            bytesPerRow: 0,
            bitsPerPixel: 0,
        ))
        // Freshly allocated planes hold whatever was in that memory, and noise encodes to a PNG
        // several megabytes wide. Cleared, the fixture is small and the same every run.
        if let plane = representation.bitmapData {
            let count = representation.bytesPerRow * representation.pixelsHigh
            plane.update(repeating: 0, count: count)
            if noisy {
                var state: UInt64 = 0x2545_F491_4F6C_DD1D
                for index in 0 ..< count {
                    state = state &* 6_364_136_223_846_793_005 &+ 1_442_695_040_888_963_407
                    plane[index] = UInt8(truncatingIfNeeded: state >> 33)
                }
            }
        }
        return representation
    }
}
