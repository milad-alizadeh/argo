import SwiftUI

/// What the registry's entries are BUILT from, kept off the entry lists so those stay lists of
/// states.
@MainActor
enum SpecimenScene {
    /// A surface the app puts over the window rather than into it, rendered where the app puts it.
    static func centred(@ViewBuilder _ content: () -> some View) -> some View {
        content().frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
    }

    /// The folded run of looking, open — and optionally open AT one of the results listed under it,
    /// which is the state a click on one of those names produces.
    static func survey(at step: Int? = nil) -> some View {
        sessions(
            FeedProjection.previewCallRows,
            open: FeedProjection.previewSurveyRowID,
            step: step,
        )
    }

    /// A reading with its overview lane beside it. The pair alone rather than the whole shell,
    /// because 112 points of a 1440-wide deck is not a width anyone can judge a rhythm at.
    ///
    /// `naming` is what a still asks the lane to name, since a hover is the one state no still can
    /// reach on its own (#382).
    static func overview(
        _ rows: [FeedRow],
        held: FeedRow.ID? = nil,
        naming: MinimapNaming = .nothing,
    )
        -> some View {
        var preview = FeedPreview(rows: rows, showsOverview: true, held: held)
        preview.naming = naming
        return preview
    }

    /// The New Session verb mid-spawn. Alone rather than on the bar, because the bar is
    /// `toolbarScope`'s render and what this settles is a swap inside one container: the wait must
    /// not resize the circle or move anything beside it.
    static var startingSpawn: some View {
        NewSessionButton(
            offer: NewSessionOffer(presentation: .preview),
            spawn: {},
            isStarting: true,
        )
    }

    /// The chip stack over a presentation that is CONNECTED, so what is on screen is the provider
    /// reading alone — a chip about the transcript tail beside it would settle nothing about the
    /// one being judged.
    static func connectionChips(_ health: ConnectionHealthReading) -> some View {
        ConnectionChips(
            connection: .connected,
            projectID: CockpitPresentation.preview.activeProjectID,
            health: health,
            actions: .inert,
        )
    }

    /// The Sessions room with a reading in it — the shell and not `SessionsDeck`, because what is
    /// being judged is the assembled container.
    static func sessions(
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
        // every entry below has a Session in it.
        InstrumentDeckShell(
            room: .sessions,
            feed: feed,
            // A prompt in the composer's slot IS the Session's status, so the band above it is read
            // off the same fact rather than named per entry.
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
