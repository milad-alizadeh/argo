import ArgoDesign
import ArgoEngine
import ArgoUI
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

    /// How much of a prompt a still shows, and how it got there. `pressed` is not `unfolded`: a
    /// reading opened unfolded was never measured folded, so only `pressed` crosses the fold.
    enum PromptFold {
        case folded, unfolded, pressed
    }

    /// A prompt longer than the fold shows, in one of its three states. `FeedPreview` and not the
    /// deck shell: the fold is the reading's own state, and nothing above the reading seeds one.
    static func prompt(_ rows: [FeedRow], at fold: PromptFold) -> some View {
        var preview = FeedPreview(rows: rows)
        let prompt = rows.first { $0.kind.isPrompt }?.id
        switch fold {
        case .folded: break
        case .unfolded: preview.opensUnfolded = prompt.map { [$0] } ?? []
        case .pressed: preview.unfoldsAfterLanding = prompt
        }
        return preview
    }

    /// The accent wash on the prompt the record has just answered — the 1.4 seconds after a send
    /// lands (#383, #1569). `FeedPreview` and not the deck shell, for the reason the fold uses it:
    /// the wash is the reading's own state and nothing above the reading seeds one.
    ///
    /// What it settles is the SHAPE. The wash marks what was sent, and what was sent is the bubble
    /// on the trailing edge — so a still where the accent runs the full measure is the bug, not the
    /// state.
    /// `argoStillsMotion` is what makes it renderable at all: the wash leaves 1.4 seconds after it
    /// lands, and a capture timed against that window comes out empty as often as not.
    static func washed(_ rows: [FeedRow]) -> some View {
        var preview = FeedPreview(rows: rows)
        preview.washed = rows.last { $0.kind.isPrompt }?.id
        return preview.environment(\.argoStillsMotion, true)
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

    /// The same stack over the OTHER subject: Argo's own observation gone bad, with every provider
    /// healthy. The chip beside it is what §8 is judged on — a transcript Argo cannot read asks for
    /// attention, and the failure ink is still available for the work failing.
    static func observationChip(_ connection: HubConnection) -> some View {
        ConnectionChips(
            connection: connection,
            projectID: CockpitPresentation.preview.activeProjectID,
            health: ConnectionHealthReading(connections: []),
            actions: .inert,
        )
    }

    /// The Sessions room with a reading in it — the shell and not `SessionsDeck`, because what is
    /// being judged is the assembled container. It HOLDS the evidence selection rather than seeding
    /// a constant one, so a click on a row opens the panel: see `SessionsDeckSpecimen`.
    static func sessions(
        _ feed: [FeedRow],
        showing: PlanShowing = PlanShowing(),
        open: FeedRow.ID? = nil,
        step: Int? = nil,
        lit: FeedShot? = nil,
        held: FeedRow.ID? = nil,
        vessel: DeckVessel = .none,
        access: CockpitPresentation.Session.Access = .managed,
    )
        -> some View {
        SessionsDeckSpecimen(
            feed: feed,
            showing: showing,
            opensOn: open,
            opensAt: step,
            lit: lit,
            held: held,
            vessel: vessel,
            access: access,
        )
    }
}
