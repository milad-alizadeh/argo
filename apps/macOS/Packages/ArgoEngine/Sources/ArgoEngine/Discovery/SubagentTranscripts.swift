import Foundation

/// One Subagent's own transcript file, and the Subagent it belongs to.
public struct SubagentTranscript: Sendable, Equatable {
    /// The CLI's own id for the Subagent. The join key, and the only one: the delegating call's
    /// result reports this same string, so it is what ties a file to the call that started it.
    public let agentID: String
    public let url: URL
}

/// The Subagent transcripts beside one Session's own record.
///
/// Claude Code writes each Subagent to a file of its own under a directory named for the parent,
/// never inline in the parent's record — so a fan-out is N files that appear while the parent runs
/// and go on growing after it falls quiet. The walk RECURSES, because an Agent a workflow ran sits
/// one directory further down again; the roster's own sweep takes exactly one level for the
/// opposite reason, so that these are never mistaken for Sessions.
public enum SubagentTranscripts {
    /// Ordered by `agentID`, which is arbitrary but stable — a directory walk has no order of its
    /// own, and the order the work was handed over in is a fact about the parent's calls rather
    /// than about the files.
    public static func beside(_ parentURL: URL) -> [SubagentTranscript] {
        let rootURL = parentURL.deletingPathExtension()
            .appending(path: subagentsDirectory, directoryHint: .isDirectory)
        let walk = FileManager.default.enumerator(at: rootURL, includingPropertiesForKeys: nil)
        return (walk?.compactMap { $0 as? URL } ?? [])
            .compactMap(transcript(at:))
            .sorted { $0.agentID < $1.agentID }
    }

    /// A Subagent's transcript, or `nil` for any other file in that tree — `tool-results/` sits
    /// under there too, and a file the host did not name for an Agent has no id to key it by.
    private static func transcript(at url: URL) -> SubagentTranscript? {
        guard url.pathExtension == "jsonl" else { return nil }
        let name = url.deletingPathExtension().lastPathComponent
        guard name.hasPrefix(agentFilePrefix) else { return nil }
        return SubagentTranscript(agentID: String(name.dropFirst(agentFilePrefix.count)), url: url)
    }
}

private let subagentsDirectory = "subagents"
private let agentFilePrefix = "agent-"
