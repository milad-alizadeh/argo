@testable import ArgoEngine
import Foundation
import Testing

/// The billing guard and the empty answer, asserted rather than documented (#1315, ADR-0031).
///
/// None of this needs the CLI: the environment and the argument list are what Argo hands over, and
/// a guard whose only proof is the machine it happened to run on is a guard nobody checked.
@Suite("Codex exec run")
struct CodexExecRunTests {
    /// The claim ADR-0031 rests on, run against an environment that HOLDS the key — a scrub tested
    /// against an environment without one passes when the scrub is deleted.
    @Test
    func `the key that would meter never reaches the child`() {
        let environment = CodexExecRun.environment(
            path: "/usr/bin",
            inheriting: ["OPENAI_API_KEY": "sk-live", "HOME": "/Users/reader"],
        )

        #expect(environment["OPENAI_API_KEY"] == nil)
        #expect(environment["HOME"] == "/Users/reader")
        #expect(environment["PATH"] == "/usr/bin")
    }

    /// One rule, read from where it already lives: whatever ADR-0024 scrubs off a spawned Codex is
    /// scrubbed here, so a name added there covers this path the day it is added.
    @Test
    func `the scrub is the same list a spawned Codex is cleaned with`() {
        let inherited = Dictionary(
            uniqueKeysWithValues: AgentCLI.codex.scrubbedFromEnvironment.map { ($0, "set") },
        )

        let environment = CodexExecRun.environment(path: "/usr/bin", inheriting: inherited)

        #expect(AgentCLI.codex.scrubbedFromEnvironment.allSatisfy { environment[$0] == nil })
    }

    @Test
    func `the invocation is ephemeral, read-only and ignores a local config`() throws {
        let run = try CodexExecRun()
        defer { run.clean() }

        let arguments = run.arguments

        #expect(arguments.first == "exec")
        #expect(arguments.contains("--ephemeral"))
        #expect(arguments.contains("--ignore-user-config"))
        #expect(arguments.contains("read-only"))
        #expect(arguments.last == "-")
    }

    /// The working root is the sandbox: empty, so a model that ignored its prompt finds no
    /// repository to read.
    @Test
    func `the working root exists and holds nothing`() throws {
        let run = try CodexExecRun()
        defer { run.clean() }

        let held = try FileManager.default.contentsOfDirectory(atPath: run.directory.path)

        #expect(held.isEmpty)
        #expect(run.arguments.contains(run.directory.path))
    }

    /// The shape this port exists to catch: a reader shown a blank sheet reads it as an answer
    /// about the backlog.
    @Test
    func `an exit of zero that wrote nothing is refused, not answered`() throws {
        let run = try CodexExecRun()
        defer { run.clean() }
        try "".write(to: run.answer, atomically: true, encoding: .utf8)

        #expect(refusal(run.result(exitCode: 0))?.sentence.contains("answered nothing") == true)
    }

    @Test
    func `a non-zero exit is refused and names the code`() throws {
        let run = try CodexExecRun()
        defer { run.clean() }
        try "half an answer".write(to: run.answer, atomically: true, encoding: .utf8)

        #expect(refusal(run.result(exitCode: 3))?.sentence.contains("3") == true)
    }

    @Test
    func `prose written by the CLI comes back trimmed`() throws {
        let run = try CodexExecRun()
        defer { run.clean() }
        try "  #2 is the one.\n\n".write(to: run.answer, atomically: true, encoding: .utf8)

        #expect(try run.result(exitCode: 0).get() == "#2 is the one.")
    }

    @Test
    func `the scratch directory is gone once the question is done`() throws {
        let run = try CodexExecRun()

        run.clean()

        #expect(!FileManager.default.fileExists(atPath: run.directory.path))
    }

    private func refusal(_ outcome: Result<String, BacklogAskRefusal>) -> BacklogAskRefusal? {
        switch outcome {
        case .success: nil
        case let .failure(refusal): refusal
        }
    }
}
