import ArgoDesign
import ArgoUI
import SwiftUI

/// The bar over a reading long enough to run beneath it, and over nothing — an empty deck and a
/// deck with no Session on it are two different absences.
struct DeckCanopyGallery: View {
    var isFlat = false

    var body: some View {
        VStack(spacing: ArgoSpacing.section) {
            SessionsDeck(
                feed: FeedProjection.longRows,
                header: SessionHeaderFixture.header(for: .managed),
                held: FeedProjection.longHeldRowID,
            )
            SessionsDeck(feed: [])
        }
        .argoWithoutTransparency(isFlat)
        .frame(width: 900, height: 800)
        .argoDeckSurface()
        .argoAppearance()
    }
}
