import AppKit
import ArgoDesign
import ArgoEngine

/// Decoded pictures, held between the surfaces that draw them and bounded by what a window can
/// show (ADR-0028 Rule 4).
///
/// The working set is the thumbnails one window can hold at once, and one window of scrollback
/// behind it so a scroll up and back re-draws rather than re-decodes. No whole-feed walk reaches
/// this — a shot settles its provenance off its signature (`MediaDecode.isPicture`), which reads
/// nothing and holds nothing — so the working set is what is actually drawn, and the ceiling
/// derives from the window and the display rather than from a count of entries.
///
/// This is now the ONLY place a picture's pixels live. The event stream holds an address
/// (`MediaBytes`), so what a Session's pictures cost is what this cache is allowed to hold, whether
/// one Session is being read or thirty (#989).
///
/// On the main actor, so the store needs no locking of its own and no value crosses a domain to
/// reach it. Every surface that draws a picture is a view; the one thing that is not — a shot
/// settling its provenance — no longer comes here.
///
/// The store is `MediaStore` and not `NSCache`, which holds nothing it has promised to hold
/// (#1001).
@MainActor
final class MediaCache {
    /// The one the app draws through. Tests build their own, because a process-wide cache shared
    /// between parallel cases is a cache each of them can evict the others out of.
    static let shared = MediaCache(costLimit: costLimit(scale: MediaScale.display))

    private let entries: MediaStore

    init(costLimit: Int) {
        self.entries = MediaStore(costLimit: costLimit)
    }

    var costLimit: Int {
        entries.costLimit
    }

    /// The picture for one run — held where what is held is dense enough for the box asking, and
    /// otherwise read off the file and decoded off the main actor.
    ///
    /// Only plates are held: `.full` is the largest bitmap in the app and the one surface that
    /// wants it has a single picture open at a time.
    func bitmap(for bytes: MediaBytes, in box: MediaBox) async -> MediaBitmap? {
        let held = held(bytes)
        if let held, held.box.covers(box) {
            return held
        }
        // The union rather than the box asked for: the two plates in the app cover neither from
        // the other and share one key, so a decode for the box alone would evict the surface it
        // was standing beside (`MediaBox.union`).
        let wanted = held.map { $0.box.union(box) } ?? box
        // Two surfaces asking for one picture in the same frame both miss and both decode, where
        // the synchronous version could not. One extra plate, once, against an in-flight table
        // that would have to be reaped: a plate is about a millisecond and the full frame — the
        // 25 ms one — has a single surface with one picture open at a time.
        guard let bitmap = await Self.decoded(bytes, in: wanted) else { return nil }
        if case .plate = wanted {
            entries.set(bitmap, for: bytes.identity)
        }
        return bitmap
    }

    /// Whatever is already held for one run, at whatever box it was made for, reading and decoding
    /// nothing. What a surface can draw the frame it appears in, and what the lightbox stands in
    /// while its own full frame is being made.
    func held(_ bytes: MediaBytes) -> MediaBitmap? {
        entries.object(for: bytes.identity)
    }

    /// The same store, reached by a key that is not a byte run's signature — the web address a
    /// markdown image NAMES (`MarkdownPictures`, #1412). One ceiling and not two: a second store
    /// the same size beside this one would double what the app may hold in pictures, which is the
    /// number ADR-0028 Rule 4 exists to bound.
    ///
    /// The key is the caller's whole namespace to keep apart. A signature is 32 base64 characters
    /// and an address is a URL, so the two cannot collide.
    func held(key: String) -> MediaBitmap? {
        entries.object(for: key)
    }

    /// File a picture the caller decoded itself, under its own key. `MarkdownPictures` fetches its
    /// bytes rather than reading them off disk, so it does its own decode and hands the result
    /// here to be held.
    func keep(_ picture: MediaBitmap, for key: String) {
        entries.set(picture, for: key)
    }

    /// One picture read and decoded, off the main actor and held by nobody. 25 ms for a 2560 × 1600
    /// capture, measured, which is a frame and a half of the lightbox's fade — run on the main
    /// thread it stalled the fade's first frames and read as a flash. The READ in front of it is
    /// one seek and the picture's own bytes, which is why it is not worth a budget of its own.
    ///
    /// `nonisolated` and nothing else. In Swift 6 language mode without
    /// `NonisolatedNonsendingByDefault` that already runs on the generic executor, so the
    /// `Task.detached` this used to wrap bought no thread and cost the one thing that mattered:
    /// a detached child inherits no cancellation, so a lightbox dismissed mid-decode went on
    /// holding the whole `Data` and the full `NSImage` until the decode finished.
    nonisolated static func decoded(_ bytes: MediaBytes, in box: MediaBox) async -> MediaBitmap? {
        guard !Task.isCancelled, let data = mediaData(at: bytes) else { return nil }
        return MediaDecode.bitmap(from: data, in: box, scale: MediaScale.display)
    }

    /// What one pixel of a decoded picture costs: 8-bit RGBA.
    nonisolated static let bytesPerPixel = 4
    /// How many window-fuls of thumbnails are held: the one being read, and one behind it.
    nonisolated static let windowfuls = 2

    /// What the cache may hold, in bytes: every pixel of the window Argo opens at, `windowfuls`
    /// times over, at the density the display draws them.
    ///
    /// Only the BITMAPS are counted. A key is now an ADDRESS rather than a picture — a path, an
    /// offset and a length (#989) — so charging an entry for one would shrink the usable cache to
    /// account for bytes no eviction could reclaim, none of which is a picture.
    nonisolated static func costLimit(scale: CGFloat) -> Int {
        let pixels = ArgoLayout.windowIdealWidth * scale * ArgoLayout.windowIdealHeight * scale
        return Int(pixels) * bytesPerPixel * windowfuls
    }
}
