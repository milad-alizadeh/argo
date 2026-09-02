import ArgoEngine

/// What the deck's reading zones draw: which reading it is, the rows it is made of, its plan, and
/// which rows it singles out. Assembled above the deck, because a scope is half of the reading and
/// the rail's scope is the deck's.
struct DeckContent {
    /// Which reading the zones are showing — see `FeedReading`.
    package var reading = FeedReading.unattached
    let feed: [FeedRow]
    let showing: PlanShowing
    let picked: Picked

    /// Which rows the reading singles out: the one it opens held at, and the ones a reader has
    /// since opened, stepped, lit or focused.
    struct Picked {
        let selection: FeedRowSelection
        /// See `FeedView.held`. Where the reading STARTS; the scroll owns it from there.
        var held: FeedRow.ID?
    }
}
