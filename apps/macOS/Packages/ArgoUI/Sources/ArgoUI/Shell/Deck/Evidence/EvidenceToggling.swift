/// What the toolbar's evidence toggle does, as a value — so the two questions the ticket left open
/// (#875 finding 5) are answered where a test can read them rather than inside a button.
///
/// **Which evidence opens when no row was ever picked.** The LAST row in the reading that has any:
/// a reader who has picked nothing is looking at the end of the feed, and the newest evidence is
/// what they are nearest. Nothing at all in the reading leaves the control inert rather than
/// pressable onto an empty column.
///
/// **The rail.** Nothing is decided here, because `DeckZoning.showsRail` already decides it: the
/// panel and the rail are mutually exclusive and the panel wins. Opening the panel from the toolbar
/// closes the rail exactly as opening it from a row does, and closing it brings the rail back if
/// anything is still running.
struct EvidenceToggling {
    /// The rows on screen — the Session's own, or the Subagent's the rail scoped onto.
    let feed: [FeedRow]
    /// Which row's evidence is open, if any.
    let open: FeedRow.ID?

    var isOpen: Bool {
        open != nil
    }

    /// What a press writes: `nil` closes, an id opens.
    var next: FeedRow.ID? {
        isOpen ? nil : latest
    }

    /// Pressable while there is something to show, and while it is showing something — a control
    /// that could only ever close is still a control that does something.
    var canToggle: Bool {
        isOpen || latest != nil
    }

    var help: String {
        guard canToggle else { return "Nothing in this reading has evidence to show" }
        return isOpen ? "Hide evidence" : "Show the newest evidence"
    }

    /// Resolved against the CURRENT rows rather than remembered, for the reason `DeckZoning` does
    /// the same: a live transcript grows under an open panel.
    private var latest: FeedRow.ID? {
        feed.last(where: { $0.content.opened != nil })?.id
    }
}
