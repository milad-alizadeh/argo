@testable import ArgoEngine
import Foundation
import Testing

/// The rung a New Session opens on, across launches (#629).
@Suite("Last picked rung")
@MainActor
struct SessionModeStoreTests {
    @Test func `nothing picked yet opens on Code`() {
        let file = Self.temporaryFileURL()
        defer { try? FileManager.default.removeItem(at: file) }

        #expect(SessionModeStore(fileURL: file).lastPicked() == .code)
    }

    @Test func `the rung last picked is the one a New Session opens on`() {
        let file = Self.temporaryFileURL()
        defer { try? FileManager.default.removeItem(at: file) }
        let store = SessionModeStore(fileURL: file)

        store.remember(.auto)

        #expect(store.lastPicked() == .auto)
    }

    /// The restart: a second store over the same file is the next launch, and it has to read back
    /// what the last one wrote.
    @Test func `a second store over the same file finds the rung`() {
        let file = Self.temporaryFileURL()
        defer { try? FileManager.default.removeItem(at: file) }

        SessionModeStore(fileURL: file).remember(.readOnly)

        #expect(SessionModeStore(fileURL: file).lastPicked() == .readOnly)
    }

    /// Every rung, because the file's vocabulary is its own and a rung missing from it would be
    /// silently forgotten — Read Only and Plan especially, which the CLI mapping cannot tell apart.
    @Test(arguments: SessionMode.allCases)
    func `every rung survives the file`(mode: SessionMode) {
        let file = Self.temporaryFileURL()
        defer { try? FileManager.default.removeItem(at: file) }

        SessionModeStore(fileURL: file).remember(mode)

        #expect(SessionModeStore(fileURL: file).lastPicked() == mode)
    }

    @Test func `a store with no file remembers nothing`() {
        let store = SessionModeStore(fileURL: nil)

        store.remember(.auto)

        #expect(store.lastPicked() == .code)
    }

    /// A file somebody hand-edited is not a crash and not a rung — it is the baseline, which is
    /// what an unreadable file has always meant here (ADR-0008).
    @Test func `a rung the file does not spell opens on Code`() throws {
        let file = Self.temporaryFileURL()
        defer { try? FileManager.default.removeItem(at: file) }
        try #"{"rung":"yolo"}"#.write(to: file, atomically: true, encoding: .utf8)

        #expect(SessionModeStore(fileURL: file).lastPicked() == .code)
    }

    private static func temporaryFileURL() -> URL {
        URL(fileURLWithPath: NSTemporaryDirectory())
            .appending(path: "argo-mode-\(UUID().uuidString.prefix(8)).json")
    }
}
