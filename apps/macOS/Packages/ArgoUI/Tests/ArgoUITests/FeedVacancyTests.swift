@testable import ArgoUI
import Testing

/// The four empties the deck's reading zone can be, and that they read as four things (#404).
@Suite("Feed vacancy")
struct FeedVacancyTests {
    /// One row of the truth table. A named value rather than a tuple, which the cap on those
    /// forbids at three members.
    struct Window {
        let hasSelection: Bool
        let hasSessions: Bool
        /// Whether the shell has caught up with the row that was clicked — see `DrawnSession`.
        let isDrawn: Bool
        let vacancy: FeedVacancy
    }

    /// The whole truth table, as a table. The middle row is the distinction the deck was missing: a
    /// window with work on its roster and none of it chosen.
    ///
    /// The last two rows are the switch: an undrawn deck is `unread` whatever the other two say,
    /// and reading it off `hasSelection` alone is exactly the misreading the case exists to stop —
    /// a window told to select the row the reader has just clicked.
    @Test(arguments: [
        Window(hasSelection: true, hasSessions: true, isDrawn: true, vacancy: .silent),
        Window(hasSelection: false, hasSessions: true, isDrawn: true, vacancy: .unselected),
        Window(hasSelection: false, hasSessions: false, isDrawn: true, vacancy: .noSessions),
        Window(hasSelection: false, hasSessions: true, isDrawn: false, vacancy: .unread),
        Window(hasSelection: true, hasSessions: true, isDrawn: false, vacancy: .unread),
    ])
    func `which empty a window is in`(window: Window) {
        #expect(
            FeedVacancy.reading(
                hasSelection: window.hasSelection,
                hasSessions: window.hasSessions,
                isDrawn: window.isDrawn,
            ) == window.vacancy,
        )
    }

    /// The point of the whole type: one word for all of them is the state the deck was in, and the
    /// one it read as was the most broken of them.
    @Test
    func `the four say four different things`() {
        let said = Set([FeedVacancy.silent, .unselected, .noSessions, .unread].map(\.words))

        #expect(said.count == 4)
    }

    /// The word for a switch names ARGO, because the deck it is drawn on holds a Session that may
    /// be doing anything at all — degrade-down forbids reading Argo's own unfinished work as a
    /// quiet agent (`CONTEXT.md` · Honesty tier).
    @Test
    func `an undrawn deck says who has not read it`() {
        #expect(FeedVacancy.unread.words.contains("Argo"))
        #expect(FeedVacancy.unread.words != FeedVacancy.silent.words)
    }

    /// The gate, which is the whole reason a fourth word does not flash on every click: a switch
    /// that resolves inside `ArgoMotion.unreadDelay` says nothing at all, and every other empty
    /// says its word straight away because none of them is a wait.
    @Test(arguments: [FeedVacancy.silent, .unselected, .noSessions])
    func `only the undrawn deck holds its word back`(vacancy: FeedVacancy) {
        #expect(FeedVacancy.unread.words(overdue: false).isEmpty)
        #expect(FeedVacancy.unread.words(overdue: true) == FeedVacancy.unread.words)
        #expect(vacancy.words(overdue: false) == vacancy.words)
    }

    /// A claim about the SURFACE, unchanged: an agent can be busy in kinds this feed does not draw
    /// yet, so a selected Session's empty reading may not be read as a quiet Session.
    @Test
    func `the selected Session's silence still speaks of the reading and not of the Session`() {
        #expect(FeedVacancy.silent.words == "Nothing to read yet")
    }

    /// The seam the shell reads the distinction off — `reading.header != nil`. Asserted because the
    /// enum being right settles nothing if the deck is handed the wrong case.
    @MainActor
    @Test
    func `the reading names a header for a Session on screen and none for no selection`() {
        let chosen = SessionsRoomReading(
            presentation: .preview,
            sessionID: CockpitPresentation.preview.sessions.first?.id,
        )
        let none = SessionsRoomReading(presentation: .preview, sessionID: nil)

        #expect(chosen.header != nil)
        #expect(none.header == nil)
    }
}
