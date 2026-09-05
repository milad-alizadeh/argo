import ArgoUI
import SwiftUI

#Preview("Feed prompt — a picture pasted in with the words") {
    @Previewable @State var isExpanded = false

    FeedPrompt(
        prompt: FeedPromptReading(
            text: "Look at the rule under the header — it sits a point low against the seam.",
            shots: Array(FeedProjection.previewShots.prefix(1)),
        ),
        open: { _ in },
        isExpanded: $isExpanded,
    )
    .padding(ArgoFeedRow.inset)
    .frame(width: 720)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Feed prompt — nothing but the picture") {
    @Previewable @State var isExpanded = false

    FeedPrompt(
        prompt: FeedPromptReading(
            text: "",
            shots: Array(FeedProjection.previewShots.prefix(1)),
        ),
        open: { _ in },
        isExpanded: $isExpanded,
    )
    .padding(ArgoFeedRow.inset)
    .frame(width: 720)
    .argoDeckSurface()
    .argoAppearance()
}
