import ArgoDesign
import ArgoEngine
import SwiftUI

/// The feed and the composer floating over it, bounded to their own column rather than run across
/// the deck (C4.1). The deck's bottom edge carries no Dock seam any more — it belongs to the
/// reading, and the vessel floats over it (#403, closed by #536).
struct FeedColumn: View {
    /// The wait ARGO ITSELF is holding, from above the deck — see `EnvironmentValues.argoFeedWait`.
    @Environment(\.argoFeedWait) private var argoHeldWait
    /// Whether the Turn in flight is one Argo itself submitted — see
    /// `EnvironmentValues.argoTurnIsDirect`.
    @Environment(\.argoTurnIsDirect) private var argoTurnIsDirect

    /// Which reading the column is drawing — see `FeedReading`. Passed on down; nothing here reads
    /// it.
    package var reading = FeedReading.unattached
    let feed: [FeedRow]
    let showing: PlanShowing
    let selection: FeedRowSelection
    var held: FeedRow.ID?
    /// What is in the slot below the reading — see `DeckVessel`.
    var vessel = DeckVessel.none
    /// What that vessel's controls do.
    var intents = DeckIntents.inert
    /// This reading's deck, from above the column — the minimap beside it maps the same one. See
    /// `KeptDeck`.
    let deck: KeptDeck

    /// When that wait began. Stamped on its IDENTITY changing, and on the reading too — two
    /// Sessions showing the same wait in a row are two waits, not one that never stopped.
    @State private var waitStarted: Date?

    var body: some View {
        FeedView(
            reading: reading,
            rows: feed,
            selection: selection,
            held: held,
            bottomEdge: bottomEdge,
            deck: deck,
        )
        // Over the feed rather than in the column's stack: a row in the stack would take
        // height from the reading it is meant to sit above. Bounded to this column so it
        // moves with the feed when a seam does, never over the panel.
        .overlay(alignment: .bottom) { floats }
        // The age of the wait is counted from here, and from HERE rather than from inside the feed
        // because two surfaces read it: the plinth's elapsed reading and the ion crossing a live
        // row. Stamped on the CHANGE, so a row arriving mid-think does not restart a wait that
        // never stopped — and on the reading too, so two Sessions showing the same wait in a row
        // are two waits rather than one that never did.
        .onChange(of: FeedFact(reading: reading, value: waiting), initial: true) {
            waitStarted = $1.value == nil ? nil : Date()
        }
        .environment(\.argoWaitStarted, waitStarted)
        // Whatever the two seams leave it; prose inside is held to the measure by the rows.
        .frame(maxWidth: .infinity)
    }

    /// Which wait this column is showing: the engine's, or the one its rows say.
    ///
    /// The engine's wins, on #1048's own ground — a CLI Argo has heard nothing at all from cannot
    /// be shown to be thinking either. By construction it does not have to fight for the answer: a
    /// Session whose CLI has written no record has no rows for the other cases to read.
    ///
    /// The engine's arrives through the ENVIRONMENT rather than threaded through the four views
    /// between the shell and here, exactly as `deckIsResizing` and `argoOpenSession` do — and it
    /// has to come from somewhere, because it draws no row for this view to read it off. The rest
    /// are read against the rows this column actually draws: the rail may have scoped them onto a
    /// Subagent, and a wait is a fact about the reading on screen.
    ///
    /// The ROWS are read at all only where `argoTurnIsDirect` says the Turn in flight is one Argo
    /// itself submitted — `.mark(.working)` is drawn at exactly `SessionStatus.running`'s own
    /// confidence (`FeedWorking`), which is DERIVED for every reading but one, and the plinth may
    /// not be. Gated here rather than on `.thinking`'s own words, so a Session observed from
    /// outside never reaches this surface however its rows are posed.
    private var waiting: FeedWait? {
        argoHeldWait ?? (argoTurnIsDirect ? FeedWait.showing(in: feed) : nil)
    }

    /// What the reading owes its own foot — see `FeedBottomEdge`. Assembled here because this is
    /// the one view that knows about both floats.
    private var bottomEdge: FeedBottomEdge {
        FeedBottomEdge(
            hasVessel: vessel.isFloating,
            hasPlanPill: showing.plan != nil,
            hasWaitPlinth: plinth != nil,
        )
    }

    /// The words the plinth stands under, and `nil` where nothing stands there. A wait with no
    /// words has not reached this surface yet — each of the design's other three arrives on its own
    /// ticket, and until one does its wait keeps the rendering it already has.
    private var plinth: FeedWaitWords? {
        waiting.flatMap(FeedWaitWords.init)
    }

    /// Everything floating at the column's foot, in ONE stack. The pill rides on the vessel's own
    /// top edge rather than at a height measured against the deck: the field grows by the line, and
    /// a pill lifted by a fixed guess sits away from the box it belongs to at every height but
    /// one (#1225).
    private var floats: some View {
        VStack(spacing: ArgoSpacing.flush) {
            pill
            standing
            floating
        }
    }

    /// The wait Argo is holding, between the feed and the composer. Under the pill and over the
    /// vessel, which is where the design puts it: a wait is nearer the work than a plan somebody
    /// can read at leisure, and nearer the reading than the field they type into.
    ///
    /// ONE plinth, because `waiting` is one wait: a reading holding two would be a reading that
    /// could not say which one the elapsed figure is counting.
    @ViewBuilder private var standing: some View {
        if let plinth {
            // No inset applied here: the plinth holds itself to the feed's own measure, so it lines
            // up with the rows above it rather than with the vessel below.
            FeedWaitPlinth(words: plinth)
                .transition(.opacity)
        }
    }

    /// A Session that never reported a plan gets no pill — not an empty one, and not a note saying
    /// there is none. The lift is what says it floats over the surface below rather than sitting on
    /// it, whether that surface is the vessel or the deck's own foot.
    @ViewBuilder private var pill: some View {
        if let plan = showing.plan {
            PlanPill(plan: plan, isRevealed: showing.isRevealed, isCursored: showing.isCursored)
                .padding(.bottom, ArgoPlanPill.lift)
        }
    }

    /// Which vessel is drawn is `DeckVessel`'s answer, already made — this switch only draws it.
    /// The undriveable line is a row on the deck rather than a float, so it is not here.
    @ViewBuilder private var floating: some View {
        switch vessel {
        case let .prompt(prompt):
            PermissionPrompt(prompt: prompt, decide: intents.decide, revoke: intents.revoke)
                .modifier(FloatingVessel())
        case let .composer(composer):
            SessionComposer(composer: composer, intents: intents)
                .modifier(FloatingVessel())
        case .unavailable, .none:
            EmptyView()
        }
    }
}

/// Where a floating vessel sits against the feed's own column — one inset, so the two cannot come
/// to disagree about where the slot is.
private struct FloatingVessel: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(.horizontal, ArgoSpacing.section)
            .padding(.bottom, ArgoSpacing.loose)
    }
}
