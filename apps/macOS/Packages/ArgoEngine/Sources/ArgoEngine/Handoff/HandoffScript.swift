import Foundation

/// The words one handoff is made of: what Argo types at the full Session's prompt, where the brief
/// it asks for lands, and what the fresh Session opens on.
///
/// The `handoff` skill is installed from `mattpocock/skills` (`skills-lock.json`) and tells its
/// agent to save to the OS temp directory and to read an argument as a topic, so a bare path is
/// read as a subject to go looking for rather than an address to write to (#628).
///
/// The brief lives in Argo's own per-machine data and never in the Project.
enum HandoffScript {
    /// The file extension is markdown because the brief is prose an agent wrote for an agent.
    static func briefURL(in root: URL, sessionID: String, atMs: Int) -> URL {
        root.appending(path: "handoff-\(token(for: sessionID))-\(atMs).md")
    }

    /// A Session id is a CLI's own string and may carry separators. Cut to what a filename can
    /// hold, rather than trusted into a path.
    private static func token(for sessionID: String) -> String {
        let kept = sessionID.filter { $0.isLetter || $0.isNumber || $0 == "-" }
        return kept.isEmpty ? "session" : String(kept.suffix(24))
    }

    /// What is typed at the prompt, with no terminator: `ClaudeTurn` spells the Return.
    ///
    /// The path goes last so the sentence cannot swallow it.
    static func command(writingBriefTo path: String) -> String {
        "/handoff Write the handoff document to this exact absolute path, "
            + "creating any missing parent directories. Do not choose a folder or a filename of "
            + "your own, and do not write it anywhere else. The path is: \(path)"
    }

    /// What the fresh Session opens on. It points at the brief rather than pasting it, or the new
    /// Session spends its context on the thing it was opened to escape. The issue is named only
    /// when the Session had one.
    static func opening(fromBriefAt path: String, issue: Int?) -> String {
        let work = issue.map { "Continue work on issue #\($0)." } ?? "Continue the work it describes."
        return "Read the handoff brief at \(path). \(work)"
    }
}
