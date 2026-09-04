import AppKit
@testable import ArgoUI
import Testing

/// How the reader comes to have a cursor in the reading at all.
///
/// The reading holding the keyboard is not the reader DRIVING it: a click makes the table first
/// responder every bit as much as a Tab does (#533), and so does the deck opening on a Session
/// picked in the roster (#1180). So the ring is drawn for the arrivals the reader steered — a Tab
/// in, a key pressed in the reading — and for no other.
@Suite("Feed keyboard cursor arriving")
@MainActor
struct FeedCursorArrivalTests {
    /// A click that lands in a reading the keyboard was NOT in makes the table first responder
    /// exactly as a Tab does, and only one of the two is a reader asking for a cursor.
    @Test
    func `the keyboard arriving under a pointer draws no cursor`() async throws {
        let arrival = try await FeedCursorFixture.arrival(byKeyboard: false)
        arrival.coordinator.focus(onto: FeedCursorFixture.rows[1].id)

        arrival.window.makeFirstResponder(arrival.table)

        #expect(arrival.coordinator.cursorRow == nil)
    }

    /// The reader whose keys are somewhere else in the cockpit — the roster, the composer — is a
    /// keyboard reader, and the table arriving because they picked a Session is not them asking
    /// this reading for a cursor (#1180).
    @Test
    func `the keyboard arriving other than by a Tab draws no cursor`() async throws {
        let arrival = try await FeedCursorFixture.arrival()
        arrival.coordinator.step(focusBy: 1)
        arrival.window.makeFirstResponder(nil)
        arrival.table.currentEvent = { FeedEventFixture.arrowDown() }

        arrival.window.makeFirstResponder(arrival.table)

        #expect(arrival.coordinator.cursorRow == nil)
    }

    /// The one arrival the reader steered: they tabbed into the reading, so the reading tells them
    /// where the next key will land.
    @Test
    func `a Tab into the reading draws the cursor`() async throws {
        let arrival = try await FeedCursorFixture.arrival()
        arrival.coordinator.step(focusBy: 1)
        arrival.window.makeFirstResponder(nil)
        arrival.table.currentEvent = { FeedEventFixture.tab() }

        arrival.window.makeFirstResponder(arrival.table)

        #expect(arrival.coordinator.cursorRow == 0)
    }

    /// The deck the reader comes back to is the one they left (`KeptDecks`), so the row they had
    /// arrowed to is still on it. Selecting the Session again is a click and not a key, and a ring
    /// standing on that row would be one nobody asked for this time round (#1180).
    @Test
    func `a Session brought back to the front draws no cursor`() async {
        let shell = await Self.arrowedThenLeft()

        await shell.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)

        #expect(shell.coordinator.cursorRow == nil)
    }

    /// And the row goes with the ring, so the next arrow lands where `landing(_:in:)` puts a first
    /// press — on a row the reader can see — rather than stepping off one they left a document ago.
    @Test
    func `a Session brought back to the front keeps no row to step from`() async {
        let shell = await Self.arrowedThenLeft()

        await shell.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)

        #expect(shell.coordinator.focusedRow == nil)
    }

    /// One Session arrowed through and then left for another, which is the state a reader is in
    /// every time they come back to one.
    private static func arrowedThenLeft() async -> FeedSwitchDeck {
        let shell = FeedSwitchDeck()
        await shell.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)
        shell.coordinator.noteKeyboard(true)
        shell.coordinator.step(focusBy: 1)
        await shell.show(FeedSwitchFixture.bravoRows, of: FeedSwitchFixture.bravo)
        return shell
    }
}
