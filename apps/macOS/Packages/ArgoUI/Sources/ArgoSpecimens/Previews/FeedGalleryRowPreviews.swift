import ArgoUI
import SwiftUI

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
