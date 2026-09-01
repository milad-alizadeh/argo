import AppKit

/// Decoded pictures, held between the surfaces that draw them and bounded by what a window can
/// show (ADR-0028 Rule 4).
///
/// The working set is the thumbnails one window can hold at once, and one window of scrollback
/// behind it so a scroll up and back re-draws rather than re-decodes. No whole-feed walk reaches
/// this — a shot settles its provenance off the file's signature (`MediaDecode.isPicture`), which
/// decodes nothing and holds nothing — so the working set is what is actually drawn, and the
/// ceiling derives from the window and the display rather than from a count of entries.
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

    /// The picture for one byte run — decoded where none is held, or where what is held is too
    /// coarse for the box asking.
    ///
    /// The lookup is by the bytes and BEFORE the base64 decode, so a hit pays for neither. Only
    /// plates are held: `.full` is the largest bitmap in the app and the one surface that wants it
    /// has a single picture open at a time.
    func bitmap(for bytes: String, in box: MediaBox) -> MediaBitmap? {
        let held = held(bytes)
        if let held, held.box.covers(box) {
            return held
        }
        // The union rather than the box asked for: the two plates in the app cover neither from
        // the other and share one key, so a decode for the box alone would evict the surface it
        // was standing beside (`MediaBox.union`).
        let wanted = held.map { $0.box.union(box) } ?? box
        guard let data = Data(base64Encoded: bytes),
              let bitmap = MediaDecode.bitmap(from: data, in: wanted, scale: MediaScale.display)
        else { return nil }
        if case .plate = wanted {
            entries.set(bitmap, for: bytes)
        }
        return bitmap
    }

    /// Whatever is already held for one byte run, at whatever box it was made for, decoding
    /// nothing. What the lightbox draws while its own full frame is still being made.
    func held(_ bytes: String) -> MediaBitmap? {
        entries.object(for: bytes)
    }

    /// A full frame, off the main actor and never held. 25 ms for a 2560 × 1600 capture, measured,
    /// which is a frame and a half of the lightbox's fade — run on the main thread it stalled the
    /// fade's first frames and read as a flash.
    ///
    /// `nonisolated` and nothing else. In Swift 6 language mode without
    /// `NonisolatedNonsendingByDefault` that already runs on the generic executor, so the
    /// `Task.detached` this used to wrap bought no thread and cost the one thing that mattered:
    /// a detached child inherits no cancellation, so a lightbox dismissed mid-decode went on
    /// holding the whole `Data` and the full `NSImage` until the decode finished.
    nonisolated static func fullBitmap(for bytes: String) async -> MediaBitmap? {
        guard !Task.isCancelled, let data = Data(base64Encoded: bytes) else { return nil }
        return MediaDecode.bitmap(from: data, in: .full, scale: MediaScale.display)
    }

    /// What one pixel of a decoded picture costs: 8-bit RGBA.
    nonisolated static let bytesPerPixel = 4
    /// How many window-fuls of thumbnails are held: the one being read, and one behind it.
    nonisolated static let windowfuls = 2

    /// What the cache may hold, in bytes: every pixel of the window Argo opens at, `windowfuls`
    /// times over, at the density the display draws them.
    ///
    /// Only the BITMAPS are counted. The store's keys are the byte runs themselves, and a native
    /// Swift `String` held twice is one `__StringStorage` object rather than a copy — the base64 is
    /// already held for the life of the session by the event stream's own `MediaEvidence.bytes`
    /// (#989), so charging an entry for its key would measure memory no eviction can reclaim, and
    /// shrink the usable cache about sevenfold doing it.
    nonisolated static func costLimit(scale: CGFloat) -> Int {
        let pixels = ArgoLayout.windowIdealWidth * scale * ArgoLayout.windowIdealHeight * scale
        return Int(pixels) * bytesPerPixel * windowfuls
    }
}
