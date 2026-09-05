import ArgoEngine
import ArgoFixtures
import ArgoUI

// A Turn Argo has typed that no record has answered yet (#1278), projected. Its own file for
// `FeedProjection+PreviewWaits.swift`'s reason: the words are not the record's, so these are built
// from something other than a transcript alone.

extension FeedProjection {
    /// The state the ticket is about, on its own: a Turn was sent and the record holds nothing at
    /// all. What the still settles is that the feed is not empty in that second — and that the one
    /// row in it reads as words Argo typed rather than as a Turn the CLI answered.
    ///
    /// `working` is true beside it, because that is what the shipping reading does: a Turn Argo
    /// typed reads `running` at DIRECT the moment it goes down the PTY
    /// (`HubSession.statusReading`), so the drawn row never stands over a still screen.
    static let previewSubmittedTurnAloneRows = rows(
        from: [],
        working: true,
        submitted: "Fix the caption on the roster row, not the sort order behind it.",
    )

    /// The same row under a Turn the record DID carry — the judgement the still above cannot make:
    /// whether the drawn Turn is told apart from a confirmed prompt on the same screen, and whether
    /// it sits where the record's own row will land.
    ///
    /// Short on purpose, and its own events rather than a shipping fixture: the claim is a
    /// comparison between two bubbles, and a still cannot scroll to a prompt that a long reading
    /// has carried off the top of the screen.
    static let previewSubmittedTurnRows = rows(
        from: [
            .prompt(
                text: "Name the two measurements the bubble is laid out from.",
                images: [],
                atMs: 1_733_000_000_000,
            ),
            .message(markdown: "The proposal's width and the words' own typeset height."),
            .turnEnded(.endTurn),
        ],
        working: true,
        submitted: "Fix the caption on the roster row, not the sort order behind it.",
    )
}
