@testable import ArgoEngine
import Foundation
import Testing

/// What a model is shown of the backlog, and what it is never shown (#1315).
@Suite("Backlog listing")
struct BacklogListingTests {
    @Test
    func `no ticket body reaches the listing`() {
        let lines = BacklogListing.lines(BacklogAskFixture.tickets)

        #expect(!lines.contains(BacklogAskFixture.body))
        #expect(!lines.contains("SECRET"))
    }

    @Test
    func `no ticket body reaches the prompt`() {
        let prompt = BacklogAskPrompt.text(
            question: "what is this about?", tickets: BacklogAskFixture.tickets,
        )

        #expect(!prompt.contains(BacklogAskFixture.body))
    }

    @Test
    func `the listing carries the number, status, type, priority and labels`() {
        let line = BacklogListing.line(BacklogAskFixture.tickets[0])

        #expect(line.contains("#1"))
        #expect(line.contains("[open]"))
        #expect(line.contains("type=bug"))
        #expect(line.contains("priority=P1"))
        #expect(line.contains("labels=bug"))
        #expect(line.contains("The roster row shows the wrong Session title after a spawn"))
    }

    /// The distinction the room draws everywhere else, held here too: a provider that served no
    /// edges has said nothing, and one that served an empty set has said the way is clear.
    @Test
    func `unread edges are absent from the line and cleared edges are stated`() {
        let unread = BacklogListing.line(BacklogAskFixture.tickets[2])
        let cleared = BacklogListing.line(BacklogAskFixture.tickets[5])
        let blocked = BacklogListing.line(BacklogAskFixture.tickets[3])

        #expect(!unread.contains("blockedBy"))
        #expect(cleared.contains("blockedBy=none"))
        #expect(blocked.contains("blockedBy=#6"))
    }

    /// A fact the provider did not serve is omitted, never spelled as a default a model would then
    /// answer from.
    @Test
    func `an absent priority is omitted rather than defaulted`() {
        let line = BacklogListing.line(BacklogAskFixture.tickets[2])

        #expect(!line.contains("priority="))
    }

    @Test
    func `every ticket gets one line`() {
        let lines = BacklogListing.lines(BacklogAskFixture.tickets)

        #expect(lines.split(whereSeparator: \.isNewline).count == BacklogAskFixture.tickets.count)
    }
}
