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

    /// What a surface can draw the moment it appears. A plate is decoded here — it is a cache hit
    /// for anything already on screen. A full frame is not: the lightbox stands in the plate the
    /// gallery already made until `lit` lands, so the fade opens on a picture rather than on a gap.
    @MainActor
    static func atOnce(_ media: MediaEvidence, drawnIn box: MediaBox) -> MediaShowing {
        guard let bytes = media.bytes else { return MediaShowing(media, nil, showing: false) }
        switch box {
        case .plate:
            // The decode is the answer: a plate that drew nothing must not also be a control.
            let bitmap = MediaCache.shared.bitmap(for: bytes, in: box)
            return MediaShowing(media, bitmap, showing: bitmap != nil)
        case .full:
            // A bounded cache cannot promise the plate is still held — it may have been evicted,
            // or the row may never have drawn one. So the claim comes off the file's signature
            // rather than off the absence, or the caption drops "as the agent saw it" for the
            // 25 ms the full frame takes and reflows under the reader mid-fade.
            let held = MediaCache.shared.held(bytes)
            return MediaShowing(media, held, showing: held != nil || MediaDecode.isPicture(bytes))
        }
    }

    /// Every pixel the file has, decoded off the main actor. `nil` where there is nothing to show,
    /// which leaves whatever stood in for it standing.
    ///
    /// Cancelled is also nothing to show. The decode itself does not observe cancellation, so the
    /// ANSWER has to: without this a lightbox moved from one shot to the next takes the older
    /// decode on top of the newer one when it finally lands.
    static func lit(_ media: MediaEvidence) async -> MediaShowing? {
        guard let bytes = media.bytes,
              let bitmap = await MediaCache.fullBitmap(for: bytes),
              !Task.isCancelled else { return nil }
        return MediaShowing(media, bitmap, showing: true)
    }

    /// Before the decode has run. A view holds this for the one frame between appearing and its
    /// `onChange`, and an absence is the honest thing to hold: nothing has been established yet.
    private init() {
        self.picture = nil
        self.provenance = .absent
    }

    static let undecoded = MediaShowing()
}

extension View {
    /// Decode a media result ONCE, into the view that draws it, at the size it draws it.
    ///
    /// Decoding base64 into an `NSImage` is work and a SwiftUI `body` runs whenever anything near
    /// it changes, so a surface that decoded inside its own `body` would re-decode every picture on
    /// every layout pass. Every surface that shows an image reaches for this rather than spelling
    /// the `@State` and the `onChange` again.
    ///
    /// The plate lands in the update, so a gallery never draws its absence text for a frame first.
    /// The full frame lands from a task, because decoding one on the main thread stalled the
    /// lightbox's fade and read as a flash — and the task is attached only where there is one to
    /// run, rather than on every plate in the feed for the sake of an immediate return.
    @ViewBuilder
    func showing(
        _ media: MediaEvidence,
        drawnIn box: MediaBox,
        in showing: Binding<MediaShowing>,
    )
        -> some View {
        let plated = onChange(of: media, initial: true) {
            showing.wrappedValue = MediaShowing.atOnce(media, drawnIn: box)
        }
        if box.isFull {
            plated.task(id: media) {
                guard let lit = await MediaShowing.lit(media) else { return }
                showing.wrappedValue = lit
            }
        } else {
            plated
        }
    }
}
