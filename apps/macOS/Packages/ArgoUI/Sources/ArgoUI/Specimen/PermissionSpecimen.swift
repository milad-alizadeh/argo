import ArgoEngine
import Foundation

/// The Permission prompt's two fixtures — a command, and a path with its hunk — mirroring the
/// approved renders (`docs/designs/composer/perm.png`, `perm-edit.png`). The clock is seeded
/// relative to launch so the countdown and the fuse render mid-burn rather than expired.
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

    private static func prompt(
        toolName: String,
        subject: String,
        target: PermissionRequest.Target,
        caption: String,
    )
        -> PermissionPromptProjection.Prompt {
        let nowMs = Date().epochMs
        return PermissionPromptProjection.Prompt(
            sessionID: "specimen",
            toolName: toolName,
            subject: subject,
            target: target,
            caption: caption,
            // The render's own clock: 0:43 left of a fuse that reads about nine-tenths full.
            raisedAtMs: nowMs - 2000,
            deniesAtMs: nowMs + 43_000,
            alwaysAllowLabel: "Always allow \(toolName) here",
        )
    }
}
