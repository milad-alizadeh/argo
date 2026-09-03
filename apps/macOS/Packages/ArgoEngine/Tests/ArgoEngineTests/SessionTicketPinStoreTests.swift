@testable import ArgoEngine
import Foundation
import Testing

/// The fourth annotation: the Ticket a reader attached to a Session by hand (#1092).
///
/// The one link that does not come off a branch. Argo derives a number from `#<N>` in a branch or
/// from a `ticket-<N>-` worktree folder, and a checkout named after words instead — which most of
/// them are — has neither, so nothing ever placed those Sessions on a Ticket and no route between
/// the two could appear in either direction. This is what a reader repairs it with, so it is
/// persisted on the same terms the rename is: a decision, kept across launches.
@Suite("Session ticket pin store")
struct SessionTicketPinStoreTests {
    @Test
    func `a Session keeps the ticket a reader pinned it to on the next launch`() async {
        let file = AnnotationFile()
        defer { file.remove() }

        await file.store().setPinnedTicket(1092, sessionID: "chain-a")
        // A second store over the same file is what relaunching Argo amounts to.
        #expect(await file.store().load().pinnedTicket("chain-a") == 1092)
    }

    @Test
    func `dropping the pin is nil, and leaves nothing behind`() async throws {
        let file = AnnotationFile()
        defer { file.remove() }
        let store = file.store()

        await store.setPinnedTicket(1092, sessionID: "chain-a")
        await store.setPinnedTicket(nil, sessionID: "chain-a")

        #expect(await store.load().pinnedTicket("chain-a") == nil)
        // The reset is the absence of a record, never a record of a reset: an annotation asserting
        // nothing is dropped, so the derived link comes straight back.
        #expect(try file.read().contains("chain-a") == false)
    }

    /// The trap the pin has and the rename does not: the held title was read for the number that
    /// was there before it. Kept, a pin moved from #388 to #609 would print #388's words under
    /// #609's number until the next resolve landed.
    @Test
    func `moving the pin drops the title read for the ticket it moved off`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let store = file.store()

        await store.setPinnedTicket(388, sessionID: "chain-a")
        await store.setTicket(.named("Ticket read path"), sessionID: "chain-a")
        await store.setPinnedTicket(609, sessionID: "chain-a")

        let annotations = await store.load()
        #expect(annotations.pinnedTicket("chain-a") == 609)
        #expect(annotations.ticket("chain-a") == nil)
    }

    /// …and a pin RE-set to the number it already holds is not a move, so the title it already
    /// resolved to survives: re-picking the ticket a Session is on must not cost it its name.
    @Test
    func `re-pinning the same ticket keeps the title already read for it`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let store = file.store()

        await store.setPinnedTicket(388, sessionID: "chain-a")
        await store.setTicket(.named("Ticket read path"), sessionID: "chain-a")
        await store.setPinnedTicket(388, sessionID: "chain-a")

        #expect(await store.load().ticket("chain-a") == .named("Ticket read path"))
    }

    @Test
    func `the reader's pin and the reader's name are two facts, not one`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let store = file.store()

        await store.setName("Tonight's run", sessionID: "chain-a")
        await store.setPinnedTicket(1092, sessionID: "chain-a")

        let annotations = await store.load()
        #expect(annotations.explicitName("chain-a") == "Tonight's run")
        #expect(annotations.pinnedTicket("chain-a") == 1092)
    }

    /// A ticket number is a positive integer. Nothing in the picker can produce another, but a
    /// hand-edited file can, and a `#0` link would render a route to a Ticket no provider has.
    @Test
    func `a number no provider could have is no pin at all`() async throws {
        let file = AnnotationFile()
        defer { file.remove() }
        try file.write(#"{ "sessions": { "chain-a": { "ticketNumber": 0 } } }"#)

        #expect(await file.store().load().pinnedTicket("chain-a") == nil)
    }

    @Test
    func `a file written before pins existed still reads`() async throws {
        let file = AnnotationFile()
        defer { file.remove() }
        try file.write(#"{ "sessions": { "chain-a": { "archived": true, "name": "Mine" } } }"#)

        let annotations = await file.store().load()

        #expect(annotations.explicitName("chain-a") == "Mine")
        #expect(annotations.pinnedTicket("chain-a") == nil)
    }
}
