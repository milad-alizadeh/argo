@testable import ArgoEngine
import Testing

/// Ending an orphaned Claude process by the Session id Argo put on its argv (#1609). The process
/// table is the boundary under test; no folder participates, because two agents may share one.
@Suite("Orphaned Session process")
struct OrphanedSessionProcessTests {
    @Test
    func `one exact argv match is ended`() async {
        let signalled = RecordedProcessSignals()
        let arguments: [Int32: [String]] = [
            1201: ["/A Path With Spaces/claude", "--session-id", "somebody-elses-session"],
            1202: ["claude", "--resume", "somebody-elses-session"],
            // A shebang or package-manager shim may leave the live process behind an interpreter.
            1204: [
                "node",
                "/Users/me/.claude/local/claude-code/cli.js",
                "--session-id",
                "session-from-cli",
            ],
            // Prompt prose is one argument, however its whitespace looks after `ps` flattens it.
            1205: ["claude", "please inspect --session-id session-from-cli"],
        ]
        let process = process(table: Self.uniqueTable, arguments: arguments, signalled: signalled)

        let result = await process.endClaudeSession(identifiedBy: ["session-from-cli"])

        #expect(result == .ended)
        #expect(signalled.values == [1204])
    }

    @Test
    func `an ambiguous argv match ends nothing`() async {
        let signalled = RecordedProcessSignals()
        let arguments: [Int32: [String]] = [
            1201: ["claude", "--session-id", "session-from-cli"],
            1202: ["claude", "--resume", "session-from-cli"],
        ]
        let process = process(
            table: Self.ambiguousTable,
            arguments: arguments,
            signalled: signalled,
        )

        let result = await process.endClaudeSession(identifiedBy: ["session-from-cli"])

        #expect(result == .ambiguous)
        #expect(signalled.values.isEmpty)
    }

    @Test
    func `a target-bearing process with multiple identifier flags makes the join ambiguous`() async {
        let signalled = RecordedProcessSignals()
        let arguments: [Int32: [String]] = [
            1201: ["claude", "--session-id", "session-from-cli"],
            1202: [
                "node", "/Users/me/.claude/local/claude-code/cli.js",
                "--resume", "session-from-cli", "--session-id", "somebody-elses-session",
            ],
        ]
        let process = process(
            table: Self.ambiguousTable,
            arguments: arguments,
            signalled: signalled,
        )

        let result = await process.endClaudeSession(identifiedBy: ["session-from-cli"])

        #expect(result == .ambiguous)
        #expect(signalled.values.isEmpty)
    }

    private func process(
        table: String,
        arguments: [Int32: [String]],
        signalled: RecordedProcessSignals,
    )
        -> OrphanedSessionProcess {
        OrphanedSessionProcess(services: .init(
            run: { _ in table },
            arguments: { arguments[$0] },
            signal: signalled.record,
        ))
    }

    private static let uniqueTable = """
      1201
      1202
      1203
      1204
      1205
    """

    private static let ambiguousTable = """
      1201
      1202
    """
}
