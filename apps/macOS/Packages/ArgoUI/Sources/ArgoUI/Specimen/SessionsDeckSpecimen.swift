import SwiftUI

/// The Sessions room with a reading in it, HOLDING the evidence selection rather than seeding a
/// constant one — a constant binding draws the panel open for a still but no click can open one.
struct SessionsDeckSpecimen: View {
    /// The reading, already projected.
    var feed: [FeedRow] = []
    /// The Session's plan, which is standing state rather than a row.
    var showing = PlanShowing()
    /// Seeded through the memberwise init and owned from there, so one entry is a still of the
    /// panel open and another is a deck somebody clicks.
    @State var open: FeedRow.ID?
    @State var step: Int?
    /// Which picture opens full size. A value: `SessionsDeck` already owns this one as state.
    var lit: FeedShot?
    /// Which row the reading opens held at — see `FeedView.held`.
    var held: FeedRow.ID?
    var vessel = DeckVessel.none
    var access: CockpitPresentation.Session.Access = .managed

    var body: some View {
        InstrumentDeckShell(
            room: .sessions,
            feed: feed,
            // Always named: a deck whose top zone says nothing is the no-Session-selected state,
            // and every entry through here has a Session in it. A prompt in the composer's slot IS
            // the Session's status, so the band is read off the same fact.
            header: vessel.prompt == nil
                ? SessionHeaderFixture.header(for: access)
                : SessionHeaderFixture.needsInput,
            showing: showing,
            open: $open,
            step: $step,
            lit: lit,
            held: held,
            vessel: vessel,
        )
    }
}

#Preview("Sessions deck specimen — a call's evidence open beside the reading") {
    SessionsDeckSpecimen(
        feed: FeedProjection.previewCallRows,
        open: FeedProjection.previewSurveyRowID,
    )
    .frame(width: 900, height: 620)
    .argoAppearance()
}
