import SwiftUI

/// The deck with one Session named at the top of it — one case per access posture.
///
/// One posture per launch rather than three headers stacked, because what is being judged is a
/// header IN a deck: whether a title reads as the largest line on the plane, whether the mark
/// beside it stays quiet against a feed, and whether the zone still holds its own height when the
/// mark is not there at all. Three of them on one screen would answer a different question.
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
