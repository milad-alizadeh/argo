import SwiftUI

/// A run of pictures, drawn as a wrapping grid of fixed-size thumbnails.
///
/// It wraps rather than scrolls. A sideways scroller inside a feed read top to bottom hides its
/// tail behind an affordance and fights the reading for every wheel gesture; a grid that breaks
/// onto the next line shows every shot at the size the contract fixed, and costs only height —
/// the one direction this column already spends.
struct FeedGalleryRow: View {
    let gallery: FeedGallery
    let open: (FeedShot) -> Void

    var body: some View {
        FeedShotFlow(gap: ArgoFeedRow.shotGap) {
            ForEach(Array(gallery.shots.enumerated()), id: \.offset) { _, shot in
                FeedShotView(shot: shot, open: open)
            }
        }
        // Pictures need more air from prose than prose needs from prose — a run seated at the
        // text rhythm reads as jammed between the paragraphs it illustrates.
        .padding(.vertical, ArgoFeedRow.shotBreath)
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
