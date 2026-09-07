@testable import ArgoEngine
import Foundation
import Testing

@Suite("Remembered harness")
@MainActor
struct HarnessRememberingTests {
    @Test(arguments: AgentCLI.allCases)
    func `the selected harness survives reopening the run configuration`(harness: AgentCLI) throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        let file = fixture.rootURL.appending(path: "run.json")
        let store = SessionRunStore(fileURL: file)
        store.rememberHarness(harness)
        store.remember(.model("sonnet"))
        store.remember(.effort(.high))
        let reopened = SessionRunStore(fileURL: file)
        #expect(reopened.lastHarness() == harness)
        #expect(reopened.lastPicked() == SessionRun(model: "sonnet", effort: .high))
    }

    @Test
    func `changing the harness preserves the chosen Model and Effort`() throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        let file = fixture.rootURL.appending(path: "run.json")
        let store = SessionRunStore(fileURL: file)
        store.remember(.model("sonnet"))
        store.remember(.effort(.high))
        store.rememberHarness(.codex)
        let reopened = SessionRunStore(fileURL: file)
        #expect(reopened.lastHarness() == .codex)
        #expect(reopened.lastPicked() == SessionRun(model: "sonnet", effort: .high))
    }

    @Test
    func `an older run configuration defaults to Claude Code`() throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        let file = fixture.rootURL.appending(path: "run.json")
        try Data(#"{"model":"sonnet","effort":"high"}"#.utf8).write(to: file)
        let store = SessionRunStore(fileURL: file)
        #expect(store.lastHarness() == .claude)
        #expect(store.lastPicked() == SessionRun(model: "sonnet", effort: .high))
    }
}
