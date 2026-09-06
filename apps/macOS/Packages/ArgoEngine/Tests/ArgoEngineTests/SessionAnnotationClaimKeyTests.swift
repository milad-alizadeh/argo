@testable import ArgoEngine
import Foundation
import Testing

/// #1563. A fresh spawn's row stands under its CLAIM id until its transcript appears (#361), and
/// the annotation file is keyed by whatever the row's id is at the moment of the write. A claim id
/// is meaningful only inside the process that issued it, so a decision filed under one was both
/// lost at the re-key and left behind to answer for a Session nobody had opened yet.
@Suite("Session annotations under a claim id")
struct SessionAnnotationClaimKeyTests {
    private let claim = "claim-a1b2c3d4-3"
    private let sessionID = "/tmp/argo/11111111-2222-3333-4444-555555555555.jsonl"

    @Test
    func `an archive taken before the transcript exists survives the re-key`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let store = file.store()
        await store.setArchived(true, sessionID: claim)

        await store.carrying(off: [claim: sessionID])

        // The gesture the reader made, still in force on the row they made it on.
        #expect(await store.load().isArchived(sessionID))
    }

    @Test
    func `the claim id is not left behind to answer for a later Session`() async throws {
        let file = AnnotationFile()
        defer { file.remove() }
        let store = file.store()
        await store.setArchived(true, sessionID: claim)

        await store.carrying(off: [claim: sessionID])

        #expect(try file.read().contains(claim) == false)
    }

    /// The destination is a transcript that has only just been observed, so this is the rare case.
    /// The durable key is the subject either way, and what was said about it wins.
    @Test
    func `a decision already on the durable id is not overwritten by the provisional one`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let store = file.store()
        await store.setName("provisional", sessionID: claim)
        await store.setName("durable", sessionID: sessionID)

        await store.carrying(off: [claim: sessionID])

        let annotations = await store.load()
        #expect(annotations.explicitName(sessionID) == "durable")
        #expect(annotations.explicitName(claim) == nil)
    }

    @Test
    func `a row that was never annotated carries nothing and writes nothing`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let store = file.store()

        await store.carrying(off: [claim: sessionID])

        // No file at all rather than an empty one: nothing moved, so nothing was written.
        #expect(FileManager.default.fileExists(atPath: file.url.path) == false)
    }

    /// The 47 keys already on this machine's file. With claim ids no longer recycled they name
    /// nothing, and a launch that swept them keeps the file honest as well as inert.
    @Test
    func `a launch drops the claim keys a previous launch left`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let store = file.store()
        await store.setArchived(true, sessionID: claim)
        await store.setArchived(true, sessionID: sessionID)

        await store.dropProvisional()

        let annotations = await store.load()
        #expect(annotations.isArchived(claim) == false)
        #expect(annotations.isArchived(sessionID))
    }

    /// The counter's own spelling, which is what the 15 archived keys on disk are.
    @Test
    func `the sweep takes the ids a counter issued too`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let store = file.store()
        await store.setArchived(true, sessionID: "claim-3")

        await store.dropProvisional()

        #expect(await store.load().isArchived("claim-3") == false)
    }
}
