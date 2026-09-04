@testable import ArgoEngine
import Foundation
import Testing

/// The Model and Effort a New Session opens on, across launches (#1175).
@Suite("Last picked run")
@MainActor
struct SessionRunStoreTests {
    @Test func `nothing picked yet opens on Opus 5 and Medium`() {
        let file = Self.temporaryFileURL()
        defer { try? FileManager.default.removeItem(at: file) }

        #expect(SessionRunStore(fileURL: file).lastPicked() == SessionRun.unpicked)
    }

    @Test func `the Model last picked is the one a New Session opens on`() {
        let file = Self.temporaryFileURL()
        defer { try? FileManager.default.removeItem(at: file) }
        let store = SessionRunStore(fileURL: file)

        store.remember(.model("sonnet"))

        #expect(store.lastPicked().model == "sonnet")
    }

    /// Every rung, because the file's vocabulary is its own and a rung missing from it would be
    /// silently forgotten.
    @Test(arguments: SessionEffort.allCases)
    func `every Effort rung survives the file`(effort: SessionEffort) {
        let file = Self.temporaryFileURL()
        defer { try? FileManager.default.removeItem(at: file) }

        SessionRunStore(fileURL: file).remember(.effort(effort))

        #expect(SessionRunStore(fileURL: file).lastPicked().effort == effort)
    }

    /// The restart: a second store over the same file is the next launch, and it has to read back
    /// what the last one wrote.
    @Test func `a second store over the same file finds both halves`() {
        let file = Self.temporaryFileURL()
        defer { try? FileManager.default.removeItem(at: file) }
        SessionRunStore(fileURL: file).remember(.model("haiku"))

        SessionRunStore(fileURL: file).remember(.effort(.max))

        #expect(SessionRunStore(fileURL: file).lastPicked()
            == SessionRun(model: "haiku", effort: .max))
    }

    /// One knob at a time is how the popover sets them, so writing one must not reset the other to
    /// the default — the failure a whole-pair write would have.
    @Test func `picking one knob leaves the other where it was`() {
        let file = Self.temporaryFileURL()
        defer { try? FileManager.default.removeItem(at: file) }
        let store = SessionRunStore(fileURL: file)
        store.remember(.effort(.high))

        store.remember(.model("sonnet"))

        #expect(store.lastPicked() == SessionRun(model: "sonnet", effort: .high))
    }

    /// A model this Argo's table has never heard of is not normalised on the way in or out (#558's
    /// rule): the ids belong to the CLI, and a newer one is not an error.
    @Test func `a model Argo does not recognise survives the file verbatim`() {
        let file = Self.temporaryFileURL()
        defer { try? FileManager.default.removeItem(at: file) }

        SessionRunStore(fileURL: file).remember(.model("claude-mythos-6"))

        #expect(SessionRunStore(fileURL: file).lastPicked().model == "claude-mythos-6")
    }

    @Test func `a store with no file remembers nothing`() {
        let store = SessionRunStore(fileURL: nil)

        store.remember(.model("sonnet"))

        #expect(store.lastPicked() == SessionRun.unpicked)
    }

    /// A file somebody hand-edited is not a crash and not a rung — it is the default, which is what
    /// an unreadable file has always meant here (ADR-0008). Each half on its own: a level off the
    /// ladder must not cost the reader the model beside it.
    @Test func `an Effort the file does not spell opens on Medium, keeping the model`() throws {
        let file = Self.temporaryFileURL()
        defer { try? FileManager.default.removeItem(at: file) }
        try #"{"model":"sonnet","effort":"ludicrous"}"#
            .write(to: file, atomically: true, encoding: .utf8)

        #expect(SessionRunStore(fileURL: file).lastPicked()
            == SessionRun(model: "sonnet", effort: .medium))
    }

    /// The crash leg of #1223: a file naming a placeholder names no model.
    @Test(arguments: ["<synthetic>", "<unknown>", "   "])
    func `a placeholder in the file opens on Opus 5`(placeholder: String) throws {
        let file = Self.temporaryFileURL()
        defer { try? FileManager.default.removeItem(at: file) }
        try #"{"model":"\#(placeholder)","effort":"high"}"#
            .write(to: file, atomically: true, encoding: .utf8)

        #expect(SessionRunStore(fileURL: file).lastPicked()
            == SessionRun(model: SessionRun.unpicked.model, effort: .high))
    }

    /// And it never gets INTO the file either, so one launch cannot hand it to the next.
    @Test func `a placeholder is not remembered as a pick`() {
        let file = Self.temporaryFileURL()
        defer { try? FileManager.default.removeItem(at: file) }
        let store = SessionRunStore(fileURL: file)
        store.remember(.model("sonnet"))

        store.remember(.model("<synthetic>"))

        #expect(store.lastPicked().model == "sonnet")
    }

    private static func temporaryFileURL() -> URL {
        URL(fileURLWithPath: NSTemporaryDirectory())
            .appending(path: "argo-run-\(UUID().uuidString.prefix(8)).json")
    }
}
