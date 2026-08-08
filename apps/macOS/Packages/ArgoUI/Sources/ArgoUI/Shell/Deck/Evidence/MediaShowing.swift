import ArgoEngine
import SwiftUI

/// A media result as a surface actually shows it: the picture that decoded, and the claim the
/// surface is entitled to make about it.
///
/// One value rather than a `MediaPicture?` held beside a `MediaProvenance`, because the whole point
/// of the pair is that both answer to the SAME decode. Kept apart, a view can draw an absence and
/// caption it "as the agent saw it", or offer a click onto a picture it never got — which is the
/// exact pair of mistakes the `absent` case exists to make unreachable.
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
