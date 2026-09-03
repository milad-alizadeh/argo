@testable import ArgoEngine
import Foundation
import Testing

/// The effort level as the record reports it (#558).
///
/// The shape is verbatim from a `claude` 2.1.257 transcript: `effort` is a TOP-LEVEL field beside
/// `cwd` and `gitBranch`, not one of the message's — the host files it as a fact about the process
/// writing the record rather than about the reply, which is where `model` sits.
@Suite("Effort reading")
struct EffortReadingTests {
    private func words(_ events: [TranscriptEvent]) -> [String] {
        events.compactMap { event in
            guard case let .effort(cli) = event else { return nil }
            return cli
        }
    }

    private func line(effort: String?, uuid: String = "u") -> String {
        let field = effort.map { "\"effort\": \"\($0)\", " } ?? ""
        return """
        {"type": "user", "message": {"role": "user", "content": "hi"}, "uuid": "\(uuid)", \
        \(field)"cwd": "/tmp/argo", "sessionId": "s"}
        """
    }

    @Test
    func `the CLI's own word is read verbatim`() async {
        let read = await words(TranscriptReader().read(line: line(effort: "xhigh")))

        #expect(read == ["xhigh"])
    }

    /// A word this Argo has never heard of still reaches the composer. It is the CLI that owns the
    /// ladder, so a sixth level is a level, not a parse failure.
    @Test
    func `a level off Argo's own ladder is read anyway`() async {
        let read = await words(TranscriptReader().read(line: line(effort: "ludicrous")))

        #expect(read == ["ludicrous"])
        #expect(ClaudeEffort.reading(of: "ludicrous") == .unknown(cli: "ludicrous"))
    }

    /// LATEST reading wins and only a CHANGE is announced — `/effort` moves it mid-session, and a
    /// level re-announced once per record would bury the events anybody is watching for.
    @Test
    func `only a change in the level is announced`() async {
        let reader = TranscriptReader()
        let lines = [
            line(effort: "medium", uuid: "u1"),
            line(effort: "medium", uuid: "u2"),
            line(effort: "high", uuid: "u3"),
        ]

        let read = await words(reader.read(lines: lines))

        #expect(read == ["medium", "high"])
    }

    @Test
    func `a record carrying no level announces none`() async {
        let read = await words(TranscriptReader().read(line: line(effort: nil)))

        #expect(read.isEmpty)
    }
}
