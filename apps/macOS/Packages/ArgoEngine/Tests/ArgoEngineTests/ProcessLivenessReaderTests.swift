@testable import ArgoEngine
import Testing

/// The process table as `ps` and `lsof` actually print it, without a process table. What is left
/// untested is the two subprocesses themselves; everything they are read FOR is here.
@Suite("Process liveness reader")
struct ProcessLivenessReaderTests {
    private static let table = """
      1201 /opt/homebrew/bin/claude
      1202 /Applications/Argo.app/Contents/MacOS/Argo --project /Users/me/.claude/projects
      1203 node /Users/me/.claude/local/claude-code/cli.js
      1204 claude
    """

    /// One canned answer per command, matched on the tool name — which is all a reader that only
    /// ever runs two of them needs to be driven by.
    private static func shell(cwds: [String: String]) -> ShellCommand {
        { arguments in
            guard arguments.first != "ps" else { return table }
            guard let pid = arguments.first(where: { $0.allSatisfy(\.isNumber) })
            else { return nil }
            return cwds[pid].map { "p\(pid)\nfcwd\nn\($0)\n" }
        }
    }

    @Test
    func `only the claude executable itself counts as an agent`() async {
        // 1202 is Argo, whose arguments merely mention `.claude`; 1203 is node running a script
        // under the same folder. Neither is an agent, and both would manufacture a false running.
        let reader = ProcessLivenessReader(run: Self.shell(cwds: [
            "1201": "/Users/me/one",
            "1202": "/Users/me/two",
            "1203": "/Users/me/three",
            "1204": "/Users/me/four",
        ]))

        #expect(await reader.liveCwds() == ["/Users/me/one", "/Users/me/four"])
    }

    @Test
    func `a process whose folder cannot be read contributes nothing`() async {
        let reader = ProcessLivenessReader(run: Self.shell(cwds: ["1201": "/Users/me/one"]))

        // 1204 is an agent whose `lsof` answered nothing: an unreadable folder is left out rather
        // than standing in for whichever Session was asking.
        #expect(await reader.liveCwds() == ["/Users/me/one"])
    }

    @Test
    func `a host with no process table at all reads quiet`() async {
        let reader = ProcessLivenessReader(run: { _ in nil })

        #expect(await reader.liveCwds().isEmpty)
    }
}
