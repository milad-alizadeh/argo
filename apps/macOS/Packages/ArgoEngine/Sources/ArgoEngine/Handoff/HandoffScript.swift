import Foundation

/// The words one handoff is made of: what Argo types at the full Session's prompt, where the brief
/// it asks for lands, and what the fresh Session opens on.
///
/// **Argo names the address.** `/handoff` is a skill the CLI carries, not something this repo owns,
/// so where it would write by default is a thing Argo would be guessing at — and a guessed path
/// that never appears is indistinguishable from a command that was never understood. Passing the
/// path makes the wait a question with an answer: either that file is there or the handoff did not
/// happen, and the second is reported rather than papered over with a fresh Session seeded on
/// nothing.
///
/// The brief lives in Argo's own per-machine data and never in the Project. It is a working note
/// between two Sessions, and a repo is not where one belongs.
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

    /// What is typed at the full Session's prompt. The newline is the Return that submits it — a
    /// line left sitting in the composer is a handoff nobody started.
    static func command(writingBriefTo path: String) -> String {
        "/handoff \(path)\n"
    }

    /// What the fresh Session opens on.
    ///
    /// It points at the brief rather than pasting it: the file is the artifact, the agent can read
    /// it, and a prompt carrying a whole document would spend the new Session's context on the very
    /// thing it was opened to escape.
    ///
    /// The issue is named only when the Session had one. An opening prompt that asserted a ticket
    /// number Argo never read would be the fresh Session's first fact and a false one.
    static func opening(fromBriefAt path: String, issue: Int?) -> String {
        let work = issue.map { "Continue work on issue #\($0)." } ?? "Continue the work it describes."
        return "Read the handoff brief at \(path). \(work)"
    }
}
