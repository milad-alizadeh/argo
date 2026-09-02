import ArgoDesign
import ArgoUI
import SwiftUI

/// The deck with one Session named at the top of it — one case per access posture.
///
/// One posture per launch rather than three lines stacked, because what is being judged is the
/// chrome IN a deck: whether the instruments stay quiet against a feed, whether the tab line still
/// holds its own height when nothing is selected, and whether one material runs unbroken from the
/// window's top edge to the line's hairline. Three of them on one screen would answer a different
/// question.
struct SessionHeaderSpecimen: View {
    let header: SessionHeaderProjection.Header

    init(access: CockpitPresentation.Session.Access) {
        self.header = SessionHeaderFixture.header(for: access)
    }

    init(header: SessionHeaderProjection.Header) {
        self.header = header
    }

    var body: some View {
        InstrumentDeckShell(
            room: .sessions,
            feed: FeedProjection.previewRows,
            header: header,
        )
    }
}

#Preview("Session header specimen — a managed Session") {
    SessionHeaderSpecimen(access: .managed)
        .frame(width: 900, height: 620)
        .argoAppearance()
}

#Preview("Session header specimen — a Session nobody here started") {
    SessionHeaderSpecimen(access: .external)
        .frame(width: 900, height: 620)
        .argoAppearance()
}

#Preview("Session header specimen — a Session whose terminal died") {
    SessionHeaderSpecimen(access: .orphaned)
        .frame(width: 900, height: 620)
        .argoAppearance()
}
