@testable import ArgoEngine
import Foundation

/// A Session's record laid down the way Claude Code lays one down: the parent transcript, and each
/// Subagent in its own file under a directory named for the parent.
///
/// Built on disk rather than checked in, because what the walk reads is a directory tree — a
/// fixture with the tree flattened into one file would never exercise the recursion a workflow's
/// Agents need.
struct SubagentDirectoryFixture {
    let rootURL: URL
    let parentURL: URL

    init(session: String = "session") throws {
        self.rootURL = FileManager.default.temporaryDirectory
            .appending(path: "argo-subagents-\(UUID().uuidString)", directoryHint: .isDirectory)
        self.parentURL = rootURL.appending(path: "\(session).jsonl")
        try FileManager.default.createDirectory(at: rootURL, withIntermediateDirectories: true)
        try Data().write(to: parentURL)
    }

    /// One Subagent's transcript, at the depth the host writes it: directly under `subagents/`, or
    /// — for an Agent a workflow ran — one directory further down again.
    @discardableResult
    func write(agent agentID: String, lines: [String] = [], workflow: String? = nil) throws -> URL {
        var directoryURL = parentURL.deletingPathExtension()
            .appending(path: "subagents", directoryHint: .isDirectory)
        if let workflow {
            directoryURL = directoryURL
                .appending(path: "workflows", directoryHint: .isDirectory)
                .appending(path: workflow, directoryHint: .isDirectory)
        }
        try FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true)
        let url = directoryURL.appending(path: "agent-\(agentID).jsonl")
        try Data(lines.joined(separator: "\n").utf8).write(to: url)
        return url
    }

    func remove() {
        try? FileManager.default.removeItem(at: rootURL)
    }
}
