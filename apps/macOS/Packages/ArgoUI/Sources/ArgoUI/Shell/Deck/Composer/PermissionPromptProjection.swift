import ArgoEngine
import Foundation

/// What the prompt states about the Permission it puts to the user, derived the way the composer's
/// facts are: off the presentation, in a projection a test can hold still.
enum PermissionPromptProjection {
    struct Prompt: Equatable {
        /// The handles `decide` is keyed by: the roster's own id for the Session, and the request
        /// itself. Both, because the answer must reach the Permission whose words are on screen —
        /// a Session with two calls waiting cannot say which one that is.
        let sessionID: String
        let requestID: String
        /// The CLI's name for the tool, verbatim — never renamed, because the answer authorises
        /// exactly what was asked.
        let toolName: String
        /// What the tool wants, said after its name: `wants to run a command in this Workspace`.
        let subject: String
        /// The target, verbatim and in full (design decision: a decision made on a truncated
        /// command is a guess).
        let target: PermissionRequest.Target
        /// The quiet line under the target: the Workspace a command runs in, or an edit's
        /// `+1 −1 · 1 hunk`. Absent where neither fact exists.
        let caption: String?
        /// What this Session has already stopped asking about (#572) — on the prompt because the
        /// prompt is where those grants get made, and empty for a Session holding none.
        let standingAllows: [StandingAllow]
    }

    /// A prompt only while the Session is blocked on one. The composer's slot is singular: the
    /// vessel holds whichever question is live, and this projection answering is what replaces
    /// the field.
    static func prompt(for session: CockpitPresentation.Session?) -> Prompt? {
        guard let session, let permission = session.permission else { return nil }
        return Prompt(
            sessionID: session.id,
            requestID: permission.id,
            toolName: permission.toolName,
            subject: subject(of: permission.target),
            target: permission.target,
            caption: caption(of: permission.target, in: session),
            standingAllows: StandingAllowProjection.allows(for: session),
        )
    }

    private static func subject(of target: PermissionRequest.Target) -> String {
        switch target {
        case .command: "wants to run a command in this Workspace"
        case .edit: "wants to write to a file"
        case .raw: "wants to use this tool"
        }
    }

    /// The command's caption is WHERE it runs; the edit's is HOW MUCH it writes. Both are facts
    /// the block above cannot carry: the command is verbatim, and the hunk shows lines rather
    /// than counting them.
    private static func caption(
        of target: PermissionRequest.Target,
        in session: CockpitPresentation.Session,
    )
        -> String? {
        switch target {
        case .command, .raw:
            return session.workspaceLocation.map(abbreviated)
        case let .edit(_, hunks):
            let lines = hunks.flatMap(\.self)
            let added = lines.count(where: { $0.side == .add })
            let removed = lines.count(where: { $0.side == .del })
            return "+\(added) −\(removed) · \(hunks.count) \(hunks.count == 1 ? "hunk" : "hunks")"
        }
    }

    /// The home directory as `~`, the way every terminal writes it: the interesting end of a
    /// Workspace path is the trailing one, and the prompt has one line for it.
    private static func abbreviated(_ path: String) -> String {
        let home = NSHomeDirectory()
        guard path.hasPrefix(home) else { return path }
        return "~" + path.dropFirst(home.count)
    }
}
