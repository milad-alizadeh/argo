@testable import ArgoEngine
import Foundation
import Testing

/// What Argo remembers about one CLI's built-in commands between launches (#686).
///
/// Reading them costs a hidden session and the seconds a TUI takes to draw, so the answer is kept.
/// It is kept AGAINST the version string, because that is the only thing that says the answer is
/// still about the CLI installed now.
@Suite("Built-in command store")
@MainActor
struct BuiltinCommandStoreTests {
    let fileURL: URL

    init() {
        self.fileURL = FileManager.default.temporaryDirectory
            .appending(path: "argo-builtins-\(UUID().uuidString).json")
    }

    @Test
    func `answers nothing before any read has been kept`() {
        #expect(store.commands(reportedBy: "2.1.231") == nil)
    }

    @Test
    func `hands back the read it kept for the version that produced it`() {
        store.remember(compact, reportedBy: "2.1.231")
        #expect(store.commands(reportedBy: "2.1.231") == compact)
    }

    /// The upgrade case, and the whole reason the version is the key: the kept answer describes a
    /// CLI that is no longer installed, so it is not an answer about this one.
    @Test
    func `answers nothing once the CLI reports a different version`() {
        store.remember(compact, reportedBy: "2.1.231")
        #expect(store.commands(reportedBy: "2.2.0") == nil)
    }

    /// A CLI that will not say what version it is cannot have its answer keyed, so nothing is kept
    /// and nothing is handed back — a fresh read every time, rather than a stale one forever.
    @Test
    func `keeps nothing for a CLI that reports no version`() {
        store.remember(compact, reportedBy: nil)
        #expect(store.commands(reportedBy: nil) == nil)
    }

    /// A harness that named no file must not read or write the machine's own — `OwnedStateFile`'s
    /// rule, restated here because this store is the one a render harness holds.
    @Test
    func `remembers nothing at all when no file was named`() {
        let nowhere = BuiltinCommandStore(fileURL: nil)
        nowhere.remember(compact, reportedBy: "2.1.231")
        #expect(nowhere.commands(reportedBy: "2.1.231") == nil)
    }

    private var store: BuiltinCommandStore {
        BuiltinCommandStore(fileURL: fileURL)
    }

    private let compact = [BuiltinCommand(name: "compact", description: "Free up context.")]
}
