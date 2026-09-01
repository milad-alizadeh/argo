import ArgoEngine
import SwiftUI

/// A media result as a surface actually shows it: the picture that decoded, and the claim the
/// surface is entitled to make about it.
///
/// One value rather than a `MediaPicture?` beside a `MediaProvenance`: both must answer to the SAME
/// decode, or a view can caption an absence "as the agent saw it".
struct MediaShowing {
    let picture: MediaPicture?
    let provenance: MediaProvenance

    private init(_ media: MediaEvidence, _ bitmap: MediaBitmap?, showing: Bool) {
        self.picture = bitmap.map(MediaPicture.init)
        self.provenance = MediaProvenance(media, showing: showing)
    }

    private init(_ provenance: MediaProvenance) {
        self.picture = nil
        self.provenance = provenance
    }

    /// Whether a picture is on its way rather than absent. The pixels are read off the file and
    /// decoded off the main actor, so there is a frame — and after an eviction, another one — where
    /// a surface knows there IS a picture and has none to draw. That is a wait, and a surface must
    /// draw it as one: "the record kept no image" over a picture that is coming is a lie the reader
    /// cannot tell from the truth.
    var isPending: Bool {
        picture == nil && provenance.showsPicture
    }

    /// What a surface can draw the moment it appears, holding nothing up: whatever the cache
    /// already has, and otherwise a wait.
    ///
    /// The BOX is not asked for. What is held is held at whatever box made it, and drawing a
    /// coarser plate for the moment a finer decode takes is what the surface wants; a box here
    /// would only let this refuse to draw one.
    ///
    /// A held plate too coarse for this box is drawn anyway — soft for the moment the decode takes,
    /// which is the better of the two wrong pictures against a gap.
    ///
    /// The CLAIM comes off the signature rather than off the decode, because a bounded cache cannot
    /// promise a picture is still held: it may have been evicted, or the row may never have drawn
    /// one. A byte run that passes its signature and then fails to decode reads as a picture for
    /// the length of one decode and settles as an absence, which is the same compromise the
    /// lightbox has always made.
    @MainActor
    static func atOnce(_ media: MediaEvidence) -> MediaShowing {
        guard let bytes = media.bytes else { return MediaShowing(media, nil, showing: false) }
        let held = MediaCache.shared.held(bytes)
        return MediaShowing(media, held, showing: held != nil || MediaDecode.isPicture(bytes))
    }

    /// The picture read and decoded at the size this box draws it — or the news that it can no
    /// longer be read, which is a state and not a silence.
    ///
    /// Cancelled is nothing to show, and leaves whatever stood in for it standing. The decode does
    /// not observe cancellation, so the ANSWER has to: without this a lightbox moved from one shot
    /// to the next takes the older decode on top of the newer one when it finally lands.
    @MainActor
    static func decoded(_ media: MediaEvidence, drawnIn box: MediaBox) async -> MediaShowing? {
        guard let bytes = media.bytes else { return nil }
        let bitmap = await MediaCache.shared.bitmap(for: bytes, in: box)
        guard !Task.isCancelled else { return nil }
        if let bitmap {
            return MediaShowing(media, bitmap, showing: true)
        }
        // A picture the signature promised and the file no longer has. Settled rather than left
        // pending, or a deleted capture waits forever; `absent` rather than `unreadable` where the
        // signature never promised one, which is what `atOnce` already said.
        return MediaDecode.isPicture(bytes) ? MediaShowing(.unreadable) : nil
    }

    /// Before anything has been read. A view holds this for the one frame between appearing and its
    /// `onChange`, and an absence is the honest thing to hold: nothing has been established yet.
    private init() {
        self.picture = nil
        self.provenance = .absent
    }

    static let undecoded = MediaShowing()
}

extension View {
    /// Read and decode a media result ONCE, into the view that draws it, at the size it draws it.
    ///
    /// Decoding into an `NSImage` is work and a SwiftUI `body` runs whenever anything near it
    /// changes, so a surface that decoded inside its own `body` would re-decode every picture on
    /// every layout pass. Every surface that shows an image reaches for this rather than spelling
    /// the `@State`, the `onChange` and the task again.
    ///
    /// The update lands whatever the cache already holds, so a picture already drawn once is drawn
    /// again with no wait at all. The task is what reads the file, and it is attached to every box
    /// now rather than to the lightbox alone: a plate's pixels are no longer sitting in memory
    /// waiting to be decoded, and a read may not happen on the main actor (ADR-0028 Rule 6).
    func showing(
        _ media: MediaEvidence,
        drawnIn box: MediaBox,
        in showing: Binding<MediaShowing>,
    )
        -> some View {
        onChange(of: media, initial: true) {
            showing.wrappedValue = MediaShowing.atOnce(media)
        }
        .task(id: media) {
            guard let decoded = await MediaShowing.decoded(media, drawnIn: box) else { return }
            showing.wrappedValue = decoded
        }
    }
}
