import SwiftUI

/// What the catalog's cases are BUILT from, kept off the switch itself so the switch stays a list
/// of states.
extension SpecimenScreen {
    /// The header whose context tier this case is a render of. The fixture set names the case it
    /// belongs to, so neither side can be renamed into drawing another tier's reading.
    var contextHeader: SessionHeaderProjection.Header {
        SessionHeaderFixture.contexts.first { $0.specimen == specimen }?.header
            ?? SessionHeaderFixture.header(for: .managed)
    }

    /// The header whose handoff state this case is a render of, keyed the same way the tiers are.
    var handoffHeader: SessionHeaderProjection.Header {
        SessionHeaderFixture.handoffs.first { $0.specimen == specimen }?.header
            ?? SessionHeaderFixture.header(for: .managed)
    }

    /// The header whose spend line this case is a render of, keyed the same way the tiers are.
    var spendHeader: SessionHeaderProjection.Header {
        SessionSpendFixture.spends.first { $0.specimen == specimen }?.header
            ?? SessionHeaderFixture.header(for: .managed)
    }

    /// A surface the app puts over the window rather than into it, rendered where the app puts it.
    func centred(@ViewBuilder _ content: () -> some View) -> some View {
        content().frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
    }

    /// The reading whose Connect state this case is a render of. Keyed off the case the way the
    /// header fixtures are, so neither side can be renamed into drawing another state's panel.
    var connectReading: ConnectReading {
        ConnectFixture.states.first { $0.specimen == specimen }?.reading ?? ConnectFixture.fresh
    }

    /// Which result the folded run's pane opens at — the third for the case that is a render of a
    /// click on a name, and the top for the case that is a render of the row being opened.
    var surveyStep: Int? {
        specimen == .feedSurveyEvidenceStep ? 2 : nil
    }

    /// The folded run of looking, open — and optionally open AT one of the results listed under it,
    /// which is the state a click on one of those names produces.
    func survey(at step: Int? = nil) -> some View {
        sessions(
            FeedProjection.previewCallRows,
            open: FeedProjection.previewSurveyRowID,
            step: step,
        )
    }

    /// The connection reading this case is a render of, keyed the same way. `quiet` is the fallback
    /// because it is what the chip draws nothing for — a case wired to no fixture renders an empty
    /// frame rather than somebody else's failure.
    var connectionHealth: ConnectionHealthReading {
        ConnectionHealthSpecimen.states.first { $0.specimen == specimen }?.reading ?? .quiet
    }

    /// The chip stack over a presentation that is CONNECTED, so what is on screen is the provider
    /// reading alone — a chip about the transcript tail beside it would settle nothing about the
    /// one being judged.
    var connectionChips: some View {
        ConnectionChips(presentation: .preview, health: connectionHealth, actions: .inert)
    }

    /// The New Session verb mid-spawn. Alone rather than on the bar, because the bar is
    /// `toolbarScope`'s render and what this settles is a swap inside one container: the wait must
    /// not resize the circle or move anything beside it.
    var startingSpawn: some View {
        NewSessionButton(
            offer: NewSessionOffer(presentation: .preview),
            spawn: {},
            isStarting: true,
        )
    }

    /// A reading with its overview lane beside it. The pair alone rather than the whole shell,
    /// because 112 points of a 1440-wide deck is not a width anyone can judge a rhythm at.
    func overview(_ rows: [FeedRow], held: FeedRow.ID? = nil) -> some View {
        FeedPreview(rows: rows, showsOverview: true, held: held)
    }

    /// The Sessions room with a reading in it — the shell and not `SessionsDeck`, because what is
    /// being judged is the assembled container.
    func sessions(
        _ feed: [FeedRow],
        open: FeedRow.ID? = nil,
        step: Int? = nil,
        lit: FeedShot? = nil,
        held: FeedRow.ID? = nil,
        vessel: DeckVessel = .none,
        access: CockpitPresentation.Session.Access = .managed,
    )
        -> some View {
        // Named, because a deck whose top zone says nothing is the no-Session-selected state, and
        // every case below has a Session in it.
        InstrumentDeckShell(
            room: .sessions,
            feed: feed,
            // A prompt in the composer's slot IS the Session's status, so the band above it is read
            // off the same fact rather than named per case.
            header: vessel.prompt == nil
                ? SessionHeaderFixture.header(for: access)
                : SessionHeaderFixture.needsInput,
            open: open,
            step: step,
            lit: lit,
            held: held,
            vessel: vessel,
        )
    }
}
