@testable import ArgoEngine
import Foundation
import Testing

/// The third annotation: what the code host said about the Work Item a Session's branch names
/// (#745). Persisted for the reason the other two are — a roster that read it fresh every launch
/// would open on `/implement 745` until the network answered.
@Suite("Session ticket title store")
struct SessionTicketTitleStoreTests {
    @Test
    func `a Session keeps the ticket title it resolved to on the next launch`() async {
        let file = AnnotationFile()
        defer { file.remove() }

        await file.store().setTicket(.named("Derive the Work Item link"), sessionID: "chain-a")
        // A second store over the same file is what relaunching Argo amounts to.
        let annotations = await file.store().load()

        #expect(annotations.ticket("chain-a") == .named("Derive the Work Item link"))
    }

    @Test
    func `a ticket the host has nothing behind is remembered as having nothing behind it`() async {
        let file = AnnotationFile()
        defer { file.remove() }

        await file.store().setTicket(.absent, sessionID: "chain-a")

        // Told apart from "nobody has asked", because only one of the two may still draw the link:
        // a branch naming a ticket that does not exist has no link (`CONTEXT.md`, "Honesty tier").
        #expect(await file.store().load().ticket("chain-a") == .absent)
    }

    @Test
    func `a Session nobody has asked about carries no reading at all`() async {
        let file = AnnotationFile()
        defer { file.remove() }

        await file.store().setName("Named, never resolved", sessionID: "chain-a")

        #expect(await file.store().load().ticket("chain-a") == nil)
    }

    @Test
    func `the user's own name and the ticket's reading are two facts, not one`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let store = file.store()

        await store.setName("Tonight's run", sessionID: "chain-a")
        await store.setTicket(.named("Derive the Work Item link"), sessionID: "chain-a")

        // Argo writes one rung and the user writes the other, so a resolve must not overwrite a
        // rename — and Reset must still have a ticket title left to go back to.
        let annotations = await store.load()
        #expect(annotations.explicitName("chain-a") == "Tonight's run")
        #expect(annotations.ticket("chain-a") == .named("Derive the Work Item link"))
    }

    @Test
    func `a Session left with nothing but a cleared reading is not kept`() async throws {
        let file = AnnotationFile()
        defer { file.remove() }
        let store = file.store()

        await store.setTicket(.named("Named for a moment"), sessionID: "chain-a")
        await store.setTicket(nil, sessionID: "chain-a")

        #expect(try file.read().contains("chain-a") == false)
    }

    @Test
    func `a file written before ticket readings existed still reads`() async throws {
        let file = AnnotationFile()
        defer { file.remove() }
        try file.write(#"{ "sessions": { "chain-a": { "archived": true, "name": "Mine" } } }"#)

        let annotations = await file.store().load()

        #expect(annotations.explicitName("chain-a") == "Mine")
        #expect(annotations.ticket("chain-a") == nil)
    }

    @Test
    func `a file that knew only the title still reads as a named ticket`() async throws {
        let file = AnnotationFile()
        defer { file.remove() }
        try file.write(#"{ "sessions": { "chain-a": { "ticketTitle": "Anchor the feed" } } }"#)

        // The title key is unchanged on purpose: a build that knew one ticket state must not lose
        // its titles to the build that knows two.
        #expect(await file.store().load().ticket("chain-a") == .named("Anchor the feed"))
    }
}
