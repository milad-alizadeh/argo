import ArgoEngine
import SwiftUI

/// The feed and the composer floating over it, bounded to their own column rather than run across
/// the deck (C4.1). The deck's bottom edge carries no Dock seam any more — it belongs to the
/// reading, and the vessel floats over it (#403, closed by #536).
struct FeedColumn: View {
    /// Which reading the column is drawing — see `FeedReading`. Passed on down; nothing here reads
    /// it.
    var reading = FeedReading.unattached
    let feed: [FeedRow]
    let showing: PlanShowing
    let selection: FeedRowSelection
    var held: FeedRow.ID?
    /// What is in the slot below the reading — see `DeckVessel`.
    var vessel = DeckVessel.none
    /// What that vessel's controls do.
    var intents = DeckIntents.inert
    /// The reading's scroll authority, from the deck — the minimap beside this column holds the
    /// same one.
    let table: FeedTableHandle

    var body: some View {
        FeedView(
            reading: reading,
            rows: feed,
            selection: selection,
            held: held,
            isUnderComposer: vessel.isFloating,
            table: table,
        )
        // Over the feed rather than in the column's stack: a row in the stack would take
        // height from the reading it is meant to sit above. Bounded to this column so it
        // moves with the feed when a seam does, never over the panel.
        .overlay(alignment: .bottom) { pill }
        .overlay(alignment: .bottom) { floating }
        // Whatever the two seams leave it; prose inside is held to the measure by the rows.
        .frame(maxWidth: .infinity)
    }

    /// A Session that never reported a plan gets no pill — not an empty one, and not a note saying
    /// there is none. Lifted clear of the vessel when one floats under it.
    @ViewBuilder private var pill: some View {
        if let plan = showing.plan {
            PlanPill(plan: plan, isRevealed: showing.isRevealed, isCursored: showing.isCursored)
                .padding(
                    .bottom,
                    vessel.isFloating ? ArgoComposerVessel.feedClearance : ArgoPlanPill.lift,
                )
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
