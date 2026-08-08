import SwiftUI

/// A run of pictures, drawn as one horizontal row of thumbnails.
///
/// One row and never a grid, however many shots there are. A gallery sits INSIDE a feed that is
/// read top to bottom, and a block that grows downward pushes the paragraph explaining it off the
/// screen — the run stays on one line and scrolls sideways when it outgrows the measure, which is
/// the one place in this cockpit where sideways is the right answer: a picture has an obvious end,
/// and nothing is hidden the way the tail of a wrapped line would be.
struct FeedGalleryRow: View {
    let gallery: FeedGallery
    let open: (FeedShot) -> Void

    var body: some View {
        ScrollView(.horizontal) {
            HStack(alignment: .top, spacing: ArgoFeedRow.shotGap) {
                ForEach(Array(gallery.shots.enumerated()), id: \.offset) { _, shot in
                    FeedShotView(shot: shot, open: open)
                }
            }
        }
        // A run that fits does not scroll at all. Without this a gallery of one still rubber-bands
        // under a trackpad and flashes a scroller, which is the row advertising a direction it has
        // nothing in.
        .scrollBounceBehavior(.basedOnSize)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(gallery.spoken)
    }
}

#Preview("Gallery — a run of shots the agent looked at") {
    FeedGalleryRow(gallery: FeedGallery(shots: FeedProjection.previewShots), open: { _ in })
        .padding(ArgoFeedRow.inset)
        .frame(width: 720)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Gallery — one shot on its own, drawn the same way") {
    FeedGalleryRow(
        gallery: FeedGallery(shots: Array(FeedProjection.previewShots.prefix(1))),
        open: { _ in },
    )
    .padding(ArgoFeedRow.inset)
    .frame(width: 720)
    .argoDeckSurface()
    .argoAppearance()
}
