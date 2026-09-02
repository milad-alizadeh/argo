import ArgoDesign
import ArgoUI
import SwiftUI

/// Every posture, with nothing-selected under them: an empty line and a line with no mark on it
/// are two different absences.
struct SessionTabLineGallery: View {
    let width: CGFloat

    private var headers: [SessionHeaderProjection.Header] {
        SessionHeaderFixture.headers + [SessionHeaderFixture.needsInput]
    }

    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            ForEach(Array(headers.enumerated()), id: \.offset) { _, header in
                SessionTabLine(header: header)
                    .frame(height: ArgoLayout.deckTabSlotHeight)
            }
            SessionTabLine(header: nil)
                .frame(height: ArgoLayout.deckTabSlotHeight)
        }
        .frame(width: width)
        .argoDeckSurface()
        .argoAppearance()
    }
}
