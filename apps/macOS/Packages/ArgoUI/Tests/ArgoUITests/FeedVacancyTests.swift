@testable import ArgoUI
import Testing

/// The three empties the deck's reading zone can be, and that they read as three things (#404).
@Suite("Feed vacancy")
struct FeedVacancyTests {
    /// One row of the truth table. A named value rather than a tuple, which the cap on those
    /// forbids at three members.
    struct Window {
        let hasSelection: Bool
        let hasSessions: Bool
        let vacancy: FeedVacancy
    }

    /// The whole truth table, as a table. The middle row is the distinction the deck was missing: a
    /// window with work on its roster and none of it chosen.
    @Test(arguments: [
        Window(hasSelection: true, hasSessions: true, vacancy: .silent),
        Window(hasSelection: false, hasSessions: true, vacancy: .unselected),
        Window(hasSelection: false, hasSessions: false, vacancy: .noSessions),
    ])
    func `which empty a window is in`(window: Window) {
        #expect(
            FeedVacancy.reading(
                hasSelection: window.hasSelection,
                hasSessions: window.hasSessions,
            ) == window.vacancy,
        )
    }

    /// The point of the whole type: one word for all three is the state the deck was in, and the
    /// one it read as was the most broken of them.
    @Test
    func `the three say three different things`() {
        let said = Set([FeedVacancy.silent, .unselected, .noSessions].map(\.words))

        #expect(said.count == 3)
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
