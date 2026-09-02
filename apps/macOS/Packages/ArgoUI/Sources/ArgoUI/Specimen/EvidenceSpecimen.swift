import ArgoDesign
import SwiftUI

/// The evidence panel's header, per subject: the panel open on a command that runs to the three
/// lines it is capped at, and beside it the panel open on a File path.
///
/// Side by side because the SPLIT is what is being looked at. Either one alone settles nothing — a
/// wrapped command reads fine until the reader has to believe a path did not also start wrapping,
/// and a front-cut path reads fine until the command beside it is cut the same way. What has to be
/// true of both is on one screen: the two marks differ, the two addresses are cut at opposite ends,
/// and the close control sits on the same line in each whatever the header under it is doing.
struct EvidenceSpecimen: View {
    var body: some View {
        HStack(alignment: .top, spacing: ArgoSpacing.flush) {
            panel(EvidenceFixture.ran)
            DeckSeparator()
            panel(EvidenceFixture.edited)
        }
        .argoDeckSurface()
    }

    /// At the panel's own floor, which is the width the split is hardest at: three lines of a
    /// command is the most header the narrowest panel ever has to carry.
    @ViewBuilder private func panel(_ evidence: FeedEvidence?) -> some View {
        if let evidence {
            EvidencePanel(evidence: evidence, dismiss: {})
                .frame(width: ArgoLayout.evidencePanelMinimumWidth)
        }
    }
}

#Preview("Evidence — a command's header beside a File's") {
    EvidenceSpecimen()
        .frame(height: 480)
        .argoAppearance()
}
