@testable import ArgoEngine
import Foundation
import Testing

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

    @discardableResult
    func write(agent agentID: String, lines: [String] = [], workflow: String? = nil) throws -> URL {
        try writeSubagent(beside: parentURL, agent: agentID, lines: lines, workflow: workflow)
    }

    func remove() {
        try? FileManager.default.removeItem(at: rootURL)
    }
}

/// The id `delegationAgent.jsonl` reports on its delegating call, and the name every record in
/// `subagentOwn.jsonl` carries — the two halves of the join, so both fixtures must spell it alike.
let delegatedAgentID = "a4a7ffa1285ef5be4"

/// One Subagent's transcript beside a parent record, at the depth the host writes it: under
/// `subagents/`, or — for an Agent a workflow ran — one directory further down again.
@discardableResult
func writeSubagent(
    beside parentURL: URL,
    agent agentID: String,
    lines: [String] = [],
    workflow: String? = nil,
) throws
    -> URL {
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

/// One Session on the roster, read from a real record directory — the shape every test here
/// starts from, because a Subagent is found from its parent's own URL.
@MainActor
func connectedSubagentHub(_ fixture: RecordDirectoryFixture) async throws -> Hub {
    let projectURL = URL(fileURLWithPath: fixture.path("checkout"))
    try fixture.write(FixtureTranscript(name: "delegating", cwd: projectURL.path))
    let hub = testHub(projectURL: projectURL, discovery: SessionDiscovery(store: fixture.store))
    await hub.connect(to: LaunchConfiguration(projectURL: projectURL, transcriptURLs: []))
    await hubSettle { !hub.sessions.isEmpty }
    return hub
}
