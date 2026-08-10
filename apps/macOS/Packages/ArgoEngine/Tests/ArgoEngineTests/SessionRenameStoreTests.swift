@testable import ArgoEngine
import Foundation
import Testing

/// The second annotation, round-tripped through the same throwaway `userData` location the first
/// one is. Renaming is only worth doing because the name outlives the launch it was typed in
/// (#502, story 21), and that claim is a claim about a file.
@Suite("Session rename store")
struct SessionRenameStoreTests {
    @Test
    func `a Session keeps the name it was given on the next launch`() async {
        let file = AnnotationFile()
        defer { file.remove() }

        await file.store().setName("Nightly rename run", sessionID: "chain-a")
        // A second store over the same file is what relaunching Argo amounts to: nothing of the
        // first one's memory survives, so anything read here came off disk.
        let annotations = await file.store().load()

        #expect(annotations.explicitName("chain-a") == "Nightly rename run")
    }

    @Test
    func `resetting a name puts the Session back to having none`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let store = file.store()
        await store.setName("A typo I can no longer see the original of", sessionID: "chain-a")

        await store.setName(nil, sessionID: "chain-a")

        // The reset is the rename unmade, and it reaches disk: a name that came back on the
        // next launch would make Reset a thing you have to do once per launch, forever.
        #expect(await file.store().load().explicitName("chain-a") == nil)
    }

    @Test
    func `a name of nothing but spaces is not a name`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let store = file.store()

        await store.setName("   Trimmed at both ends   ", sessionID: "chain-a")
        await store.setName("   ", sessionID: "chain-b")

        // What somebody typed, trimmed — and blank is the absence, not a title made of spaces.
        #expect(await store.load().explicitName("chain-a") == "Trimmed at both ends")
        #expect(await store.load().explicitName("chain-b") == nil)
    }

    @Test
    func `naming a Session leaves what was archived alone, and the other way round`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let store = file.store()

        await store.setArchived(true, sessionID: "chain-a")
        await store.setName("Cleared, and named", sessionID: "chain-a")
        await store.setArchived(false, sessionID: "chain-a")

        // Two annotations on one Session, each written through the same record: the second one
        // slotting in must not be the first one being overwritten.
        let annotations = await store.load()
        #expect(annotations.explicitName("chain-a") == "Cleared, and named")
        #expect(annotations.isArchived("chain-a") == false)
    }

    @Test
    func `a Session left with no annotation at all is not kept`() async throws {
        let file = AnnotationFile()
        defer { file.remove() }
        let store = file.store()

        await store.setName("Named for a moment", sessionID: "chain-a")
        await store.setName(nil, sessionID: "chain-a")

        // A record per Session ever named would grow this file with names nobody set.
        #expect(try file.read().contains("chain-a") == false)
    }

    @Test
    func `a file written before names existed still reads`() async throws {
        let file = AnnotationFile()
        defer { file.remove() }
        try file.write(#"{ "sessions": { "chain-a": { "archived": true } } }"#)

        let annotations = await file.store().load()

        // The build that wrote this knew one fact. Reading it under a build that knows two must
        // not fail the archive beside the name it never carried.
        #expect(annotations.isArchived("chain-a"))
        #expect(annotations.explicitName("chain-a") == nil)
    }
}
