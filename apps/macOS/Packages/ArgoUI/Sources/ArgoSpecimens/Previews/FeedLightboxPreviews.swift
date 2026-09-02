import ArgoUI
import SwiftUI

#Preview("Lightbox — a shot opened over the deck") {
    Color.clear
        .argoDeckSurface()
        .overlay {
            if let shot = FeedProjection.previewShots.first {
                FeedLightbox(shot: shot, dismiss: {})
            }
        }
        .frame(width: 900, height: 620)
        .argoAppearance()
}
