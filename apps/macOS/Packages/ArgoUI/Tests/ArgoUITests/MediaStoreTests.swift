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
    private static func bitmap(pixels side: Int) throws -> MediaBitmap {
        let representation = try #require(NSBitmapImageRep(
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
        ))
        let image = NSImage(size: .zero)
        image.addRepresentation(representation)
        return MediaBitmap(
            image: image, header: MediaHeader(pixels: nil, points: .zero), box: .plate(.zero),
        )
    }

    private static let side = 8
    private static func oneCost() throws -> Int {
        try bitmap(pixels: side).cost
    }

    /// The claim #1001 found red: what was filed is still there. An `NSCache` empties itself on a
    /// memory-pressure notification, so this held only while the machine was quiet.
    @Test
    func `a picture filed under a roomy ceiling is still held`() throws {
        let store = try MediaStore(costLimit: Self.oneCost() * 4)
        let picture = try Self.bitmap(pixels: Self.side)

        store.set(picture, for: "one")

        #expect(store.object(for: "one") === picture)
    }

    /// The other half of it: forty under a ceiling with room for eighty are ALL still there. This
    /// is the assertion that came back 0 of 40.
    @Test
    func `every picture fitting under the ceiling is kept`() throws {
        let store = try MediaStore(costLimit: Self.oneCost() * 80)
        let keys = (0 ..< 40).map(String.init)

        for key in keys {
            try store.set(Self.bitmap(pixels: Self.side), for: key)
        }

        #expect(keys.count { store.object(for: $0) != nil } == keys.count)
    }

    /// The ceiling is exact and it is Argo's, so a walk past it is bounded by arithmetic rather
    /// than by a policy the docs call a hint.
    @Test
    func `a store walked past its ceiling holds no more than its ceiling`() throws {
        let store = try MediaStore(costLimit: Self.oneCost() * 4)

        for key in 0 ..< 40 {
            try store.set(Self.bitmap(pixels: Self.side), for: String(key))
        }

        #expect(store.totalCost <= store.costLimit)
        #expect(store.totalCost > 0)
    }

    /// The running total is what the store actually holds, walked afresh. A ceiling case alone is
    /// satisfied by a total that has drifted DOWNWARDS, which is the half of a charge-and-refund
    /// mistake that starves the cache instead of unbounding it.
    @Test
    func `the running total is what the surviving entries cost`() throws {
        let one = try Self.oneCost()
        let store = MediaStore(costLimit: one * 4)
        let keys = (0 ..< 40).map(String.init)

        for key in keys {
            try store.set(Self.bitmap(pixels: Self.side), for: key)
        }

        #expect(store.totalCost == keys.count { store.object(for: $0) != nil } * one)
    }

    /// Which one goes when room is needed: the one nobody has read. A scroll up and back re-draws
    /// rather than re-decodes only if reading an entry is what keeps it.
    @Test
    func `the picture nobody has read is the one dropped`() throws {
        let store = try MediaStore(costLimit: Self.oneCost() * 2)
        try store.set(Self.bitmap(pixels: Self.side), for: "read")
        try store.set(Self.bitmap(pixels: Self.side), for: "never read")

        _ = store.object(for: "read")
        try store.set(Self.bitmap(pixels: Self.side), for: "new")

        #expect(store.object(for: "read") != nil)
        #expect(store.object(for: "never read") == nil)
    }

    /// Filing the same key twice is one entry, not two — otherwise a byte run re-decoded for a
    /// larger plate would be charged for both and the ceiling would count memory nobody holds.
    @Test
    func `filing one key twice charges for one picture`() throws {
        let one = try Self.oneCost()
        let store = MediaStore(costLimit: one * 4)
        let second = try Self.bitmap(pixels: Self.side)

        try store.set(Self.bitmap(pixels: Self.side), for: "one")
        store.set(second, for: "one")

        #expect(store.totalCost == one)
        #expect(store.object(for: "one") === second)
    }

    /// No plate reaches that size — a plate is bounded by the surface it is drawn in — so this is
    /// a floor under the arithmetic rather than a live path.
    @Test
    func `a picture larger than the whole ceiling is not held`() throws {
        let store = try MediaStore(costLimit: Self.oneCost() * 2)

        try store.set(Self.bitmap(pixels: Self.side * 4), for: "huge")

        #expect(store.object(for: "huge") == nil)
        #expect(store.totalCost == 0)
    }

    /// And it gives nothing up trying: emptying the store to fail at it anyway would cost the
    /// caller every plate it still had, this key's own included — a coarser decode is still one a
    /// surface can draw.
    @Test
    func `a picture too large to hold evicts nothing`() throws {
        let store = try MediaStore(costLimit: Self.oneCost() * 2)
        let neighbour = try Self.bitmap(pixels: Self.side)
        let incumbent = try Self.bitmap(pixels: Self.side)
        store.set(neighbour, for: "neighbour")
        store.set(incumbent, for: "same key")

        try store.set(Self.bitmap(pixels: Self.side * 4), for: "same key")

        #expect(store.object(for: "neighbour") === neighbour)
        #expect(store.object(for: "same key") === incumbent)
    }
}
