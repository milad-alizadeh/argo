import Foundation

/// The words one handoff is made of: what Argo types at the full Session's prompt, where the brief
/// it asks for lands, and what the fresh Session opens on.
///
/// **Argo names the address, in words.** `/handoff` is installed from `mattpocock/skills` and is
/// not this repo's to edit, so the contract can only be spelled from this side. Its instructions
/// say to save to the OS temp directory and to read an argument as a topic — a bare path is
/// therefore read as a subject to go looking for, which #628 watched an agent do.
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

    /// What is typed at the full Session's prompt, and only that. Submitting it is the terminal's
    /// business and `ClaudeTurn` already spells it — a terminator written here would be a second
    /// Return, which is #628.
    ///
    /// The address is an instruction rather than a bare argument, and the path goes last so the
    /// sentence cannot swallow it. Both halves are what the skill's own default would otherwise
    /// win: it is told to pick a folder and a name, and only being told not to stops it.
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
