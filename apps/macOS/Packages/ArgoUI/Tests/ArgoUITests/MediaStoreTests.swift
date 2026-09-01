import AppKit
@testable import ArgoUI
import Testing

/// The store under `MediaCache`, and the claims an `NSCache` could not make (#1001).
///
/// Every case builds its own store and its own bitmaps, so nothing here can be moved by another
/// suite in the bundle or by what the machine is doing.
@Suite("Holding decoded pictures under a ceiling Argo owns")
struct MediaStoreTests {
    /// A bitmap of a stated cost, made from a real representation so `MediaBitmap.cost` reads it
    /// off pixels rather than from anything this file asserts.
    private static func bitmap(pixels side: Int) -> MediaBitmap {
        let representation = NSBitmapImageRep(
            bitmapDataPlanes: nil,
            pixelsWide: side,
            pixelsHigh: side,
            bitsPerSample: 8,
            samplesPerPixel: 4,
            hasAlpha: true,
            isPlanar: false,
            colorSpaceName: .deviceRGB,
            bytesPerRow: 0,
            bitsPerPixel: 0,
        )
        let image = NSImage(size: .zero)
        if let representation {
            image.addRepresentation(representation)
        }
        return MediaBitmap(
            image: image, header: MediaHeader(pixels: nil, points: .zero), box: .plate(.zero),
        )
    }

    private static let side = 8
    private static var oneCost: Int {
        bitmap(pixels: side).cost
    }

    /// The claim #1001 found red: what was filed is still there. An `NSCache` empties itself on a
    /// memory-pressure notification, so this held only while the machine was quiet.
    @Test
    func `a picture filed under a roomy ceiling is still held`() {
        let store = MediaStore(costLimit: Self.oneCost * 4)
        let picture = Self.bitmap(pixels: Self.side)

        store.set(picture, for: "one")

        #expect(store.object(for: "one") === picture)
    }

    /// The other half of it: forty under a ceiling with room for eighty are ALL still there. This
    /// is the assertion that came back 0 of 40.
    @Test
    func `every picture fitting under the ceiling is kept`() {
        let store = MediaStore(costLimit: Self.oneCost * 80)
        let keys = (0 ..< 40).map(String.init)

        for key in keys {
            store.set(Self.bitmap(pixels: Self.side), for: key)
        }

        #expect(keys.count { store.object(for: $0) != nil } == keys.count)
    }

    /// The ceiling is exact and it is Argo's, so a walk past it is bounded by arithmetic rather
    /// than by a policy the docs call a hint.
    @Test
    func `a store walked past its ceiling holds no more than its ceiling`() {
        let store = MediaStore(costLimit: Self.oneCost * 4)

        for key in 0 ..< 40 {
            store.set(Self.bitmap(pixels: Self.side), for: String(key))
        }

        #expect(store.totalCost <= store.costLimit)
        #expect(store.totalCost > 0)
    }

    /// Which one goes when room is needed: the one nobody has read. A scroll up and back re-draws
    /// rather than re-decodes only if reading an entry is what keeps it.
    @Test
    func `the picture nobody has read is the one dropped`() {
        let store = MediaStore(costLimit: Self.oneCost * 2)
        store.set(Self.bitmap(pixels: Self.side), for: "cold")
        store.set(Self.bitmap(pixels: Self.side), for: "read")

        _ = store.object(for: "cold")
        store.set(Self.bitmap(pixels: Self.side), for: "new")

        #expect(store.object(for: "cold") != nil)
        #expect(store.object(for: "read") == nil)
    }

    /// Filing the same key twice is one entry, not two — otherwise a byte run re-decoded for a
    /// larger plate would be charged for both and the ceiling would count memory nobody holds.
    @Test
    func `filing one key twice charges for one picture`() {
        let store = MediaStore(costLimit: Self.oneCost * 4)
        let second = Self.bitmap(pixels: Self.side)

        store.set(Self.bitmap(pixels: Self.side), for: "one")
        store.set(second, for: "one")

        #expect(store.totalCost == Self.oneCost)
        #expect(store.object(for: "one") === second)
    }

    /// A picture that cannot fit however much is evicted is not held at all, so emptying the store
    /// for it is never the outcome. What the key held before survives too — a coarser decode is
    /// still one a surface can draw. No plate reaches that size; the arithmetic says so anyway.
    @Test
    func `a picture larger than the whole ceiling evicts nothing and is not held`() {
        let store = MediaStore(costLimit: Self.oneCost * 2)
        let kept = Self.bitmap(pixels: Self.side)
        let alsoKept = Self.bitmap(pixels: Self.side)
        store.set(kept, for: "kept")
        store.set(alsoKept, for: "same key")

        store.set(Self.bitmap(pixels: Self.side * 4), for: "huge")
        store.set(Self.bitmap(pixels: Self.side * 4), for: "same key")

        #expect(store.object(for: "huge") == nil)
        #expect(store.object(for: "kept") === kept)
        #expect(store.object(for: "same key") === alsoKept)
    }
}
