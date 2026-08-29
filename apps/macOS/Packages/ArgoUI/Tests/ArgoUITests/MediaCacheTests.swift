import AppKit
import ArgoEngine
@testable import ArgoUI
import Testing

/// What holding a decoded picture costs, and what bounds how many are held (#962, ADR-0028 Rule 4).
///
/// Every case builds its OWN cache. The app's is process-wide, and cases run in parallel: two
/// sharing one would evict each other and the identity claims below would flake on a busy box.
/// The byte runs are 1200-wide and up, a range no other suite reaches into.
@Suite("Holding decoded pictures")
@MainActor
struct MediaCacheTests {
    private static let plate = CGSize(width: 168, height: 112)
    /// A 1200 × 900 source covering that plate at 2× is 336 × 252 pixels of RGBA.
    private static let plateCost = 336 * 252 * 4

    @Test
    func `no cache of pictures is unbounded`() {
        #expect(MediaCache.shared.costLimit > 0)
    }

    @Test
    func `the bound follows the display the pictures are drawn on`() {
        // Twice the scale is four times the pixels, so a bound that tracks the display doubles
        // twice over. One that stopped tracking it comes out equal.
        #expect(MediaCache.costLimit(scale: 2) == MediaCache.costLimit(scale: 1) * 4)
    }

    @Test
    func `a picture costs its pixels, and the bytes it is filed under cost nothing`() throws {
        let bytes = try MediaFixture.base64(width: 1200, height: 900)
        let data = try #require(Data(base64Encoded: bytes))
        let bitmap = try #require(MediaDecode.bitmap(from: data, in: .plate(Self.plate), scale: 2))

        #expect(bitmap.cost == Self.plateCost)
        // `NSCache` retains its keys, but bridging a native Swift `String` hands over the SAME
        // storage rather than a copy — twice over gives one object — and the base64 is already
        // held for the session by `MediaEvidence.bytes`. Charging an entry for its key would
        // measure memory no eviction can reclaim.
        #expect((bytes as NSString) === (bytes as NSString))
    }

    @Test
    func `a bitmap with no representation at all is not held for free`() {
        let bitmap = MediaBitmap(
            image: NSImage(),
            header: MediaHeader(pixels: nil, points: .zero),
            box: .full,
        )

        // Cost zero is an entry eviction can never choose, however long it sits there.
        #expect(bitmap.drawn == .zero)
        #expect(bitmap.cost > 0)
    }

    @Test
    func `a cache walked past its ceiling holds no more pixels than its ceiling`() throws {
        let cache = MediaCache(costLimit: Self.plateCost * 4)
        let runs = try (0 ..< 40).map { try MediaFixture.base64(width: 1200 + $0, height: 900) }
        for bytes in runs {
            _ = cache.bitmap(for: bytes, in: .plate(Self.plate))
        }

        // Resident PIXELS, counted here rather than through `MediaBitmap.cost`, so a cost that
        // understated an entry could not also understate the reading that checks it.
        #expect(Self.residentPixelBytes(of: runs, in: cache) <= cache.costLimit)
        // And it is the ceiling doing that, not a decode that quietly failed: the same forty under
        // a ceiling with room for them all are all still there.
        let roomy = MediaCache(costLimit: Self.plateCost * 80)
        for bytes in runs {
            _ = roomy.bitmap(for: bytes, in: .plate(Self.plate))
        }
        #expect(runs.count { roomy.held($0) != nil } == runs.count)
    }

    @Test
    func `one byte run is decoded once for the plate that draws it`() throws {
        let cache = MediaCache(costLimit: Self.plateCost * 4)
        let bytes = try MediaFixture.base64(width: 1245, height: 905)
        let first = try #require(cache.bitmap(for: bytes, in: .plate(Self.plate)))
        let second = try #require(cache.bitmap(for: bytes, in: .plate(Self.plate)))

        #expect(first === second)
    }

