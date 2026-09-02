import ArgoEngine

// The two values the deck's content row is handed, and exactly what `FeedColumn` takes. Assembled
// above the deck, because a scope is half of the reading and the rail's scope is the deck's.

/// The reading itself — which one it is, the rows it is made of, its plan, and what is picked out
/// in it. Every zone that draws the reading draws all of this or none of it.
struct DeckContent {
    /// Which reading the zones are showing — see `FeedReading`.
    var reading = FeedReading.unattached
    let feed: [FeedRow]
    let showing: PlanShowing
    let selection: FeedRowSelection
    /// Which row the reading opens held at — see `FeedView.held`.
    var held: FeedRow.ID?
}

/// The deck's one slot below the reading, as a control: what is in it, and what its controls do.
/// The two are one thing to hand over — a vessel drawn without its intents is a control that does
/// nothing when pressed.
@MainActor struct DeckVesselControl {
    /// See `DeckVessel`. The undriveable line is not part of this: it replaces the reading's end
    /// rather than floating over it, so `SessionsDeck` owns it.
    var vessel = DeckVessel.none
    var intents = DeckIntents.inert

    /// An empty slot nothing is wired to — what a specimen of some other zone gets.
    static let inert = DeckVesselControl()
}
