import ArgoEngine
import ArgoUI
import Foundation

/// The Permission prompt's two fixtures — a command, and a path with its hunk — mirroring the
/// approved renders (`docs/designs/composer/perm.png`, `perm-edit.png`).
enum PermissionSpecimen {
    static let command = prompt(
        toolName: "Bash",
        subject: "wants to run a command in this Workspace",
        target: .command("swift test --filter SessionRosterProjectionTests 2>&1 | tail -40"),
        caption: "~/Developer/argo/.claude/worktrees/argo+535-session-drive-port",
    )

    static let edit = prompt(
        toolName: "Edit",
        subject: "wants to write to a file",
        target: .edit(
            path: "apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Session/SessionFeedView.swift",
            hunks: [[
                DiffLine(side: .del, text: "let anchor = rows.last?.id"),
                DiffLine(side: .add, text: "let anchor = projection.anchorID"),
            ]],
        ),
        caption: "+1 −1 · 1 hunk",
    )

    /// The same command prompt on a Session that has already stopped asking about two other tools
    /// (#572) — the state where the grant made here is a thing on screen rather than a memory.
    static let standing = PermissionPromptProjection.Prompt(
        sessionID: command.sessionID,
        requestID: command.requestID,
        toolName: command.toolName,
        subject: command.subject,
        target: command.target,
        caption: command.caption,
        standingAllows: ["Read", "Grep"].map(StandingAllow.init(toolName:)),
    )

    private static func prompt(
        toolName: String,
        subject: String,
        target: PermissionRequest.Target,
        caption: String,
    )
        -> PermissionPromptProjection.Prompt {
        PermissionPromptProjection.Prompt(
            sessionID: "specimen",
            requestID: "permission-1",
            toolName: toolName,
            subject: subject,
            target: target,
            caption: caption,
            standingAllows: [],
        )
    }
}