    @Test
    func `a held plate is never handed to the surface asking for full pixels`() throws {
        let cache = MediaCache(costLimit: Self.plateCost * 4)
        let bytes = try MediaFixture.base64(width: 1246, height: 906)
        let plate = try #require(cache.bitmap(for: bytes, in: .plate(Self.plate)))
        let full = try #require(cache.bitmap(for: bytes, in: .full))

        #expect(full !== plate)
        #expect(full.drawn == CGSize(width: 1246, height: 906))
        // And the full frame did not take the plate's place: it is the largest bitmap in the app
        // and the surface that asked has one open at a time.
        #expect(cache.held(bytes) === plate)
    }

    @Test
    func `a held decode too coarse for a larger plate is decoded again`() throws {
        let cache = MediaCache(costLimit: Self.plateCost * 40)
        let bytes = try MediaFixture.base64(width: 1247, height: 907)
        let small = try #require(cache.bitmap(for: bytes, in: .plate(Self.plate)))
        let large = try #require(
            cache.bitmap(for: bytes, in: .plate(CGSize(width: 600, height: 400))),
        )

        #expect(large.drawn.width > small.drawn.width)
    }

    @Test
    func `the two plates the app draws cover neither each other nor their union`() {
        let column = MediaBox.plate(EvidenceMedia.plate)
        let shot = MediaBox.plate(ArgoFeedRow.shotPlate)

        // The panel bounds width alone and the gallery bounds both, so componentwise neither is
        // the denser decode — which is why one key holding one of them is not enough.
        #expect(!column.covers(shot))
        #expect(!shot.covers(column))
        #expect(column.union(shot).covers(column))
        #expect(column.union(shot).covers(shot))
    }

    @Test
    func `one byte run shown in both plates stops re-decoding after the second`() throws {
        let cache = MediaCache(costLimit: Self.plateCost * 40)
        let bytes = try MediaFixture.base64(width: 1248, height: 908)
        let column = MediaBox.plate(EvidenceMedia.plate)
        let shot = MediaBox.plate(ArgoFeedRow.shotPlate)

        _ = try #require(cache.bitmap(for: bytes, in: column))
        let both = try #require(cache.bitmap(for: bytes, in: shot))

        // The second decode is made for the box covering BOTH, so the alternation settles. Filed
        // under the box asked for instead, each miss overwrites the other's entry and every
        // alternation is a fresh decode.
        #expect(try #require(cache.bitmap(for: bytes, in: column)) === both)
        #expect(try #require(cache.bitmap(for: bytes, in: shot)) === both)
    }

    @Test
    func `a full frame nobody is waiting for any more is never decoded`() async throws {
        let bytes = try MediaFixture.base64(width: 1249, height: 909)

        // `Task.detached` inherited no cancellation, so a lightbox dismissed mid-decode went on
        // holding the whole `Data` and the full `NSImage` until the decode finished.
        let decode = Task { await MediaCache.fullBitmap(for: bytes) }
        decode.cancel()

        #expect(await decode.value == nil)
    }

    @Test
    func `a full frame is decoded off the main actor`() async {
        // What `MediaCache.fullBitmap` rests on: a `nonisolated` async function in this language
        // mode runs on the generic executor, which is why it needs no `Task.detached` to leave the
        // main thread. Turning on `NonisolatedNonsendingByDefault` would take that away silently.
        #expect(await Self.runsOnTheMainThread() == false)
    }

    /// `pthread_main_np` rather than `Thread.isMainThread`, which Foundation withholds from an
    /// asynchronous context — the exact context the question is about.
    nonisolated private static func runsOnTheMainThread() async -> Bool {
        pthread_main_np() != 0
    }

    /// What the surviving entries actually occupy, from their own pixel counts.
    private static func residentPixelBytes(of runs: [String], in cache: MediaCache) -> Int {
        runs.compactMap { cache.held($0) }
            .map { Int($0.drawn.width * $0.drawn.height) * 4 }
            .reduce(0, +)
    }
}
