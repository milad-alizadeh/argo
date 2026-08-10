@testable import ArgoEngine
import Foundation
import Testing

/// The per-machine record of what a user did to a roster row, round-tripped through a throwaway
/// `userData` location rather than the machine's own — a suite that wrote to Application Support
/// would archive the Sessions of whoever ran it.
@Suite("Session annotation store")
struct SessionAnnotationStoreTests {
    @Test
    func `an archived Session is still archived on the next launch`() async {
        let file = AnnotationFile()
        defer { file.remove() }

        await file.store().setArchived(true, sessionID: "chain-a")
        // A second store over the same file is what relaunching Argo amounts to: nothing of the
        // first one's memory survives, so anything read here came off disk (#502, story 17).
        let annotations = await file.store().load()

        #expect(annotations.isArchived("chain-a"))
    }

    @Test
    func `re-observing a transcript does not clear an archive`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let store = file.store()
        await store.setArchived(true, sessionID: "chain-a")

        // What a stray tail on an archived Session's transcript amounts to here: the Hub reads
        // its annotations again, and another Session's row moves under it. Neither is a
        // decision, and only a decision may put a row back (#502, story 16).
        _ = await store.load()
        await store.setArchived(true, sessionID: "chain-b")
        let annotations = await store.load()

        #expect(annotations.isArchived("chain-a"))
        #expect(annotations.isArchived("chain-b"))
    }

    @Test
    func `a Session put back is put back on disk, not only in memory`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        await file.store().setArchived(true, sessionID: "chain-a")

        await file.store().setArchived(false, sessionID: "chain-a")

        #expect(await file.store().isArchived("chain-a") == false)
    }

    @Test
    func `a Session nothing was ever said about is not archived`() async {
        let file = AnnotationFile()
        defer { file.remove() }

        let annotations = await file.store().load()

        // An empty annotation, never a `nil` the caller has to answer for: absence here is the
        // answer rather than a gap in it.
        #expect(annotations.annotation(for: "chain-a") == SessionAnnotations.Annotation())
        #expect(annotations.isArchived("chain-a") == false)
    }

    @Test
    func `an annotations file that cannot be read annotates nothing`() async throws {
        let file = AnnotationFile()
        defer { file.remove() }
        try file.write("{ \"sessions\": { ")

        let annotations = await file.store().load()

        #expect(annotations == .empty)
        #expect(annotations.isArchived("chain-a") == false)
    }

    @Test
    func `a record asserting nothing is not kept`() async throws {
        let file = AnnotationFile()
        defer { file.remove() }
        let store = file.store()

        await store.setArchived(true, sessionID: "chain-a")
        await store.setArchived(false, sessionID: "chain-a")

        // A record per Session ever observed would grow this file with the machine's whole
        // history of transcripts and say nothing in any of them.
        #expect(try file.read().contains("chain-a") == false)
    }

    /// Archiving is a decision about a Session and nothing about a Project, so it is written
    /// beside registration rather than into it.
    @Test
    func `annotations are written to per-machine application support`() {
        let path = SessionAnnotationStore.defaultFileURL.path

        #expect(path.hasSuffix("/Argo/sessions.json"))
        #expect(path.contains("Application Support"))
        #expect(path != ProjectRegistryStore.defaultFileURL.path)
    }
}

private extension SessionAnnotationStore {
    func isArchived(_ sessionID: String) -> Bool {
        load().isArchived(sessionID)
    }
}

/// A throwaway `userData` location: a file that does not exist yet, under a folder that is
/// deleted when the test is done.
private struct AnnotationFile {
    let directoryURL = URL(fileURLWithPath: NSTemporaryDirectory())
        .appending(path: "argo-annotations-\(UUID().uuidString)", directoryHint: .isDirectory)

    var url: URL {
        directoryURL.appending(path: "Argo/sessions.json")
    }

    func store() -> SessionAnnotationStore {
        SessionAnnotationStore(fileURL: url)
    }

    func write(_ contents: String) throws {
        try FileManager.default.createDirectory(
            at: url.deletingLastPathComponent(),
            withIntermediateDirectories: true,
        )
        try contents.write(to: url, atomically: true, encoding: .utf8)
    }

    func read() throws -> String {
        try String(contentsOf: url, encoding: .utf8)
    }

    func remove() {
        try? FileManager.default.removeItem(at: directoryURL)
    }
}
