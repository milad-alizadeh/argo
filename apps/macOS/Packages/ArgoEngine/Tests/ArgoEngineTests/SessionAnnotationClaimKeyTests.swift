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

        await store.rekeying([claim: sessionID])

        // The gesture the reader made, still in force on the row they made it on.
        #expect(await store.load().isArchived(sessionID))
    }

    /// The second symptom rides the same key: `setTicket` writes through the same door, so a title
    /// read for one Session captioned the next launch's spawn under the same number.
    @Test
    func `a held ticket title moves with the row it was read for`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let store = file.store()
        await store.setTicket(.named("Something else entirely"), sessionID: claim)

        await store.rekeying([claim: sessionID])

        let annotations = await store.load()
        #expect(annotations.ticket(sessionID) == .named("Something else entirely"))
        #expect(annotations.ticket(claim) == nil)
    }

    @Test
    func `the claim id is not left behind to answer for a later Session`() async throws {
        let file = AnnotationFile()
        defer { file.remove() }
        let store = file.store()
        await store.setArchived(true, sessionID: claim)

        await store.rekeying([claim: sessionID])

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

        await store.rekeying([claim: sessionID])

        let annotations = await store.load()
        #expect(annotations.explicitName(sessionID) == "durable")
        #expect(annotations.explicitName(claim) == nil)
    }

    @Test
    func `a row that was never annotated moves nothing and writes nothing`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let store = file.store()

        await store.rekeying([claim: sessionID])

        // No file at all rather than an empty one: nothing moved, so nothing was written.
        #expect(FileManager.default.fileExists(atPath: file.url.path) == false)
    }

    /// The 47 keys already on this machine's file, off the counter that restarted with the app.
    @Test
    func `a launch drops the recycled claim keys a previous build left`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let store = file.store()
        await store.setArchived(true, sessionID: "claim-3")
        await store.setArchived(true, sessionID: sessionID)

        await store.dropRecycledKeys()

        let annotations = await store.load()
        #expect(annotations.isArchived("claim-3") == false)
        #expect(annotations.isArchived(sessionID))
    }

    /// A salted key names ONE launch, and that launch may be a second Argo reading this file right
    /// now — its provisional rows have not re-keyed yet. Sweeping those on every start would throw
    /// away a live process's decisions before it could move them.
    @Test
    func `a launch leaves another launch's salted claim keys alone`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let store = file.store()
        await store.setArchived(true, sessionID: claim)

        await store.dropRecycledKeys()

        #expect(await store.load().isArchived(claim))
    }
}
