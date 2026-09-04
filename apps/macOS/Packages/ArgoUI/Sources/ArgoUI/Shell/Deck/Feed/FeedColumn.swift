import ArgoDesign
import ArgoEngine
import SwiftUI

/// The feed and the composer floating over it, bounded to their own column rather than run across
/// the deck (C4.1). The deck's bottom edge carries no Dock seam any more — it belongs to the
/// reading, and the vessel floats over it (#403, closed by #536).
struct FeedColumn: View {
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
        // Whatever the two seams leave it; prose inside is held to the measure by the rows.
        .frame(maxWidth: .infinity)
    }

    /// What the reading owes its own foot — see `FeedBottomEdge`. Assembled here because this is
    /// the one view that knows about both floats.
    private var bottomEdge: FeedBottomEdge {
        FeedBottomEdge(hasVessel: vessel.isFloating, hasPlanPill: showing.plan != nil)
    }

    /// Everything floating at the column's foot, in ONE stack. The pill rides on the vessel's own
    /// top edge rather than at a height measured against the deck: the field grows by the line, and
    /// a pill lifted by a fixed guess sits away from the box it belongs to at every height but
    /// one (#1225).
    private var floats: some View {
        VStack(spacing: ArgoSpacing.flush) {
            pill
            floating
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
