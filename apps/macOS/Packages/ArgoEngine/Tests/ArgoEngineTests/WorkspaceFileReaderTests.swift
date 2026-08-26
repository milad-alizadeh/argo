@testable import ArgoEngine
import Foundation
import Testing

/// What the reader makes of `git ls-files`, asked of the parse directly rather than through a
/// repository on disk (#687).
@Suite("Workspace file reading")
struct WorkspaceFileReaderTests {
    private static let folderURL = URL(fileURLWithPath: "/tmp/argo")

    @Test
    func `the NUL-separated listing comes back one path per entry`() async {
        let files = await read("README.md\0apps/macOS/Argo.swift\0docs/adr/ADR-0027.md\0")

        #expect(files == ["README.md", "apps/macOS/Argo.swift", "docs/adr/ADR-0027.md"])
    }

    @Test
    func `paths are separated by NUL and never by a newline`() async {
        // `-z` is what makes a filename with a newline in it survive the read. Split on newlines
        // instead and one such file becomes two paths, neither of which exists.
        let files = await read("a\nb.md\0c.md\0")

        #expect(files == ["a\nb.md", "c.md"])
    }

    @Test
    func `the trailing separator adds no empty path`() async {
        #expect(await read("only.md\0") == ["only.md"])
    }

    @Test
    func `a folder git will not list answers no files at all`() async {
        // A folder that is not a repository, not a folder with nothing in it. The picker draws
        // the same nothing either way, but the reader must not invent a listing for it.
        #expect(await WorkspaceFileReader(git: { _, _ in nil }).files(at: Self.folderURL) == [])
    }

    @Test
    func `an empty repository lists nothing`() async {
        #expect(await read("") == [])
    }

    @Test
    func `the listing is asked for tracked and untracked files, minus the ignored ones`() async {
        // Answered only for the exact question, so any other spelling comes back empty.
        let asked = "ls-files --cached --others --exclude-standard -z"
        let reader = WorkspaceFileReader(git: { arguments, _ in
            arguments.joined(separator: " ") == asked ? "README.md\0" : nil
        })

        #expect(await reader.files(at: Self.folderURL) == ["README.md"])
    }

    private func read(_ output: String) async -> [String] {
        await WorkspaceFileReader(git: { _, _ in output }).files(at: Self.folderURL)
    }
}
