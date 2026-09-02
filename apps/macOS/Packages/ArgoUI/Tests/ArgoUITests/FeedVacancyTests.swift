@testable import ArgoUI
import Testing

/// The three empties the deck's reading zone can be, and that they read as three things (#404).
@Suite("Feed vacancy")
struct FeedVacancyTests {
    @Test
    func `a Session on screen with an empty reading is the surface's own silence`() {
        #expect(FeedVacancy.reading(hasSelection: true, hasSessions: true) == .silent)
    }

    /// The distinction the deck was missing: a window with work in it and none of it chosen.
    @Test
    func `a populated roster with nothing chosen says to choose`() {
        #expect(FeedVacancy.reading(hasSelection: false, hasSessions: true) == .unselected)
    }

    @Test
    func `an empty roster says there is nothing to choose`() {
        #expect(FeedVacancy.reading(hasSelection: false, hasSessions: false) == .noSessions)
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

    /// What the render of the empty window caught: the roster's own block and the connection chip
    /// both already say there are no Sessions, so a deck saying it too is one fact three times.
    /// This word names the deck and the way on instead.
    @Test
    func `the empty window's deck restates neither the roster nor the chip`() {
        #expect(!FeedVacancy.noSessions.words.contains("No Sessions"))
        #expect(!FeedVacancy.noSessions.words.contains("No live sessions"))
    }
}
