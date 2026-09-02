import ArgoUI
import SwiftUI

/// The Sessions room with a reading in it, HOLDING the evidence selection rather than seeding a
/// constant one — under `.constant` the panel renders open for a still but no click can open one.
///
/// Every other value is `InstrumentDeckShell`'s, documented there.
struct SessionsDeckSpecimen: View {
    var feed: [FeedRow] = []
    var showing = PlanShowing()
    /// Which row's evidence the deck OPENS on, and at which result. Applied to the state below on
    /// every change rather than only at first build: `@State` seeded through the memberwise init
    /// keeps the first seed for the life of the view's identity, so one entry re-rendered with a
    /// second seed would draw the first one's panel.
    var opensOn: FeedRow.ID?
    var opensAt: Int?
    var lit: FeedShot?
    var held: FeedRow.ID?
    var vessel = DeckVessel.none
    var access: CockpitPresentation.Session.Access = .managed

    @State private var open: FeedRow.ID?
    @State private var step: Int?

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
        .onChange(of: opensOn, initial: true) { _, row in open = row }
        .onChange(of: opensAt, initial: true) { _, result in step = result }
    }
}
