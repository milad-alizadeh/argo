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

    init(_ media: MediaEvidence) {
        let picture = MediaPicture(media)
        self.picture = picture
        self.provenance = MediaProvenance(media, showing: picture != nil)
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
    /// Decode a media result ONCE, into the view that draws it.
    ///
    /// Decoding base64 into an `NSImage` is work and a SwiftUI `body` runs whenever anything near
    /// it changes, so a surface that decoded inside its own `body` would re-decode every picture on
    /// every layout pass. Every surface that shows an image reaches for this rather than spelling
    /// the `@State` and the `onChange` again.
    func showing(_ media: MediaEvidence, in showing: Binding<MediaShowing>) -> some View {
        onChange(of: media, initial: true) { showing.wrappedValue = MediaShowing(media) }
    }
}
