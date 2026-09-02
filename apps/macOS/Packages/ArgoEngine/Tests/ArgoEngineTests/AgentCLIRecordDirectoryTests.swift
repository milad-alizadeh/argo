@testable import ArgoEngine
import Testing

/// The CLI's own name for a Project's record directory. Pinned as a table because the encoding is
/// the CLI's convention and not Argo's: a change here is a change to what Argo can still place when
/// a transcript's head will not parse.
@Suite("Record directory name")
struct AgentCLIRecordDirectoryTests {
    @Test(arguments: [
        ("/Users/milad/Developer/argo", "-Users-milad-Developer-argo"),
        (
            "/Users/milad/Developer/argo/.claude/worktrees/feature",
            "-Users-milad-Developer-argo--claude-worktrees-feature",
        ),
        ("/tmp/a.b", "-tmp-a-b"),
        // A trailing separator names the same folder, so it names the same directory.
        ("/checkout/", "-checkout"),
    ])
    func `Claude Code files a Project by its path, every separator a dash`(
        path: String,
        name: String,
    ) {
        #expect(AgentCLI.claude.recordDirectoryName(forProjectRoot: path) == name)
    }

    /// What a Project falls back to when there is no working directory to take one from. Every
    /// transcript on the machine would otherwise be placeable in it.
    @Test
    func `the filesystem root names no record directory`() {
        #expect(AgentCLI.claude.recordDirectoryName(forProjectRoot: "/") == nil)
    }

    @Test
    func `Codex names no record directory of its own`() {
        #expect(AgentCLI.codex.recordDirectoryName(forProjectRoot: "/tmp/checkout") == nil)
    }
}
