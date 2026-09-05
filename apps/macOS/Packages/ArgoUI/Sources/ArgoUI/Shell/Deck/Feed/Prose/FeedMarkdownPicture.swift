import ArgoDesign
import SwiftUI

/// A picture the record only NAMES — `![alt](source)` — drawn where its alt text used to be
/// (#1412).
///
/// The fetch and the state around `FeedPicturePlate`, which draws whichever of the three it is
/// handed. The gallery's own box: the fixed height, the picture's ratio for the width, and the
/// fitted draw that #1015 settled. The height is fixed BEFORE the bytes arrive and does not move
/// when they do, which is what lets `FeedProseFrame` measure the block; the picture is fitted
/// inside it rather than the box grown to the picture.
struct FeedMarkdownPicture: View {
    let alt: String
    let source: URL

    /// Fetched once per source rather than in `body`, which SwiftUI runs whenever anything near it
    /// changes — the same rule every other picture in the feed is drawn under.
    @State private var showing = FeedPictureShowing.waiting

    var body: some View {
        FeedPicturePlate(alt: alt, source: source, showing: showing)
            .frame(height: ArgoFeedRow.shotHeight, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
            .task(id: source) { await fetch() }
    }

    /// Whatever is held first, so a picture drawn once is drawn again with no wait, and the fetch
    /// behind it for everything else.
    ///
    /// A failure is settled HERE and nowhere longer-lived: this view asks again the next time it
    /// appears, so a body opened while the machine was offline draws its pictures when it is
    /// opened again.
    @MainActor private func fetch() async {
        let pictures = MarkdownPictures.shared
        if let held = pictures.held(source) {
            showing = .drawn(held)
            return
        }
        let fetched = await pictures.picture(at: source, in: .plate(ArgoFeedRow.shotPlate))
        guard !Task.isCancelled else { return }
        showing = fetched.map { .drawn($0) } ?? .unreadable
    }
}
