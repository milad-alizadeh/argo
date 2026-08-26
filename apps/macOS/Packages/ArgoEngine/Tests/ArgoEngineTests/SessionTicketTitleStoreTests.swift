@testable import ArgoEngine
import Foundation
import Testing

/// The third annotation: the Work Item title a Session's branch resolved to (#745). Persisted for
/// the reason the other two are — a roster that read it fresh every launch would open on
/// `/implement 745` until the network answered.
@Suite("Session ticket title store")
struct SessionTicketTitleStoreTests {
    @Test
    func `a Session keeps the ticket title it resolved to on the next launch`() async {
        let file = AnnotationFile()
        defer { file.remove() }

        await file.store().setTicketTitle("Derive the Work Item link", sessionID: "chain-a")
        // A second store over the same file is what relaunching Argo amounts to.
        let annotations = await file.store().load()

        #expect(annotations.ticketTitle("chain-a") == "Derive the Work Item link")
    }

    @Test
    func `a ticket whose title no longer resolves gives the title back`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let store = file.store()
        await store.setTicketTitle("A title read from a ticket since deleted", sessionID: "chain-a")

        await store.setTicketTitle(nil, sessionID: "chain-a")

        // Degrade-down (`CONTEXT.md`, "Honesty tier"): the link that stopped resolving reads as
        // no link, never as the last answer that worked.
        #expect(await store.load().ticketTitle("chain-a") == nil)
    }

    @Test
    func `the user's own name and the ticket's title are two facts, not one`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let store = file.store()

        await store.setName("Tonight's run", sessionID: "chain-a")
        await store.setTicketTitle("Derive the Work Item link", sessionID: "chain-a")

        // Argo writes one rung and the user writes the other, so a resolve must not overwrite a
        // rename — and Reset must still have a ticket title left to go back to.
        let annotations = await store.load()
        #expect(annotations.explicitName("chain-a") == "Tonight's run")
        #expect(annotations.ticketTitle("chain-a") == "Derive the Work Item link")
    }

    @Test
    func `a Session left with nothing but a cleared ticket title is not kept`() async throws {
        let file = AnnotationFile()
        defer { file.remove() }
        let store = file.store()

        await store.setTicketTitle("Named for a moment", sessionID: "chain-a")
        await store.setTicketTitle(nil, sessionID: "chain-a")

        #expect(try file.read().contains("chain-a") == false)
    }

    @Test
    func `a file written before ticket titles existed still reads`() async throws {
        let file = AnnotationFile()
        defer { file.remove() }
        try file.write(#"{ "sessions": { "chain-a": { "archived": true, "name": "Mine" } } }"#)

        let annotations = await file.store().load()

        #expect(annotations.explicitName("chain-a") == "Mine")
        #expect(annotations.ticketTitle("chain-a") == nil)
    }
}
